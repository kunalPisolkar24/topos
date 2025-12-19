import prisma from '../lib/prisma';
import { PasswordUtils } from '../utils/password';
import { JwtUtils } from '../utils/jwt';
import { SignupInput, SigninInput } from '../types';

export class UserService {
    async signup(data: SignupInput) {
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email: data.email }, { username: data.username }],
            },
        });

        if (existingUser) {
            throw new Error('User already exists');
        }

        const hashedPassword = await PasswordUtils.hash(data.password);

        const user = await prisma.user.create({
            data: {
                email: data.email,
                username: data.username,
                password: hashedPassword,
                name: data.username,
            },
        });

        const token = JwtUtils.sign({ id: user.id });

        return {
            user: {
                ...user,
                createdAt: user.createdAt.toISOString(),
            },
            token,
        };
    }

    async signin(data: SigninInput) {
        const user = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (!user) {
            throw new Error('Invalid credentials');
        }

        const isValid = await PasswordUtils.compare(data.password, user.password);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }

        const token = JwtUtils.sign({ id: user.id });

        return {
            user: {
                ...user,
                createdAt: user.createdAt.toISOString(),
            },
            token,
        };
    }

    async findById(id: number) {
        const user = await prisma.user.findUnique({
            where: { id },
        });

        if (!user) return null;

        return {
            ...user,
            createdAt: user.createdAt.toISOString(),
        };
    }

    async getMe(id: number) {
        return this.findById(id);
    }
}