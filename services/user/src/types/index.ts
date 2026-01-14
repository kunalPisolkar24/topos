import { z } from 'zod';

export const signupSchema = z.object({
    email: z.string().email(),
    username: z.string().min(3),
    password: z.string().min(6),
});

export const signinSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export const updateProfileSchema = z.object({
    name: z.string().min(1).optional(),
    bio: z.string().nullable().optional(),
    avatarUrl: z.string().url().nullable().optional(),
    bannerUrl: z.string().url().nullable().optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;