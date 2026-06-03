import grpc from 'k6/net/grpc';
import { check } from 'k6';

const PROTO_DIR = __ENV.PROTO_DIR || 'load-tests/proto';
const TARGET = __ENV.TARGET || 'localhost:50051';

export const TEST_HTML =
  '<article><h1>Understanding Kubernetes Architecture</h1>' +
  '<p>Kubernetes has become the de facto standard for container orchestration in production environments. ' +
  'It provides automated deployment, scaling, and management of containerized applications.</p>' +
  '<section><h2>Core Components</h2>' +
  '<p>The control plane manages the cluster state while worker nodes run the actual workloads. ' +
  'Key components include the API server, scheduler, controller manager, and etcd.</p></section>' +
  '<section><h2>Benefits</h2>' +
  '<p>Organizations benefit from improved resource utilization, automated rollouts and rollbacks, ' +
  'service discovery, and built-in load balancing capabilities.</p></section></article>';

export const TEST_TITLE = 'Understanding Kubernetes Architecture';
export const TEST_BODY =
  '<p>Kubernetes provides automated container orchestration with features like auto-scaling, ' +
  'service discovery, and rolling updates. It runs anywhere from on-premises to public clouds.</p>' +
  '<p>The platform handles scheduling, health monitoring, and self-healing of applications, ' +
  'making it essential for modern cloud-native architectures.</p>';

export const TEST_PROMPT = 'Write a comprehensive blog post about the impact of artificial intelligence on modern healthcare';

export function getDefaultOptions(vus, duration, rps) {
  return {
    scenarios: {
      default: {
        executor: 'constant-arrival-rate',
        rate: rps || 10,
        timeUnit: '1s',
        duration: duration || '30s',
        preAllocatedVUs: vus || 5,
        maxVUs: (vus || 5) * 2,
      },
    },
    thresholds: {
      grpc_req_duration: ['p(95)<500', 'p(99)<1000'],
      grpc_req_failed: ['rate<0.01'],
    },
  };
}

export function createClient() {
  const client = new grpc.Client();
  client.load([PROTO_DIR], 'ai_service.proto');
  client.connect(TARGET, { plaintext: true });
  return client;
}

export function checkResponse(response, methodName) {
  check(response, {
    [`${methodName} status is OK`]: (r) => r.status === grpc.StatusOK,
    [`${methodName} has no error`]: (r) => r.error === undefined,
  });
}
