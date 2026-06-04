import { z } from 'zod';
import { normalizeEmail, normalizeUsername, ValidationPatterns } from '../utils/normalize';

const usernameSchema = z
    .string()
    .transform(normalizeUsername)
    .pipe(
        z
            .string()
            .min(3)
            .max(30)
            .regex(ValidationPatterns.username, 'Username may only contain lowercase letters, digits, and underscores')
    );

const emailSchema = z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.string().email());

const strongPasswordSchema = z
    .string()
    .min(12)
    .max(128)
    .regex(
        ValidationPatterns.strongPassword,
        'Password must be 12-128 characters and include both letters and digits'
    );

const signinPasswordSchema = z.string().min(1).max(128);

const httpUrlSchema = z
    .string()
    .url()
    .max(2048)
    .refine((value) => ValidationPatterns.httpUrl.test(value), 'URL must use http or https');

export const signupSchema = z.object({
    email: emailSchema,
    username: usernameSchema,
    password: strongPasswordSchema,
});

export const signinSchema = z.object({
    email: emailSchema,
    password: signinPasswordSchema,
});

export const updateProfileSchema = z.object({
    name: z.string().min(1).max(80).optional(),
    bio: z.string().max(500).nullable().optional(),
    avatarUrl: httpUrlSchema.nullable().optional(),
    bannerUrl: httpUrlSchema.nullable().optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
