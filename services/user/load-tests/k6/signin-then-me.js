import {
    postGraphQL,
    checkOk,
    parseBody,
    getDefaultOptions,
    authDuration,
    signinSuccess,
    signinInvalidCreds,
    authErrors,
    SIGNIN_MUTATION,
    ME_QUERY,
    loadSeed,
    pickUser,
    CONSTANTS,
} from './shared.js';

const vus = parseInt(__ENV.VUS) || 10;
const duration = __ENV.DURATION || '30s';
const rps = parseInt(__ENV.RPS) || 5;

export const options = getDefaultOptions({ vus, duration, rps });

export function setup() {
    return loadSeed();
}

export default function (seed) {
    const idx = (__VU - 1) * 1000 + __ITER;
    const user = pickUser(seed, idx);

    const signinRes = postGraphQL(
        SIGNIN_MUTATION,
        { email: user.email, password: user.password },
        null,
        'auth'
    );
    authDuration.add(signinRes.timings.duration);
    if (signinRes.status === CONSTANTS.HTTP_UNAUTHORIZED) {
        signinInvalidCreds.add(1);
        return;
    }
    const signinBody = parseBody(signinRes);
    const token = signinBody && signinBody.data && signinBody.data.signin && signinBody.data.signin.token;
    if (!token) {
        authErrors.add(1);
        return;
    }
    signinSuccess.add(1);

    const meRes = postGraphQL(ME_QUERY, null, token, 'read');
    checkOk(meRes, 'me-after-signin');
}
