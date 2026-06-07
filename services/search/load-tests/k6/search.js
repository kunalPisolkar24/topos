import {
  postGraphQL,
  checkOk,
  parseBody,
  searchDuration,
  searchErrors,
  SEARCH_QUERY,
  loadSeed,
  pickQuery,
  getDefaultOptions,
} from './shared.js';

const vus = parseInt(__ENV.VUS) || 20;
const duration = __ENV.DURATION || '30s';
const rps = parseInt(__ENV.RPS) || 50;

export const options = getDefaultOptions({
  vus,
  duration,
  rps,
  thresholds: {
    'http_req_duration{group:search}': ['p(95)<500', 'p(99)<1500'],
    'http_req_failed{group:search}': ['rate<0.01'],
  },
});

export function setup() {
  return loadSeed();
}

export default function (seed) {
  const idx = (__VU - 1) * 1000 + __ITER;
  const q = pickQuery(seed, idx);
  const page = Math.random() > 0.8 ? Math.floor(Math.random() * 10) + 1 : 1;
  const limit = [10, 20, 50][Math.floor(Math.random() * 3)];

  const res = postGraphQL(SEARCH_QUERY, { query: q.query, page, limit }, { group: 'search' });
  searchDuration.add(res.timings.duration);
  checkOk(res, 'search');

  if (res.status !== 200 || res.error_code !== 0) {
    searchErrors.add(1);
    return;
  }
  const body = parseBody(res);
  if (!body || body.errors) {
    searchErrors.add(1);
  }
}
