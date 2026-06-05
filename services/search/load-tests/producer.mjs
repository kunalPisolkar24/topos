import { createRequire } from 'module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire('/usr/src/app/');
const { Kafka, logLevel: KafkaLogLevel } = require('kafkajs');

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:9092';
const TOPIC_POSTS = process.env.TOPIC_POSTS || 'posts';
const TOPIC_DLQ = process.env.TOPIC_DLQ || 'posts.dlq';
const RPS = parseInt(process.env.RPS || '100', 10);
const DURATION = parseInt(process.env.DURATION || '30', 10);
const MESSAGE_SIZE = process.env.MESSAGE_SIZE || 'medium';
const PARTITIONS = parseInt(process.env.PARTITIONS || '3', 10);
const WORKER_TARGET = process.env.WORKER_TARGET || 'http://search-worker:7091';
const ES_URL = process.env.ELASTICSEARCH_URL || 'http://search-es:9200';
const ES_INDEX = process.env.ELASTICSEARCH_INDEX || 'posts';
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/load-tests/results';

const TOPIC_WORDS = {
  small: ['guide', 'overview', 'tips', 'basics'],
  medium: ['comprehensive', 'detailed', 'practical', 'technical'],
  large: ['authoritative', 'exhaustive', 'encyclopedic', 'definitive'],
};

const BODY_SIZES = {
  small: { min: 10, max: 20 },
  medium: { min: 40, max: 80 },
  large: { min: 150, max: 300 },
};

const SUBJECTS = [
  'JavaScript Async Patterns', 'React State Management', 'Docker Containerization',
  'PostgreSQL Query Optimization', 'Kubernetes Deployment', 'REST API Design',
  'Microservices Communication', 'Redis Caching Strategies', 'TypeScript Generics',
  'GraphQL Federation', 'Event-Driven Architecture', 'CI CD Pipeline Setup',
  'Monitoring with Prometheus', 'Secure Authentication Flows', 'Database Migration',
  'Performance Profiling', 'Error Handling Patterns', 'Testing Best Practices',
  'Cloud Infrastructure', 'Message Queue Patterns',
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateLorum(count) {
  const words = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' ');
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(pickRandom(words));
  }
  return result.join(' ');
}

function generateMessageBody() {
  const size = BODY_SIZES[MESSAGE_SIZE] || BODY_SIZES.medium;
  const wordCount = randomInt(size.min, size.max);
  return generateLorum(wordCount);
}

function generatePostEvent(id) {
  const subject = pickRandom(SUBJECTS);
  const adjective = pickRandom(TOPIC_WORDS[MESSAGE_SIZE] || TOPIC_WORDS.medium);
  const title = `${subject} ${adjective}`;
  const body = generateMessageBody();
  const createdAt = new Date(Date.now() - randomInt(0, 365) * 86400000).toISOString();
  const postId = `loadtest-post-${id}`;

  return {
    PostID: postId,
    Title: title,
    Body: body,
    ImageURL: Math.random() > 0.2 ? `https://images.example.com/${postId}.jpg` : null,
    CreatedAt: createdAt,
    Slug: postId,
    Summary: body.slice(0, randomInt(60, 120)) + '...',
  };
}

function formatMs(ms) {
  return ms.toFixed(2) + 'ms';
}

function fmt(n) {
  return n.toLocaleString();
}

async function createTopic(admin) {
  const existing = await admin.listTopics();
  if (existing.includes(TOPIC_POSTS)) {
    await admin.deleteTopics({ topics: [TOPIC_POSTS] });
    console.log(`Deleted existing topic "${TOPIC_POSTS}"`);
  }
  await admin.createTopics({
    topics: [{ topic: TOPIC_POSTS, numPartitions: PARTITIONS, replicationFactor: 1 }],
  });
  console.log(`Created topic "${TOPIC_POSTS}" with ${PARTITIONS} partitions`);
}

async function checkWorkerHealth() {
  const authHeader = 'Basic ' + Buffer.from('dummy:dummy').toString('base64');
  const opts = { headers: { Authorization: authHeader } };
  try {
    const hz = await fetch(`${WORKER_TARGET}/healthz`, opts);
    const ready = await fetch(`${WORKER_TARGET}/readyz`, opts);
    return { healthy: hz.ok && ready.ok, healthz: hz.status, readyz: ready.status };
  } catch {
    return { healthy: false, healthz: 0, readyz: 0 };
  }
}

async function getEsDocCount() {
  try {
    const resp = await fetch(`${ES_URL}/${ES_INDEX}/_count`);
    if (!resp.ok) return -1;
    const data = await resp.json();
    return data.count;
  } catch {
    return -1;
  }
}

class Ticker {
  constructor(rps, durationMs) {
    this.interval = 1000 / rps;
    this.totalMessages = Math.ceil(rps * durationMs / 1000);
    this.startTime = 0;
    this.sent = 0;
    this.errors = 0;
    this.latencies = [];
    this.healthChecks = [];
    this.done = false;
  }

  start() {
    this.startTime = Date.now();
    this.endTime = this.startTime + (this.totalMessages / (1000 / this.interval)) * 1000;
  }

  recordSend(durationMs) {
    this.latencies.push(durationMs);
    this.sent++;
  }

  recordError() {
    this.errors++;
  }

  recordHealthCheck(result) {
    this.healthChecks.push(result);
  }

  isComplete() {
    return this.sent + this.errors >= this.totalMessages;
  }

  elapsed() {
    return Date.now() - this.startTime;
  }

  avgLatency() {
    if (this.latencies.length === 0) return 0;
    return this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
  }

  percentile(p) {
    if (this.latencies.length === 0) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const idx = Math.ceil(p / 100 * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  effectiveRps() {
    const elapsedSec = this.elapsed() / 1000;
    if (elapsedSec < 0.001) return 0;
    return this.sent / elapsedSec;
  }

  summary() {
    const hcOk = this.healthChecks.filter(h => h.healthy).length;
    return {
      durationMs: this.elapsed(),
      targetRps: RPS,
      messagesSent: this.sent,
      sendErrors: this.errors,
      avgLatencyMs: this.avgLatency(),
      p90: this.percentile(90),
      p95: this.percentile(95),
      p99: this.percentile(99),
      maxLatencyMs: this.latencies.length > 0 ? Math.max(...this.latencies) : 0,
      healthChecksTotal: this.healthChecks.length,
      healthChecksOk: hcOk,
      healthChecksFailed: this.healthChecks.length - hcOk,
      effectiveRps: this.effectiveRps(),
    };
  }
}

async function main() {
  console.log(`\n=== WORKER LOAD TEST ===`);
  console.log(`Target RPS:        ${RPS}`);
  console.log(`Duration:          ${DURATION}s`);
  console.log(`Message size:      ${MESSAGE_SIZE}`);
  console.log(`Partitions:        ${PARTITIONS}`);
  console.log(`Kafka broker:      ${KAFKA_BROKER}`);
  console.log(`Worker target:     ${WORKER_TARGET}`);
  console.log(`ES URL:            ${ES_URL}\n`);

  console.log('[1/4] Connecting to Kafka...');
  const kafka = new Kafka({
    clientId: 'search-loadgen',
    brokers: KAFKA_BROKER.split(',').map(s => s.trim()),
    logLevel: KafkaLogLevel.ERROR,
  });

  const admin = kafka.admin();
  await admin.connect();
  await createTopic(admin);
  await admin.disconnect();

  const producer = kafka.producer({ allowAutoTopicCreation: false });
  await producer.connect();

  console.log(`[2/4] Producing messages for ${DURATION}s...\n`);

  const ticker = new Ticker(RPS, DURATION * 1000);
  ticker.start();

  let healthInterval = setInterval(async () => {
    const result = await checkWorkerHealth();
    ticker.recordHealthCheck(result);
    if (!result.healthy) {
      console.log(`  [WARN] Worker health check failed: /healthz=${result.healthz} /readyz=${result.readyz}`);
    }
  }, 5000);

  function scheduleNext() {
    if (ticker.isComplete()) return;

    const elapsed = ticker.elapsed();
    const targetCount = Math.floor(elapsed / ticker.interval);
    const toSend = Math.min(targetCount - (ticker.sent + ticker.errors), 50);

    if (toSend <= 0) {
      setTimeout(scheduleNext, Math.max(1, ticker.interval - elapsed + ticker.sent * ticker.interval));
      return;
    }

    const batch = [];
    for (let i = 0; i < toSend; i++) {
      const globalIdx = ticker.sent + ticker.errors + i;
      const event = generatePostEvent(globalIdx);
      batch.push({ key: event.PostID, value: JSON.stringify(event) });
    }

    const sendStart = Date.now();
    producer.send({ topic: TOPIC_POSTS, messages: batch })
      .then(() => {
        const sendDuration = Date.now() - sendStart;
        ticker.recordSend(sendDuration);
        scheduleNext();
      })
      .catch((err) => {
        ticker.recordError();
        console.error(`  [ERROR] Send failed: ${err.message}`);
        scheduleNext();
      });
  }

  scheduleNext();

  while (!ticker.isComplete() && ticker.elapsed() < DURATION * 1000 + 5000) {
    await new Promise(r => setTimeout(r, 100));
  }

  if (ticker.elapsed() >= DURATION * 1000 + 5000 && !ticker.isComplete()) {
    console.log(`\n[WARN] Duration exceeded but ${ticker.totalMessages - ticker.sent - ticker.errors} messages remain unsent`);
  }

  clearInterval(healthInterval);
  await producer.disconnect();

  const result = ticker.summary();

  console.log(`\n[3/4] Waiting for worker to drain (up to 10s)...`);
  let esCount = await getEsDocCount();
  const expected = result.messagesSent;
  const startWait = Date.now();
  while (esCount < expected && Date.now() - startWait < 10000) {
    await new Promise(r => setTimeout(r, 500));
    esCount = await getEsDocCount();
  }
  const esMatch = esCount >= expected * 0.95;

  console.log(`\n[4/4] Running final worker health check...`);
  const finalHealth = await checkWorkerHealth();

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const output = { ...result, esDocCount: esCount, esExpected: result.messagesSent };
  writeFileSync(resolve(OUTPUT_DIR, 'worker-results.json'), JSON.stringify(output, null, 2));

  console.log(`\n=== WORKER LOAD TEST SUMMARY ===`);
  console.log(`  Duration:         ${(result.durationMs / 1000).toFixed(1)}s`);
  console.log(`  Target RPS:       ${result.targetRps}`);
  console.log(`  Messages sent:    ${fmt(result.messagesSent)}`);
  console.log(`  Send errors:      ${fmt(result.sendErrors)}`);
  console.log(`  Effective RPS:    ${result.effectiveRps.toFixed(1)}`);
  console.log(`  Produce latency:`);
  console.log(`    avg:  ${formatMs(result.avgLatencyMs)}`);
  console.log(`    p90:  ${formatMs(result.p90)}`);
  console.log(`    p95:  ${formatMs(result.p95)}`);
  console.log(`    p99:  ${formatMs(result.p99)}`);
  console.log(`    max:  ${formatMs(result.maxLatencyMs)}`);
  console.log(`  Worker health:`);
  console.log(`    checks:  ${result.healthChecksTotal}`);
  console.log(`    passed:  ${result.healthChecksOk}`);
  console.log(`    failed:  ${result.healthChecksFailed}`);
  console.log(`  Final healthz:    ${finalHealth.healthz}`);
  console.log(`  Final readyz:     ${finalHealth.readyz}`);
  console.log(`  ES doc count:     ${fmt(esCount)} (expected ~${fmt(result.messagesSent)})`);
  console.log(`  ES match:         ${esMatch ? 'PASS' : 'CHECK - count may lag behind'}`);

  if (result.sendErrors > 0 || result.healthChecksFailed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Producer failed:', err);
  process.exit(1);
});
