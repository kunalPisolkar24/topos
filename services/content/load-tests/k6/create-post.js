import { postGraphQL, checkOk, getDefaultOptions, writeDuration, CREATE_POST_MUTATION, genPostContent, pickToken, loadSeed, createSuccess, createConflict, createErrors } from './shared.js';

const vus = parseInt(__ENV.VUS) || 20;
const duration = __ENV.DURATION || '30s';
const rps = parseInt(__ENV.RPS) || 50;

const writeThresholds = {
    'http_req_duration{group:write}': ['p(95)<1500', 'p(99)<3000'],
    'http_req_failed{group:write}': ['rate<0.02'],
    create_success: ['rate>0.9'],
};

export const options = getDefaultOptions({ vus, duration, rps, writeThresholds });

export function setup() {
    return loadSeed();
}

export default function (seed) {
    const idx = (__VU - 1) * 1000 + __ITER;
    const token = pickToken(seed, idx);
    const input = genPostContent(__VU, __ITER);

    const res = postGraphQL(CREATE_POST_MUTATION, { input }, token, 'write');
    writeDuration.add(res.timings.duration);

    const ok = checkOk(res, 'create-post');

    if (res.status === 409) {
        createConflict.add(1);
        return;
    }

    const body = JSON.parse(res.body);
    if (ok && body && body.data && body.data.createPost) {
        createSuccess.add(1);
        return;
    }

    createErrors.add(1);
}
