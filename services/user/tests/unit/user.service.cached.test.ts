import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CachedUserService } from '../../src/services/user.service.cached';
import { IUserService } from '../../src/services/interfaces/user.service.interface';
import Keyv from 'keyv';

describe('CachedUserService', () => {
    let cachedService: CachedUserService;
    let mockService: IUserService;
    let mockCache: Keyv;

    beforeEach(() => {
        mockService = {
            signup: vi.fn(),
            signin: vi.fn(),
            findById: vi.fn(),
            findByIds: vi.fn(),
            findAll: vi.fn(),
            updateProfile: vi.fn(),
        };

        mockCache = {
            get: vi.fn(),
            set: vi.fn(),
            delete: vi.fn(),
        } as unknown as Keyv;

        cachedService = new CachedUserService(mockService, mockCache);
    });

    it('signup should pass through', async () => {
        const authResponse = { user: { id: 1 }, token: 'token' } as any;
        (mockService.signup as any).mockResolvedValue(authResponse);

        await expect(cachedService.signup({} as any)).resolves.toEqual(authResponse);
        expect(mockService.signup).toHaveBeenCalled();
        expect(mockCache.set).toHaveBeenCalledWith('user:1', authResponse.user, expect.any(Number));
    });

    it('signin should pass through', async () => {
        const authResponse = { user: { id: 1 }, token: 'token' } as any;
        (mockService.signin as any).mockResolvedValue(authResponse);

        await expect(cachedService.signin({} as any)).resolves.toEqual(authResponse);
        expect(mockService.signin).toHaveBeenCalled();
        expect(mockCache.set).toHaveBeenCalledWith('user:1', authResponse.user, expect.any(Number));
    });

    describe('findById', () => {
        it('should return cached value if hit', async () => {
            const user = { id: 1 };
            (mockCache.get as any).mockResolvedValue(user);

            const result = await cachedService.findById(1);
            expect(result).toEqual(user);
            expect(mockService.findById).not.toHaveBeenCalled();
        });

        it('should call service and cache result if miss', async () => {
            const user = { id: 1 };
            (mockCache.get as any).mockResolvedValue(null);
            (mockService.findById as any).mockResolvedValue(user);

            const result = await cachedService.findById(1);
            expect(result).toEqual(user);
            expect(mockCache.set).toHaveBeenCalledWith('user:1', user, expect.any(Number));
        });

        it('should handle cache errors gracefully on read', async () => {
            (mockCache.get as any).mockRejectedValue(new Error('Redis down'));
            (mockService.findById as any).mockResolvedValue({ id: 1 });

            const result = await cachedService.findById(1);
            expect(result).toEqual({ id: 1 });
        });

        it('should handle cache errors gracefully on write', async () => {
            (mockCache.get as any).mockResolvedValue(null);
            (mockService.findById as any).mockResolvedValue({ id: 1 });
            (mockCache.set as any).mockRejectedValue(new Error('Redis down'));

            const result = await cachedService.findById(1);
            expect(result).toEqual({ id: 1 });
        });
    });

    describe('findByIds', () => {
        it('should map calls to findById', async () => {
            const user1 = { id: 1 };
            const user2 = { id: 2 };
            (mockCache.get as any).mockResolvedValueOnce(user1).mockResolvedValueOnce(user2);

            const result = await cachedService.findByIds([1, 2]);
            expect(result).toEqual([user1, user2]);
        });
    });

    describe('updateProfile', () => {
        it('should update and refresh cache', async () => {
            const updatedUser = { id: 1, name: 'New' };
            (mockService.updateProfile as any).mockResolvedValue(updatedUser);

            const result = await cachedService.updateProfile(1, { name: 'New' });
            expect(result).toEqual(updatedUser);
            expect(mockCache.set).toHaveBeenCalledWith('user:1', updatedUser, expect.any(Number));
        });

        it('should handle cache write errors by falling back to delete', async () => {
            (mockService.updateProfile as any).mockResolvedValue({ id: 1 });
            (mockCache.set as any).mockRejectedValue(new Error('Fail'));

            await expect(cachedService.updateProfile(1, {})).resolves.not.toThrow();
            expect(mockCache.delete).toHaveBeenCalledWith('user:1');
        });
    });

    it('findAll should pass through', async () => {
        await cachedService.findAll({ limit: 10 });
        expect(mockService.findAll).toHaveBeenCalled();
    });
});
