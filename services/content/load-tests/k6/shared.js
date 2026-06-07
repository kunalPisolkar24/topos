import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';

const BASE_URL = __ENV.TARGET || 'http://content-service:4002';
const GRAPHQL_PATH = `${BASE_URL}/query`;
const OUTPUT_DIR = 'seed_data';

const HTTP_OK = 200;

export const readDuration = new Trend('read_duration', true);
export const writeDuration = new Trend('write_duration', true);
export const e2eDuration = new Trend('e2e_latency', true);
export const createSuccess = new Counter('create_success');
export const createConflict = new Counter('create_conflict');
export const createErrors = new Counter('create_errors');
export const verifySuccess = new Counter('verify_success');
export const verifyTimeout = new Counter('verify_timeout');

export const POSTS_QUERY = `
    query Posts($page: Int, $limit: Int) {
        posts(page: $page, limit: $limit) {
            posts { id title slug summaryStatus }
            totalPages currentPage totalPosts
        }
    }
`;

export const POST_QUERY = `
    query Post($id: ID!) {
        post(id: $id) {
            id title body slug summary summaryStatus tags { name }
            createdAt updatedAt
        }
    }
`;

export const TAGS_QUERY = `
    query Tags($query: String, $limit: Int) {
        tags(query: $query, limit: $limit) {
            id name
        }
    }
`;

export const POSTS_BY_TAG_QUERY = `
    query PostsByTag($tag: String!, $page: Int, $limit: Int) {
        postsByTag(tag: $tag, page: $page, limit: $limit) {
            posts { id title slug }
            totalPages currentPage totalPosts
        }
    }
`;

export const CREATE_POST_MUTATION = `
    mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
            id title slug summaryStatus
        }
    }
`;

const _rawPosts = open(`${OUTPUT_DIR}/posts.json`);
const _rawTokens = open(`${OUTPUT_DIR}/tokens.json`);
const _rawTags = open(`${OUTPUT_DIR}/tags.json`);

export function loadSeed() {
    const posts = JSON.parse(_rawPosts);
    const tokens = JSON.parse(_rawTokens);
    const tags = JSON.parse(_rawTags);
    if (!Array.isArray(posts) || posts.length === 0) {
        throw new Error(`seed posts.json empty or missing at ${OUTPUT_DIR}`);
    }
    if (!Array.isArray(tokens) || tokens.length === 0) {
        throw new Error(`tokens.json empty or missing`);
    }
    const ids = posts.map((p) => p.id);
    return { posts, tokens, tags, ids };
}

export function pickPost(seed, index) {
    return seed.posts[index % seed.posts.length];
}

export function pickToken(seed, index) {
    return seed.tokens[index % seed.tokens.length];
}

export function pickTag(seed, index) {
    return seed.tags[index % seed.tags.length];
}

export function genPostContent(vuId, iter) {
    const nonce = `${vuId}_${iter}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    const suffix = nonce.slice(0, 16);
    const hash = crypto.sha256(`loadtest:${suffix}`, 'hex');
    return {
        title: `Load Test Post ${suffix}`,
        body: `This is a load test post body created at ${new Date().toISOString()}. The hash is ${hash.slice(0, 32)}. `.repeat(20),
        tags: ['loadtest', 'benchmark', 'k6'],
    };
}

export function postGraphQL(query, variables, token, group) {
    const body = JSON.stringify({ query, variables: variables || {} });
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const tags = group ? { group } : {};
    return http.post(GRAPHQL_PATH, body, { headers, tags });
}

export function checkOk(res, name) {
    return check(res, {
        [`${name} status 200`]: (r) => r.status === HTTP_OK,
        [`${name} no http error`]: (r) => r.error_code === 0,
        [`${name} no graphql errors`]: (r) => {
            if (r.status !== HTTP_OK) return true;
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

export function getDefaultOptions({ vus, duration, rps, readThresholds, writeThresholds, e2eThresholds }) {
    const readT = readThresholds || {
        'http_req_duration{group:read}': ['p(95)<200', 'p(99)<500'],
        'http_req_failed{group:read}': ['rate<0.01'],
    };
    const writeT = writeThresholds || {
        'http_req_duration{group:write}': ['p(95)<1500', 'p(99)<3000'],
        'http_req_failed{group:write}': ['rate<0.02'],
    };
    const e2eT = e2eThresholds || {
        'e2e_latency': ['p(95)<5000'],
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
        thresholds: { ...readT, ...writeT, ...e2eT },
        summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
        noVUConnectionReuse: false,
    };
}
