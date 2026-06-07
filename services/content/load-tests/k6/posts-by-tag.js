import { postGraphQL, checkOk, getDefaultOptions, readDuration, POSTS_BY_TAG_QUERY, loadSeed, pickTag } from './shared.js';

const vus = parseInt(__ENV.VUS) || 20;
const duration = __ENV.DURATION || '30s';
const rps = parseInt(__ENV.RPS) || 50;

export const options = getDefaultOptions({ vus, duration, rps });

export function setup() {
    return loadSeed();
}

export default function (seed) {
    const idx = (__VU - 1) * 1000 + __ITER;
    const tag = pickTag(seed, idx);
    const page = (__VU + __ITER) % 5 + 1;
    const res = postGraphQL(POSTS_BY_TAG_QUERY, { tag, page, limit: 10 }, null, 'read');
    readDuration.add(res.timings.duration);
    checkOk(res, 'posts-by-tag');
}
