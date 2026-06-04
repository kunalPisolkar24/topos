import {
    postGraphQL,
    checkOk,
    parseBody,
    readDuration,
    authDuration,
    signupSuccess,
    signupConflict,
    signinSuccess,
    signinInvalidCreds,
    authErrors,
    USERS_QUERY,
    USER_QUERY,
    ME_QUERY,
    SIGNUP_MUTATION,
    SIGNIN_MUTATION,
    loadSeed,
    pickUser,
    pickToken,
    genSignupCreds,
    CONSTANTS,
} from './shared.js';

const vus = parseInt(__ENV.VUS) || 20;
const duration = __ENV.DURATION || '30s';
const rps = parseInt(__ENV.RPS) || 50;

function parseWeights(env) {
    const defaults = { reads: 50, user: 20, me: 10, signin: 10, signup: 10 };
    if (!env) return defaults;
    const out = { ...defaults };
    for (const part of env.split(',')) {
        const [k, v] = part.split(':').map((s) => s.trim());
        if (k && v) {
            const n = parseFloat(v);
            if (Number.isFinite(n) && n >= 0) out[k] = n;
        }
    }
    return out;
}

const weights = parseWeights(__ENV.WEIGHTS);
const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

function allocRps(percent) {
    return Math.max(1, Math.round((rps * percent) / total));
}

const readThresholds = {
    'http_req_duration{group:read}': ['p(95)<300', 'p(99)<800'],
    'http_req_failed{group:read}': ['rate<0.01'],
};
const authThresholds = {
    'http_req_duration{group:auth}': ['p(95)<1500', 'p(99)<3000'],
    'http_req_failed{group:auth}': ['rate<0.02'],
    signup_conflict: ['count<' + Math.max(50, Math.round(rps * durationToSec(duration) * 0.05))],
};

function durationToSec(d) {
    const m = /^(\d+)(s|m|h)$/.exec(d);
    if (!m) return 30;
    const n = parseInt(m[1], 10);
    return n * (m[2] === 'h' ? 3600 : m[2] === 'm' ? 60 : 1);
}

export const options = {
    scenarios: {
        users: {
            executor: 'constant-arrival-rate',
            rate: allocRps(weights.reads),
            timeUnit: '1s',
            duration: duration,
            preAllocatedVUs: vus,
            maxVUs: vus * 2,
            exec: 'usersFlow',
        },
        user: {
            executor: 'constant-arrival-rate',
            rate: allocRps(weights.user),
            timeUnit: '1s',
            duration: duration,
            preAllocatedVUs: vus,
            maxVUs: vus * 2,
            exec: 'userFlow',
        },
        me: {
            executor: 'constant-arrival-rate',
            rate: allocRps(weights.me),
            timeUnit: '1s',
            duration: duration,
            preAllocatedVUs: vus,
            maxVUs: vus * 2,
            exec: 'meFlow',
        },
        signin: {
            executor: 'constant-arrival-rate',
            rate: allocRps(weights.signin),
            timeUnit: '1s',
            duration: duration,
            preAllocatedVUs: vus,
            maxVUs: vus * 2,
            exec: 'signinFlow',
        },
        signup: {
            executor: 'constant-arrival-rate',
            rate: allocRps(weights.signup),
            timeUnit: '1s',
            duration: duration,
            preAllocatedVUs: vus,
            maxVUs: vus * 2,
            exec: 'signupFlow',
        },
    },
    thresholds: { ...readThresholds, ...authThresholds },
    summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
    noVUConnectionReuse: false,
};

export function setup() {
    return loadSeed();
}

export function usersFlow() {
    const res = postGraphQL(USERS_QUERY, { limit: 20, cursor: null }, null, 'read');
    readDuration.add(res.timings.duration);
    checkOk(res, 'users');
}

export function userFlow(seed) {
    const idx = (__VU - 1) * 1000 + __ITER;
    const user = pickUser(seed, idx);
    const res = postGraphQL(USER_QUERY, { id: String(user.id) }, null, 'read');
    readDuration.add(res.timings.duration);
    checkOk(res, 'user');
}

export function meFlow(seed) {
    const idx = (__VU - 1) * 1000 + __ITER;
    const token = pickToken(seed, idx);
    const res = postGraphQL(ME_QUERY, null, token, 'read');
    readDuration.add(res.timings.duration);
    checkOk(res, 'me');
}

export function signinFlow(seed) {
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

export function signupFlow() {
    const creds = genSignupCreds(__VU, __ITER);
    const res = postGraphQL(SIGNUP_MUTATION, creds, null, 'auth');
    authDuration.add(res.timings.duration);
    checkOk(res, 'signup');
    if (res.status === CONSTANTS.HTTP_CONFLICT) {
        signupConflict.add(1);
        return;
    }
    const body = parseBody(res);
    if (res.status === CONSTANTS.HTTP_OK && body && body.data && body.data.signup && body.data.signup.token) {
        signupSuccess.add(1);
        return;
    }
    authErrors.add(1);
}
