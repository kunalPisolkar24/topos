import prisma from '../lib/prisma';
import { PasswordUtils } from '../utils/password';
import { JwtUtils } from '../utils/jwt';
import { SignupInput, SigninInput } from '../types';
import { logger } from '../lib/logger';

export class UserService {
    async signup(data: SignupInput) {
        logger.debug({ msg: 'Attempting signup', email: data.email });

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email: data.email }, { username: data.username }],
            },
        });

        if (existingUser) {
            logger.warn({ msg: 'Signup failed: User exists', email: data.email });
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

        logger.info({ msg: 'User signed up successfully', userId: user.id });

        return {
            user: {
                ...user,
                createdAt: user.createdAt.toISOString(),
            },
            token,
        };
    }

    async signin(data: SigninInput) {
        logger.debug({ msg: 'Attempting signin', email: data.email });

        const user = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (!user) {
            logger.warn({ msg: 'Signin failed: User not found', email: data.email });
            throw new Error('Invalid credentials');
        }

        const isValid = await PasswordUtils.compare(data.password, user.password);
        if (!isValid) {
            logger.warn({ msg: 'Signin failed: Invalid password', userId: user.id });
            throw new Error('Invalid credentials');
        }

        const token = JwtUtils.sign({ id: user.id });

        logger.info({ msg: 'User signed in successfully', userId: user.id });

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

        if (!user) {
            logger.debug({ msg: 'User not found by ID', userId: id });
            return null;
        }

        return {
            ...user,
            createdAt: user.createdAt.toISOString(),
        };
    }

    async getMe(id: number) {
        return this.findById(id);
    }
}