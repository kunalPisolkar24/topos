import { postGraphQL, checkOk, getDefaultOptions, readDuration, USERS_QUERY } from './shared.js';

const vus = parseInt(__ENV.VUS) || 20;
const duration = __ENV.DURATION || '30s';
const rps = parseInt(__ENV.RPS) || 50;

export const options = getDefaultOptions({ vus, duration, rps });

export default function () {
    const res = postGraphQL(USERS_QUERY, { limit: 20, cursor: null }, null, 'read');
    readDuration.add(res.timings.duration);
    checkOk(res, 'users-list');
}
