import { postGraphQL, checkOk, writeDuration, e2eDuration, CREATE_POST_MUTATION, POST_QUERY, genPostContent, pickToken, loadSeed, createSuccess, createConflict, createErrors, verifySuccess, verifyTimeout } from './shared.js';

const vus = parseInt(__ENV.VUS) || 10;
const duration = __ENV.DURATION || '60s';
const rps = parseInt(__ENV.RPS) || 10;

const e2eThresholds = {
    'http_req_duration{group:write}': ['p(95)<2000', 'p(99)<4000'],
    'http_req_duration{group:read}': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed{group:write}': ['rate<0.02'],
    'http_req_failed{group:read}': ['rate<0.01'],
    e2e_latency: ['p(95)<8000'],
    create_success: ['rate>0.85'],
    verify_success: ['rate>0.8'],
};

export const options = {
    scenarios: {
        e2e: {
            executor: 'constant-arrival-rate',
            rate: rps,
            timeUnit: '1s',
            duration: duration,
            preAllocatedVUs: vus,
            maxVUs: vus * 2,
            exec: 'e2eFlow',
        },
    },
    thresholds: e2eThresholds,
    summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
    noVUConnectionReuse: false,
};

export function setup() {
    return loadSeed();
}

export function e2eFlow(seed) {
    const idx = (__VU - 1) * 1000 + __ITER;
    const token = pickToken(seed, idx);
    const input = genPostContent(__VU, __ITER);
    const start = Date.now();

    const createRes = postGraphQL(CREATE_POST_MUTATION, { input }, token, 'write');
    writeDuration.add(createRes.timings.duration);

    if (createRes.status !== 200) {
        createErrors.add(1);
        return;
    }

    const createBody = JSON.parse(createRes.body);
    if (!createBody || !createBody.data || !createBody.data.createPost) {
        if (createBody && createBody.errors && createBody.errors[0] && createBody.errors[0].extensions && createBody.errors[0].extensions.code === 'CONFLICT') {
            createConflict.add(1);
        } else {
            createErrors.add(1);
        }
        return;
    }

    createSuccess.add(1);
    const postId = createBody.data.createPost.id;

    const deadline = Date.now() + 10000;
    let verified = false;
    while (Date.now() < deadline) {
        const pollRes = postGraphQL(POST_QUERY, { id: postId }, null, 'read');
        if (pollRes.status === 200) {
            const pollBody = JSON.parse(pollRes.body);
            if (pollBody && pollBody.data && pollBody.data.post) {
                const status = pollBody.data.post.summaryStatus;
                if (status === 'COMPLETED' || status === 'FAILED') {
                    verified = true;
                    break;
                }
            }
        }
    }

    const elapsed = Date.now() - start;
    e2eDuration.add(elapsed);

    if (verified) {
        verifySuccess.add(1);
    } else {
        verifyTimeout.add(1);
    }
}
