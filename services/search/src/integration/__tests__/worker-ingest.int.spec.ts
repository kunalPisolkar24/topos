import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Kafka, type EachBatchPayload } from 'kafkajs';
import { ElasticsearchRepository } from '../../infrastructure/elasticsearch/elasticsearch.repository.js';
import { IngestService } from '../../worker/services/ingest.service.js';
import { SAMPLE_POSTS, stubLogger, stubMetrics, buildPostEvent } from '../helpers/fixtures.js';
import type { ElasticsearchConfig } from '../../infrastructure/elasticsearch/elasticsearch.repository.js';
import type { DlqMessage } from '../../core/entities/dlq-message.entity.js';
import type { IDlqProducer } from '../../core/interfaces/message-broker.interface.js';

const TEST_INDEX = 'int-test-worker';
const TEST_TOPIC = 'int-test-posts';

let esRepo: ElasticsearchRepository;
let ingestService: IngestService;
let kafka: Kafka;
const dlqMessages: DlqMessage[] = [];

const stubDlqProducer: IDlqProducer = {
  connect: async () => {},
  disconnect: async () => {},
  publish: async (msg: DlqMessage) => {
    dlqMessages.push(msg);
  },
};

function getEsConfig(): ElasticsearchConfig {
  const url = process.env.INTEGRATION_ES_URL;
  if (!url) throw new Error('INTEGRATION_ES_URL not set');
  return {
    url,
    index: TEST_INDEX,
    tlsRejectUnauthorized: false,
    requestTimeoutMs: 10_000,
    maxRetries: 1,
    refreshPolicy: 'wait_for',
    bulkChunkSize: 100,
  };
}

function makeEachBatchPayload(messages: Array<{ key: string | null; value: unknown | null }>): EachBatchPayload {
  const resolveOffset = vi.fn();
  const heartbeat = vi.fn();
  const commitOffsetsIfNecessary = vi.fn();
  const uncommittedOffsets = vi.fn();
  const pause = vi.fn();

  return {
    batch: {
      topic: TEST_TOPIC,
      partition: 0,
      highWatermark: String(messages.length),
      messages: messages.map((m, i) => ({
        key: m.key !== null ? Buffer.from(m.key) : null,
        value: m.value !== null ? Buffer.from(JSON.stringify(m.value)) : null,
        timestamp: Date.now().toString(),
        attributes: 0,
        offset: String(i),
        headers: {},
      })),
      isEmpty: () => messages.length === 0,
      firstOffset: () => '0',
      lastOffset: () => String(messages.length - 1),
      offsetLag: () => '0',
      offsetLagLow: () => '0',
    },
    resolveOffset,
    heartbeat: vi.fn(async () => {}),
    commitOffsetsIfNecessary: vi.fn(async () => {}),
    uncommittedOffsets,
    isRunning: () => true,
    isStale: () => false,
    pause,
  };
}

beforeAll(async () => {
  esRepo = new ElasticsearchRepository(getEsConfig(), stubLogger, stubMetrics);

  const bootstrap = process.env.INTEGRATION_KAFKA_BOOTSTRAP;
  if (!bootstrap) throw new Error('INTEGRATION_KAFKA_BOOTSTRAP not set');

  kafka = new Kafka({
    clientId: 'int-test-worker',
    brokers: [bootstrap],
  });

  await esRepo.ensureIndex();

  const admin = kafka.admin();
  await admin.connect();
  try {
    await admin.createTopics({
      topics: [{ topic: TEST_TOPIC, numPartitions: 1, replicationFactor: 1 }],
    });
  } finally {
    await admin.disconnect();
  }

  ingestService = new IngestService(esRepo, stubDlqProducer, stubLogger, stubMetrics);
});

afterAll(async () => {
  try {
    const admin = kafka.admin();
    await admin.connect();
    await admin.deleteTopics({ topics: [TEST_TOPIC] });
    await admin.disconnect();
  } catch {
    // best-effort cleanup
  }

  try {
    const { Client } = await import('@elastic/elasticsearch');
    const esClient = new Client({ node: process.env.INTEGRATION_ES_URL! });
    await esClient.indices.delete({ index: TEST_INDEX });
    await esClient.close();
  } catch {
    // best-effort cleanup
  }
});

describe('IngestService integration', () => {
  beforeEach(() => {
    dlqMessages.length = 0;
  });

  it('indexes a valid Pascal PostEvent and makes it searchable', async () => {
    const event = buildPostEvent({ PostID: 'worker-test-1', Title: 'Worker Gamma' });
    const payload = makeEachBatchPayload([{ key: 'worker-test-1', value: event }]);

    await ingestService.processBatch(payload);

    const result = await esRepo.search('gamma', 1, 10);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.hits.some((h) => h.postId === 'worker-test-1')).toBe(true);
  });

  it('indexes a valid camelCase PostEvent', async () => {
    const event = {
      postId: 'worker-test-2',
      title: 'Camel Case Event',
      body: 'Body for camel case test.',
      createdAt: '2024-06-01T00:00:00Z',
      imageUrl: null,
    };
    const payload = makeEachBatchPayload([{ key: 'worker-test-2', value: event }]);

    await ingestService.processBatch(payload);

    const result = await esRepo.search('camel', 1, 10);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.hits.some((h) => h.postId === 'worker-test-2')).toBe(true);
  });

  it('processes a tombstone (null value) and deletes the document', async () => {
    await esRepo.bulkUpsert([SAMPLE_POSTS[0]]);

    const payload = makeEachBatchPayload([{ key: SAMPLE_POSTS[0].postId, value: null }]);

    await ingestService.processBatch(payload);

    const result = await esRepo.search(SAMPLE_POSTS[0].title, 1, 10);
    expect(result.hits.some((h) => h.postId === SAMPLE_POSTS[0].postId)).toBe(false);
  });

  it('sends invalid messages to DLQ and does not index them', async () => {
    const invalidEvent = { RandomField: 'no structure' };
    const payload = makeEachBatchPayload([{ key: 'invalid-1', value: invalidEvent }]);

    await ingestService.processBatch(payload);

    expect(dlqMessages.length).toBeGreaterThanOrEqual(1);
    expect(dlqMessages[0].key).toBe('invalid-1');
    expect(dlqMessages[0].originalTopic).toBe(TEST_TOPIC);

    const result = await esRepo.search('no structure', 1, 10);
    expect(result.total).toBe(0);
  });

  it('processes a mixed batch of valid and invalid messages', async () => {
    const validEvent = buildPostEvent({ PostID: 'worker-mixed-1', Title: 'Mixed Valid' });
    const invalidEvent = { BadData: true };
    const payload = makeEachBatchPayload([
      { key: 'worker-mixed-1', value: validEvent },
      { key: 'invalid-2', value: invalidEvent },
    ]);

    await ingestService.processBatch(payload);

    const result = await esRepo.search('mixed', 1, 10);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.hits.some((h) => h.postId === 'worker-mixed-1')).toBe(true);

    const dlqInvalid = dlqMessages.some((m) => m.key === 'invalid-2');
    expect(dlqInvalid).toBe(true);
  });

  it('sends malformed JSON to DLQ', async () => {
    const payload = makeEachBatchPayload([
      { key: 'malformed-1', value: 'not valid json at all' },
    ]);

    await ingestService.processBatch(payload);

    expect(dlqMessages.length).toBeGreaterThanOrEqual(1);
    expect(dlqMessages.some((m) => m.key === 'malformed-1')).toBe(true);
  });
});
