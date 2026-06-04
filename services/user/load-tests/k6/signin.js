import {
    postGraphQL,
    checkOk,
    parseBody,
    getDefaultOptions,
    authDuration,
    authErrors,
    signinSuccess,
    signinInvalidCreds,
    SIGNIN_MUTATION,
    loadSeed,
    pickUser,
    CONSTANTS,
} from './shared.js';

const vus = parseInt(__ENV.VUS) || 10;
const duration = __ENV.DURATION || '30s';
const rps = parseInt(__ENV.RPS) || 10;

export const options = getDefaultOptions({ vus, duration, rps });

export function setup() {
    return loadSeed();
}

export default function (seed) {
    const idx = (__VU - 1) * 1000 + __ITER;
    const user = pickUser(seed, idx);
    const res = postGraphQL(SIGNIN_MUTATION, { email: user.email, password: user.password }, null, 'auth');
    authDuration.add(res.timings.duration);
    checkOk(res, 'signin');

    if (res.status === CONSTANTS.HTTP_UNAUTHORIZED) {
        signinInvalidCreds.add(1);
        return;
    }
    const body = parseBody(res);
    if (res.status === CONSTANTS.HTTP_OK && body && body.data && body.data.signin && body.data.signin.token) {
        signinSuccess.add(1);
        return;
    }
    authErrors.add(1);
}
