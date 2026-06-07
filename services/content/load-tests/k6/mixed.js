import {
    postGraphQL,
    checkOk,
    parseBody,
    readDuration,
    writeDuration,
    e2eDuration,
    createSuccess,
    createConflict,
    createErrors,
    verifySuccess,
    verifyTimeout,
    POSTS_QUERY,
    POST_QUERY,
    TAGS_QUERY,
    POSTS_BY_TAG_QUERY,
    CREATE_POST_MUTATION,
    loadSeed,
    pickPost,
    pickToken,
    pickTag,
    genPostContent,
} from './shared.js';

const vus = parseInt(__ENV.VUS) || 20;
const duration = __ENV.DURATION || '30s';
const rps = parseInt(__ENV.RPS) || 50;

function parseWeights(env) {
    const defaults = { reads: 50, post: 20, tag: 10, bytag: 10, create: 10 };
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

const readThresholds = {
    'http_req_duration{group:read}': ['p(95)<200', 'p(99)<500'],
    'http_req_failed{group:read}': ['rate<0.01'],
};

const writeThresholds = {
    'http_req_duration{group:write}': ['p(95)<1500', 'p(99)<3000'],
    'http_req_failed{group:write}': ['rate<0.02'],
    create_success: ['count>' + Math.max(1, Math.round(rps * durationToSec(duration) * 0.01))],
};

export const options = {
    scenarios: {
        reads: {
            executor: 'constant-arrival-rate',
            rate: allocRps(weights.reads),
            timeUnit: '1s',
            duration: duration,
            preAllocatedVUs: vus,
            maxVUs: vus * 2,
            exec: 'readsFlow',
        },
        post: {
            executor: 'constant-arrival-rate',
            rate: allocRps(weights.post),
            timeUnit: '1s',
            duration: duration,
            preAllocatedVUs: vus,
            maxVUs: vus * 2,
            exec: 'postFlow',
        },
        tag: {
            executor: 'constant-arrival-rate',
            rate: allocRps(weights.tag),
            timeUnit: '1s',
            duration: duration,
            preAllocatedVUs: vus,
            maxVUs: vus * 2,
            exec: 'tagFlow',
        },
        bytag: {
            executor: 'constant-arrival-rate',
            rate: allocRps(weights.bytag),
            timeUnit: '1s',
            duration: duration,
            preAllocatedVUs: vus,
            maxVUs: vus * 2,
            exec: 'bytagFlow',
        },
        create: {
            executor: 'constant-arrival-rate',
            rate: allocRps(weights.create),
            timeUnit: '1s',
            duration: duration,
            preAllocatedVUs: vus,
            maxVUs: vus * 2,
            exec: 'createFlow',
        },
    },
    thresholds: { ...readThresholds, ...writeThresholds },
    summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
    noVUConnectionReuse: false,
};

export function setup() {
    return loadSeed();
}

export function readsFlow() {
    const page = (__VU + __ITER) % 5 + 1;
    const res = postGraphQL(POSTS_QUERY, { page, limit: 10 }, null, 'read');
    readDuration.add(res.timings.duration);
    checkOk(res, 'posts');
}

export function postFlow(seed) {
    const idx = (__VU - 1) * 1000 + __ITER;
    const post = pickPost(seed, idx);
    const res = postGraphQL(POST_QUERY, { id: post.id }, null, 'read');
    readDuration.add(res.timings.duration);
    checkOk(res, 'post');
}

export function tagFlow() {
    const res = postGraphQL(TAGS_QUERY, { query: '', limit: 20 }, null, 'read');
    readDuration.add(res.timings.duration);
    checkOk(res, 'tags');
}

export function bytagFlow(seed) {
    const idx = (__VU - 1) * 1000 + __ITER;
    const tag = pickTag(seed, idx);
    const page = (__VU + __ITER) % 5 + 1;
    const res = postGraphQL(POSTS_BY_TAG_QUERY, { tag, page, limit: 10 }, null, 'read');
    readDuration.add(res.timings.duration);
    checkOk(res, 'bytag');
}

export function createFlow(seed) {
    const idx = (__VU - 1) * 1000 + __ITER;
    const token = pickToken(seed, idx);
    const input = genPostContent(__VU, __ITER);

    const res = postGraphQL(CREATE_POST_MUTATION, { input }, token, 'write');
    writeDuration.add(res.timings.duration);

    if (res.status === 409) {
        createConflict.add(1);
        return;
    }

    const body = parseBody(res);
    if (res.status === 200 && body && body.data && body.data.createPost) {
        createSuccess.add(1);
        return;
    }

    createErrors.add(1);
}
