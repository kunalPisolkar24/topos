export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
}

const USERNAME_PATTERN = /^[a-z0-9_]+$/;
const STRONG_PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{12,128}$/;
const URL_PATTERN = /^https?:\/\//;

export const ValidationPatterns = {
    username: USERNAME_PATTERN,
    strongPassword: STRONG_PASSWORD_PATTERN,
    httpUrl: URL_PATTERN,
};
