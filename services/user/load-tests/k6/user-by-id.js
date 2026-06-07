import { postGraphQL, checkOk, getDefaultOptions, readDuration, USER_QUERY, loadSeed, pickUser } from './shared.js';

const vus = parseInt(__ENV.VUS) || 20;
const duration = __ENV.DURATION || '30s';
const rps = parseInt(__ENV.RPS) || 50;

export const options = getDefaultOptions({ vus, duration, rps });

export function setup() {
    return loadSeed();
}

export default function (seed) {
    const idx = (__VU - 1) * 1000 + __ITER;
    const user = pickUser(seed, idx);
    const res = postGraphQL(USER_QUERY, { id: String(user.id) }, null, 'read');
    readDuration.add(res.timings.duration);
    checkOk(res, 'user-by-id');
}
