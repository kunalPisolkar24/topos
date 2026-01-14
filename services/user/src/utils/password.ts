import argon2 from 'argon2';

export class PasswordUtils {
    static async hash(password: string): Promise<string> {
        return argon2.hash(password);
    }

    static async compare(plain: string, hashed: string): Promise<boolean> {
        return argon2.verify(hashed, plain);
    }
}