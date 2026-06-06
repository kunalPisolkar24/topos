import { postGraphQL, checkOk, getDefaultOptions, readDuration, POSTS_QUERY } from './shared.js';

const vus = parseInt(__ENV.VUS) || 20;
const duration = __ENV.DURATION || '30s';
const rps = parseInt(__ENV.RPS) || 50;

export const options = getDefaultOptions({ vus, duration, rps });

export default function () {
    const page = (__VU + __ITER) % 5 + 1;
    const res = postGraphQL(POSTS_QUERY, { page, limit: 10 }, null, 'read');
    readDuration.add(res.timings.duration);
    checkOk(res, 'posts-list');
}
