import { describe, it, expect, vi, beforeEach } from 'vitest';
import Keyv from 'keyv';
import { composeApp } from '../../src/composition';
import { CacheBackend } from '../../src/lib/cache';
import { prismaMock } from '../mocks/prisma';
import { PasswordHasher } from '../../src/utils/passwordHasher';
import { TokenService } from '../../src/utils/tokenService';

function makeHasher(): PasswordHasher {
    return {
        hash: vi.fn().mockResolvedValue('hashed'),
        verify: vi.fn().mockResolvedValue(false),
        getDummyHash: vi.fn().mockResolvedValue('dummy'),
    };
}

function makeTokens(): TokenService {
    return {
        sign: vi.fn().mockReturnValue('token'),
        verify: vi.fn().mockReturnValue(null),
    };
}

function makeBackend(): CacheBackend & { disconnectSpy: ReturnType<typeof vi.fn> } {
    const disconnectSpy = vi.fn().mockResolvedValue(undefined);
    return {
        id: 'memory',
        supportsApollo: false,
        create: vi.fn(() => new Keyv()),
        disconnect: disconnectSpy,
        disconnectSpy,
    };
}

describe('composeApp', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('wires together UserService, ApolloServer, and a cache backend', async () => {
        const backend = makeBackend();
        const composed = await composeApp({
            prisma: prismaMock as any,
            cacheBackend: backend,
            passwordHasher: makeHasher(),
            tokenService: makeTokens(),
        });

        expect(backend.create).toHaveBeenCalled();
        expect(composed.apolloServer).toBeDefined();
        expect(composed.userService).toBeDefined();
        expect(composed.serviceCache).toBeDefined();
        expect(typeof composed.shutdown).toBe('function');
        await composed.shutdown();
    });

    it('shutdown stops the apollo server and disconnects the cache', async () => {
        const backend = makeBackend();
        const composed = await composeApp({
            prisma: prismaMock as any,
            cacheBackend: backend,
            passwordHasher: makeHasher(),
            tokenService: makeTokens(),
        });

        const stopSpy = vi.spyOn(composed.apolloServer, 'stop').mockResolvedValue(undefined);
        await composed.shutdown();
        expect(stopSpy).toHaveBeenCalled();
        expect(backend.disconnectSpy).toHaveBeenCalled();
    });
});
