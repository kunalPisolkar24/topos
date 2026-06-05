import { GenericContainer, Wait } from 'testcontainers';
import type { StartedTestContainer } from 'testcontainers';

const containers: StartedTestContainer[] = [];

export async function setup(): Promise<() => Promise<void>> {
  const esContainer = await new GenericContainer(
    'docker.elastic.co/elasticsearch/elasticsearch:8.11.0'
  )
    .withEnvironment({
      'discovery.type': 'single-node',
      'xpack.security.enabled': 'false',
      'ES_JAVA_OPTS': '-Xms512m -Xmx512m',
      'cluster.name': 'test-cluster',
    })
    .withExposedPorts(9200)
    .withWaitStrategy(Wait.forHttp('/', 9200))
    .withStartupTimeout(120_000)
    .start();
  containers.push(esContainer);

  process.env.INTEGRATION_ES_URL = `http://${esContainer.getHost()}:${esContainer.getMappedPort(9200)}`;

  const redisContainer = await new GenericContainer('redis:7.2-alpine')
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
    .withStartupTimeout(30_000)
    .start();
  containers.push(redisContainer);

  process.env.INTEGRATION_REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;

  const kafkaContainer = await new GenericContainer('apache/kafka:3.7.0')
    .withNetworkMode('host')
    .withEnvironment({
      KAFKA_NODE_ID: '1',
      KAFKA_PROCESS_ROLES: 'broker,controller',
      KAFKA_LISTENERS: 'PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093',
      KAFKA_ADVERTISED_LISTENERS: 'PLAINTEXT://localhost:9092',
      KAFKA_CONTROLLER_LISTENER_NAMES: 'CONTROLLER',
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: 'CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT',
      KAFKA_CONTROLLER_QUORUM_VOTERS: '1@localhost:9093',
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: '1',
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: '1',
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: '1',
      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: '0',
      CLUSTER_ID: 'kafka-test-cluster-id',
    })
    .withWaitStrategy(Wait.forLogMessage('started'))
    .withStartupTimeout(120_000)
    .start();
  containers.push(kafkaContainer);

  process.env.INTEGRATION_KAFKA_BOOTSTRAP = 'localhost:9092';

  return async () => {
    for (const c of containers) {
      try {
        await c.stop();
      } catch {
        // ignore stop errors during teardown
      }
    }
    containers.length = 0;
  };
}
