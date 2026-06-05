import {
  postGraphQL,
  checkOk,
  parseBody,
  searchDuration,
  cacheHitDuration,
  cacheMissDuration,
  searchErrors,
  SEARCH_QUERY,
  loadSeed,
  pickQueryFromGroup,
  pickPostId,
} from './shared.js';

const vus = parseInt(__ENV.VUS) || 20;
const duration = __ENV.DURATION || '30s';
const rps = parseInt(__ENV.RPS) || 50;

function parseWeights(env) {
  const defaults = { shortQuery: 50, phraseQuery: 25, paginatedQuery: 15, targetedQuery: 10 };
  if (!env) return defaults;
  const out = { ...defaults };
  for (const part of env.split(',')) {
    const [k, v] = part.split(':').map((s) => s.trim());
    if (k && v) {
      const n = parseFloat(v);
      if (Number.isFinite(n) && n >= 0) out[k] = n;
    }
  }
  return out;
}

const weights = parseWeights(__ENV.WEIGHTS);
const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

function allocRps(percent) {
  return Math.max(1, Math.round((rps * percent) / total));
}

function durationToSec(d) {
  const m = /^(\d+)(s|m|h)$/.exec(d);
  if (!m) return 30;
  const n = parseInt(m[1], 10);
  return n * (m[2] === 'h' ? 3600 : m[2] === 'm' ? 60 : 1);
}

const thresholds = {
  'http_req_duration{group:shortQuery}': ['p(95)<300', 'p(99)<800'],
  'http_req_duration{group:phraseQuery}': ['p(95)<400', 'p(99)<1000'],
  'http_req_duration{group:paginatedQuery}': ['p(95)<800', 'p(99)<2000'],
  'http_req_duration{group:targetedQuery}': ['p(95)<200', 'p(99)<500'],
  'http_req_failed{group:shortQuery}': ['rate<0.01'],
  'http_req_failed{group:phraseQuery}': ['rate<0.01'],
  'http_req_failed{group:paginatedQuery}': ['rate<0.02'],
  'http_req_failed{group:targetedQuery}': ['rate<0.01'],
};

export const options = {
  scenarios: {
    shortQuery: {
      executor: 'constant-arrival-rate',
      rate: allocRps(weights.shortQuery),
      timeUnit: '1s',
      duration: duration,
      preAllocatedVUs: vus,
      maxVUs: vus * 2,
      exec: 'shortQueryFlow',
    },
    phraseQuery: {
      executor: 'constant-arrival-rate',
      rate: allocRps(weights.phraseQuery),
      timeUnit: '1s',
      duration: duration,
      preAllocatedVUs: vus,
      maxVUs: vus * 2,
      exec: 'phraseQueryFlow',
    },
    paginatedQuery: {
      executor: 'constant-arrival-rate',
      rate: allocRps(weights.paginatedQuery),
      timeUnit: '1s',
      duration: duration,
      preAllocatedVUs: vus,
      maxVUs: vus * 2,
      exec: 'paginatedQueryFlow',
    },
    targetedQuery: {
      executor: 'constant-arrival-rate',
      rate: allocRps(weights.targetedQuery),
      timeUnit: '1s',
      duration: duration,
      preAllocatedVUs: vus,
      maxVUs: vus * 2,
      exec: 'targetedQueryFlow',
    },
  },
  thresholds,
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  noVUConnectionReuse: false,
};

export function setup() {
  return loadSeed();
}

export function shortQueryFlow(seed) {
  const idx = (__VU - 1) * 1000 + __ITER;
  const q = pickQueryFromGroup(seed, 'short', idx);
  const res = postGraphQL(SEARCH_QUERY, { query: q.query, page: 1, limit: 10 }, { group: 'shortQuery' });
  searchDuration.add(res.timings.duration);
  checkOk(res, 'shortQuery');
  if (res.status !== 200 || res.error_code !== 0) searchErrors.add(1);
}

export function phraseQueryFlow(seed) {
  const idx = (__VU - 1) * 1000 + __ITER;
  const q = pickQueryFromGroup(seed, 'phrase', idx);
  const res = postGraphQL(SEARCH_QUERY, { query: q.query, page: 1, limit: 10 }, { group: 'phraseQuery' });
  searchDuration.add(res.timings.duration);
  checkOk(res, 'phraseQuery');
  if (res.status !== 200 || res.error_code !== 0) searchErrors.add(1);
}

export function paginatedQueryFlow(seed) {
  const idx = (__VU - 1) * 1000 + __ITER;
  const q = pickQueryFromGroup(seed, 'short', idx);
  const page = Math.floor(Math.random() * 10) + 2;
  const res = postGraphQL(SEARCH_QUERY, { query: q.query, page, limit: 10 }, { group: 'paginatedQuery' });
  searchDuration.add(res.timings.duration);
  checkOk(res, 'paginatedQuery');
  if (res.status !== 200 || res.error_code !== 0) searchErrors.add(1);
}

export function targetedQueryFlow(seed) {
  const idx = (__VU - 1) * 1000 + __ITER;
  const postId = pickPostId(seed, idx);
  const res = postGraphQL(SEARCH_QUERY, { query: postId.replace('post_', '').slice(0, 12), page: 1, limit: 5 }, { group: 'targetedQuery' });
  searchDuration.add(res.timings.duration);
  checkOk(res, 'targetedQuery');
  if (res.status !== 200 || res.error_code !== 0) searchErrors.add(1);
}
