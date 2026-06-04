import argon2 from 'argon2';
import crypto from 'node:crypto';

let dummyHashPromise: Promise<string> | null = null;

export class PasswordUtils {
    static hash(password: string): Promise<string> {
        return argon2.hash(password);
    }

    static compare(plain: string, hashed: string): Promise<boolean> {
        return argon2.verify(hashed, plain);
    }

    static getDummyHash(): Promise<string> {
        if (!dummyHashPromise) {
            dummyHashPromise = argon2.hash(crypto.randomBytes(32).toString('hex'));
        }
        return dummyHashPromise;
    }
}