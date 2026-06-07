import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CachedUserService } from '../../src/services/user.service.cached';
import { IUserService } from '../../src/services/interfaces/user.service.interface';
import Keyv from 'keyv';

const USER_KEY = 'user:v1:1';
const MISSING_KEY = 'user:v1:missing:1';
const NEGATIVE_MARKER = 1;

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

    it('signup should pass through and warm cache', async () => {
        const authResponse = { user: { id: 1 }, token: 'token' } as any;
        (mockService.signup as any).mockResolvedValue(authResponse);

        await expect(cachedService.signup({} as any)).resolves.toEqual(authResponse);
        expect(mockService.signup).toHaveBeenCalled();
        expect(mockCache.set).toHaveBeenCalledWith(USER_KEY, authResponse.user, expect.any(Number));
    });

    it('signin should pass through and warm cache', async () => {
        const authResponse = { user: { id: 1 }, token: 'token' } as any;
        (mockService.signin as any).mockResolvedValue(authResponse);

        await expect(cachedService.signin({} as any)).resolves.toEqual(authResponse);
        expect(mockService.signin).toHaveBeenCalled();
        expect(mockCache.set).toHaveBeenCalledWith(USER_KEY, authResponse.user, expect.any(Number));
    });

    describe('findById', () => {
        it('should return cached value if hit', async () => {
            const user = { id: 1 };
            (mockCache.get as any).mockResolvedValueOnce(user).mockResolvedValueOnce(undefined);

            const result = await cachedService.findById(1);
            expect(result).toEqual(user);
            expect(mockService.findById).not.toHaveBeenCalled();
        });

        it('should return null when negative cache hits', async () => {
            (mockCache.get as any)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(NEGATIVE_MARKER);

            const result = await cachedService.findById(1);
            expect(result).toBeNull();
            expect(mockService.findById).not.toHaveBeenCalled();
        });

        it('should call service and cache result if miss', async () => {
            (mockCache.get as any)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(undefined);
            (mockService.findById as any).mockResolvedValue({ id: 1 });

            const result = await cachedService.findById(1);
            expect(result).toEqual({ id: 1 });
            expect(mockCache.set).toHaveBeenCalledWith(USER_KEY, { id: 1 }, expect.any(Number));
        });

        it('should write a negative cache entry when user is missing', async () => {
            (mockCache.get as any)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(undefined);
            (mockService.findById as any).mockResolvedValue(null);

            const result = await cachedService.findById(1);
            expect(result).toBeNull();
            expect(mockCache.set).toHaveBeenCalledWith(MISSING_KEY, NEGATIVE_MARKER, expect.any(Number));
        });

        it('should handle cache errors gracefully on read', async () => {
            (mockCache.get as any).mockRejectedValue(new Error('Redis down'));
            (mockService.findById as any).mockResolvedValue({ id: 1 });

            const result = await cachedService.findById(1);
            expect(result).toEqual({ id: 1 });
        });

        it('should handle cache errors gracefully on write', async () => {
            (mockCache.get as any)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(undefined);
            (mockService.findById as any).mockResolvedValue({ id: 1 });
            (mockCache.set as any).mockRejectedValue(new Error('Redis down'));

            const result = await cachedService.findById(1);
            expect(result).toEqual({ id: 1 });
        });
    });

    describe('findByIds', () => {
        it('returns an empty array for an empty id list', async () => {
            const result = await cachedService.findByIds([] as readonly number[]);
            expect(result).toEqual([]);
        });

        it('uses cached entries without hitting the service', async () => {
            (mockCache.get as any)
                .mockResolvedValueOnce({ id: 1 })
                .mockResolvedValueOnce({ id: 2 })
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined);

            const result = await cachedService.findByIds([1, 2]);
            expect(result).toEqual([{ id: 1 }, { id: 2 }]);
            expect(mockService.findByIds).not.toHaveBeenCalled();
        });

        it('fetches only the missing ids from the service', async () => {
            (mockCache.get as any)
                .mockResolvedValueOnce({ id: 1 })
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined);
            (mockService.findByIds as any).mockResolvedValue([{ id: 2 }]);

            const result = await cachedService.findByIds([1, 2]);
            expect(result).toEqual([{ id: 1 }, { id: 2 }]);
            expect(mockService.findByIds).toHaveBeenCalledWith([2]);
        });
    });

    describe('updateProfile', () => {
        it('should update and refresh cache', async () => {
            const updatedUser = { id: 1, name: 'New' };
            (mockService.updateProfile as any).mockResolvedValue(updatedUser);

            const result = await cachedService.updateProfile(1, { name: 'New' });
            expect(result).toEqual(updatedUser);
            expect(mockCache.set).toHaveBeenCalledWith(USER_KEY, updatedUser, expect.any(Number));
        });

        it('should handle cache write errors by falling back to delete', async () => {
            (mockService.updateProfile as any).mockResolvedValue({ id: 1 });
            (mockCache.set as any).mockRejectedValue(new Error('Fail'));

            await expect(cachedService.updateProfile(1, {})).resolves.not.toThrow();
            expect(mockCache.delete).toHaveBeenCalledWith(USER_KEY);
        });
    });

    it('findAll should pass through', async () => {
        await cachedService.findAll({ limit: 10 });
        expect(mockService.findAll).toHaveBeenCalled();
    });
});
