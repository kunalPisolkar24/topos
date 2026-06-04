import http from 'k6/http';
import { check, open } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';

const BASE_URL = __ENV.TARGET || 'http://user-service:4001';
const GRAPHQL_PATH = `${BASE_URL}/graphql`;
const OUTPUT_DIR = __ENV.SEED_OUTPUT_DIR || '/out';

const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_CONFLICT = 409;
const HTTP_NOT_FOUND = 404;

export const signupSuccess = new Counter('signup_success');
export const signupConflict = new Counter('signup_conflict');
export const signinSuccess = new Counter('signin_success');
export const signinInvalidCreds = new Counter('signin_invalid_creds');
export const authErrors = new Counter('auth_errors');
export const readDuration = new Trend('read_duration', true);
export const authDuration = new Trend('auth_duration', true);

export const SIGNUP_MUTATION = `
    mutation Signup($email: String!, $username: String!, $password: String!) {
        signup(email: $email, username: $username, password: $password) {
            token
            user { id username email }
        }
    }
`;

export const SIGNIN_MUTATION = `
    mutation Signin($email: String!, $password: String!) {
        signin(email: $email, password: $password) {
            token
            user { id username }
        }
    }
`;

export const USERS_QUERY = `
    query Users($limit: Int, $cursor: ID) {
        users(limit: $limit, cursor: $cursor) {
            id
            username
            email
        }
    }
`;

export const USER_QUERY = `
    query User($id: ID!) {
        user(id: $id) {
            id
            username
            email
        }
    }
`;

export const ME_QUERY = `
    query Me {
        me {
            id
            username
            email
        }
    }
`;

export function loadSeed() {
    const users = JSON.parse(open(`${OUTPUT_DIR}/users.json`));
    const tokens = JSON.parse(open(`${OUTPUT_DIR}/tokens.json`));
    if (!Array.isArray(users) || users.length === 0) {
        throw new Error(`seed users.json empty or missing at ${OUTPUT_DIR}`);
    }
    if (!Array.isArray(tokens) || tokens.length !== users.length) {
        throw new Error(`tokens.json length mismatch with users.json`);
    }
    const ids = users.map((u) => u.id);
    return { users, tokens, ids };
}

export function pickUser(seed, index) {
    return seed.users[index % seed.users.length];
}

export function pickToken(seed, index) {
    return seed.tokens[index % seed.tokens.length];
}

export function genSignupCreds(vuId, iter) {
    const nonce = `${vuId}_${iter}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    const suffix = nonce.slice(0, 22);
    const email = `lt_${suffix}@loadtest.local`;
    const username = `lt_user_${suffix}`;
    const hash = crypto.sha256(`loadtest:${suffix}`, 'hex');
    const password = `Lt${hash.slice(0, 28)}`;
    return { email, username, password };
}

export function postGraphQL(query, variables, token, group) {
    const body = JSON.stringify({ query, variables: variables || {} });
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const tags = group ? { group } : {};
    return http.post(GRAPHQL_PATH, body, { headers, tags });
}

export function checkOk(res, name) {
    return check(res, {
        [`${name} status 200`]: (r) => r.status === HTTP_OK,
        [`${name} no http error`]: (r) => r.error_code === 0,
        [`${name} no graphql errors`]: (r) => {
            if (r.status !== HTTP_OK) return true;
            try {
                const body = JSON.parse(r.body);
                return !body.errors || body.errors.length === 0;
            } catch (_) {
                return false;
            }
        },
    });
}

export function parseBody(res) {
    try {
        return JSON.parse(res.body);
    } catch (_) {
        return null;
    }
}

export function getDefaultOptions({ vus, duration, rps, readThresholds, authThresholds }) {
    const readT = readThresholds || {
        'http_req_duration{group:read}': ['p(95)<300', 'p(99)<800'],
        'http_req_failed{group:read}': ['rate<0.01'],
    };
    const authT = authThresholds || {
        'http_req_duration{group:auth}': ['p(95)<1500', 'p(99)<3000'],
        'http_req_failed{group:auth}': ['rate<0.02'],
    };
    return {
        scenarios: {
            default: {
                executor: 'constant-arrival-rate',
                rate: rps,
                timeUnit: '1s',
                duration: duration,
                preAllocatedVUs: vus,
                maxVUs: vus * 2,
            },
        },
        thresholds: { ...readT, ...authT },
        summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
        noVUConnectionReuse: false,
    };
}

export const CONSTANTS = {
    HTTP_OK,
    HTTP_UNAUTHORIZED,
    HTTP_CONFLICT,
    HTTP_NOT_FOUND,
};
