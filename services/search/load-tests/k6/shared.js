import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.TARGET || 'http://search-api:4003';
const GRAPHQL_PATH = `${BASE_URL}/graphql`;
const SEED_DIR = __ENV.SEED_DIR || '/load-tests/seed_data';

export const searchDuration = new Trend('search_duration', true);
export const cacheHitDuration = new Trend('cache_hit_duration', true);
export const cacheMissDuration = new Trend('cache_miss_duration', true);
export const searchErrors = new Counter('search_errors');

export const SEARCH_QUERY = `
  query SearchPosts($query: String!, $page: Int, $limit: Int) {
    searchPosts(query: $query, page: $page, limit: $limit) {
      hits { id }
      total
    }
  }
`;

const _rawPostIds = open(`${SEED_DIR}/post_ids.json`);
const _rawQueries = open(`${SEED_DIR}/queries.json`);
const _rawQueryGroups = open(`${SEED_DIR}/query_groups.json`);

export function loadSeed() {
  const postIds = JSON.parse(_rawPostIds);
  const queries = JSON.parse(_rawQueries);
  const queryGroups = JSON.parse(_rawQueryGroups);
  if (!Array.isArray(postIds) || postIds.length === 0) {
    throw new Error(`seed post_ids.json empty or missing at ${SEED_DIR}`);
  }
  if (!Array.isArray(queries) || queries.length === 0) {
    throw new Error(`seed queries.json empty or missing at ${SEED_DIR}`);
  }
  return { postIds, queries, queryGroups };
}

export function pickPostId(seed, index) {
  return seed.postIds[index % seed.postIds.length];
}

export function pickQuery(seed, index) {
  return seed.queries[index % seed.queries.length];
}

export function pickQueryFromGroup(seed, group, index) {
  const pool = seed.queryGroups[group];
  if (!pool || pool.length === 0) {
    return seed.queries[index % seed.queries.length];
  }
  return pool[index % pool.length];
}

export function postGraphQL(query, variables, tags) {
  const body = JSON.stringify({ query, variables: variables || {} });
  const headers = { 'Content-Type': 'application/json' };
  return http.post(GRAPHQL_PATH, body, { headers, tags });
}

export function checkOk(res, name) {
  return check(res, {
    [`${name} status 200`]: (r) => r.status === 200,
    [`${name} no http error`]: (r) => r.error_code === 0,
    [`${name} no graphql errors`]: (r) => {
      if (r.status !== 200) return true;
      try {
        const body = JSON.parse(r.body);
        return !body.errors || body.errors.length === 0;
      } catch (_) {
        return false;
      }
    },
  });
}

export function parseBody(res) {
  try {
    return JSON.parse(res.body);
  } catch (_) {
    return null;
  }
}

export function getDefaultOptions({ vus, duration, rps, thresholds }) {
  const t = thresholds || {
    'http_req_duration{group:search}': ['p(95)<500', 'p(99)<1500'],
    'http_req_failed{group:search}': ['rate<0.01'],
  };
  return {
    scenarios: {
      default: {
        executor: 'constant-arrival-rate',
        rate: rps,
        timeUnit: '1s',
        duration: duration,
        preAllocatedVUs: vus,
        maxVUs: vus * 2,
      },
    },
    thresholds: t,
    summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
    noVUConnectionReuse: false,
  };
}
