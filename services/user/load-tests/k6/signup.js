import {
    postGraphQL,
    checkOk,
    parseBody,
    getDefaultOptions,
    authDuration,
    authErrors,
    signupSuccess,
    signupConflict,
    SIGNUP_MUTATION,
    genSignupCreds,
    CONSTANTS,
} from './shared.js';

const vus = parseInt(__ENV.VUS) || 10;
const duration = __ENV.DURATION || '30s';
const rps = parseInt(__ENV.RPS) || 5;

export const options = getDefaultOptions({ vus, duration, rps });

export default function () {
    const creds = genSignupCreds(__VU, __ITER);
    const res = postGraphQL(SIGNUP_MUTATION, creds, null, 'auth');
    authDuration.add(res.timings.duration);
    checkOk(res, 'signup');

    const body = parseBody(res);
    if (res.status === CONSTANTS.HTTP_CONFLICT) {
        signupConflict.add(1);
        return;
    }
    if (res.status === CONSTANTS.HTTP_OK && body && body.data && body.data.signup && body.data.signup.token) {
        signupSuccess.add(1);
        return;
    }
    authErrors.add(1);
}
