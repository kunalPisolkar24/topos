import argon2 from 'argon2';
import crypto from 'node:crypto';

export interface PasswordHasher {
    hash(password: string): Promise<string>;
    verify(plain: string, hashed: string): Promise<boolean>;
    getDummyHash(): Promise<string>;
}

export class Argon2PasswordHasher implements PasswordHasher {
    private dummyHashPromise: Promise<string> | null = null;

    hash(password: string): Promise<string> {
        return argon2.hash(password);
    }

    async verify(plain: string, hashed: string): Promise<boolean> {
        try {
            return await argon2.verify(hashed, plain);
        } catch {
            return false;
        }
    }

    getDummyHash(): Promise<string> {
        if (!this.dummyHashPromise) {
            this.dummyHashPromise = argon2.hash(crypto.randomBytes(32).toString('hex'));
        }
        return this.dummyHashPromise;
    }
}

export const passwordHasher: PasswordHasher = new Argon2PasswordHasher();
