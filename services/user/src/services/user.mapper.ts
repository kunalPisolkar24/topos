import { User } from '../generated/prisma/client';
import { UserResponse } from './interfaces/user.service.interface';

export const toUserResponse = (user: User): UserResponse => ({
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
    createdAt: user.createdAt.toISOString(),
});
