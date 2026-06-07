const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

export function extractBearerToken(authHeader: string | undefined): string | null {
    if (!authHeader) {
        return null;
    }
    const match = BEARER_PATTERN.exec(authHeader.trim());
    return match ? match[1] : null;
}
