import { postGraphQL, checkOk, getDefaultOptions, readDuration, ME_QUERY, loadSeed, pickToken } from './shared.js';

const vus = parseInt(__ENV.VUS) || 20;
const duration = __ENV.DURATION || '30s';
const rps = parseInt(__ENV.RPS) || 50;

export const options = getDefaultOptions({ vus, duration, rps });

export function setup() {
    return loadSeed();
}

export default function (seed) {
    const idx = (__VU - 1) * 1000 + __ITER;
    const token = pickToken(seed, idx);
    const res = postGraphQL(ME_QUERY, null, token, 'read');
    readDuration.add(res.timings.duration);
    checkOk(res, 'me');
}
