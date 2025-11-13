import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { Hono, Context } from "hono";
import { sign } from "hono/jwt";
import { z } from "zod";

import { StatusCode } from '../constants/status-code';
import { authMiddleware } from '../middleware/auth';
import { signupSchema, signinSchema, userIdSchema } from '@kunalpisolkar24/blogapp-common';
import { logger } from '../logger';

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").optional(),
  bio: z.string().nullable().optional(),
  avatarUrl: z.string().url("Invalid avatar URL").nullable().optional(),
  bannerUrl: z.string().url("Invalid banner URL").nullable().optional(),
});

export type UserHonoEnv = {
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
    DATABASE_URL_MIGRATE: string;
    UPSTASH_REDIS_REST_URL: string;
    UPSTASH_REDIS_REST_TOKEN: string;
    RAILWAY_CONSUMER_WAKEUP_URL: string;
    RAILWAY_WAKEUP_SECRET: string;
    UPSTASH_RATELIMIT_REDIS_REST_URL: string;
    UPSTASH_RATELIMIT_REDIS_REST_TOKEN: string;
    ELASTICSEARCH_URL: string;
    KAFKA_REST_PROXY_URL: string;
    API_CALLBACK_SECRET: string;
  };
  Variables: {
    user: {
      id: number;
    };
  };
};

export const userRouter = new Hono<UserHonoEnv>();

userRouter.post('/signup', async (c: Context<UserHonoEnv>) => {
  const prisma = new PrismaClient({ datasourceUrl: c.env?.DATABASE_URL }).$extends(withAccelerate());
  try {
    const body = await c.req.json();

    const parsedBody = signupSchema.safeParse(body);
    if (!parsedBody.success) {
      logger.warn('Signup failed due to validation error.', { errors: parsedBody.error.errors });
      return c.json({ error: parsedBody.error.errors }, StatusCode.BAD_REQUEST);
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(parsedBody.data.password);
    const hash = await crypto.subtle.digest('SHA-256', data);

    const passwordHashHex = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const newUser = await prisma.user.create({
      data: {
        email: parsedBody.data.email,
        password: passwordHashHex,
        username: parsedBody.data.username,
        name: parsedBody.data.username,
      },
    });

    const jwt = await sign({ id: newUser.id }, c.env.JWT_SECRET);

    logger.info('User signed up successfully.', { userId: newUser.id, email: newUser.email });
    return c.json({ newUser, jwt }, StatusCode.CREATED);
  } catch (error: any) {
    logger.error('Failed to create user.', { error: { message: error.message, code: error.code, stack: error.stack } });
    return c.json({ error: 'Failed to create user' }, StatusCode.INTERNAL_SERVER_ERROR);
  } finally {
    await prisma.$disconnect();
  }
});

userRouter.post('/signin', async (c: Context<UserHonoEnv>) => {
  const prisma = new PrismaClient({ datasourceUrl: c.env?.DATABASE_URL }).$extends(withAccelerate());
  try {
    const body = await c.req.json();

    const parsedBody = signinSchema.safeParse(body);
    if (!parsedBody.success) {
      logger.warn('Signin failed due to validation error.', { errors: parsedBody.error.errors });
      return c.json({ error: parsedBody.error.errors }, StatusCode.BAD_REQUEST);
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(parsedBody.data.password);
    const hash = await crypto.subtle.digest('SHA-256', data);

    const passwordHashHex = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const user = await prisma.user.findUnique({
      where: { email: parsedBody.data.email },
    });

    if (!user || user.password !== passwordHashHex) {
      logger.warn('Invalid signin attempt.', { email: parsedBody.data.email });
      return c.json({ error: 'Invalid email or password' }, StatusCode.UNAUTHORIZED);
    }

    const jwt = await sign({ id: user.id }, c.env.JWT_SECRET);

    logger.info('User signed in successfully.', { userId: user.id, email: user.email });
    return c.json({ user, jwt }, StatusCode.OK);
  } catch (error: any) {
    logger.error('Failed to sign in.', { error: { message: error.message, stack: error.stack } });
    return c.json({ error: 'Failed to sign in' }, StatusCode.INTERNAL_SERVER_ERROR);
  } finally {
    await prisma.$disconnect();
  }
});

userRouter.use('/users/*', authMiddleware);

userRouter.patch('/users/profile', async (c: Context<UserHonoEnv>) => {
  const prisma = new PrismaClient({ datasourceUrl: c.env?.DATABASE_URL }).$extends(withAccelerate());
  const userId = c.get('user').id;

  try {
    const body = await c.req.json();
    const parsedBody = updateProfileSchema.safeParse(body);

    if (!parsedBody.success) {
      logger.warn('Profile update failed due to validation error.', { userId, errors: parsedBody.error.errors });
      return c.json({ error: parsedBody.error.errors }, StatusCode.BAD_REQUEST);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: parsedBody.data,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        bio: true,
        avatarUrl: true,
        bannerUrl: true,
        createdAt: true,
      },
    });

    logger.info('User profile updated successfully.', { userId });
    return c.json(updatedUser, StatusCode.OK);
  } catch (error: any) {
    logger.error('Failed to update profile.', { userId, error: { message: error.message, stack: error.stack } });
    return c.json({ error: 'Failed to update profile' }, StatusCode.INTERNAL_SERVER_ERROR);
  } finally {
    await prisma.$disconnect();
  }
});

userRouter.get('/users/:id/posts', async (c: Context<UserHonoEnv>) => {
  const prisma = new PrismaClient({ datasourceUrl: c.env?.DATABASE_URL }).$extends(withAccelerate());
  const authorId = parseInt(c.req.param('id'));
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '3');
  const skip = (page - 1) * limit;

  try {
    const parsedParams = userIdSchema.safeParse({ id: authorId });
    if (!parsedParams.success) {
      logger.warn('Get user posts failed due to invalid author ID.', { authorId, errors: parsedParams.error.errors });
      return c.json({ error: parsedParams.error.errors }, StatusCode.BAD_REQUEST);
    }

    const [posts, totalPosts] = await Promise.all([
      prisma.post.findMany({
        where: { authorId: parsedParams.data.id },
        skip,
        take: limit,
        include: {
          tags: { include: { tag: true } },
          author: { select: { id: true, username: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        cacheStrategy: { ttl: 60 },
      }),
      prisma.post.count({
        where: { authorId: parsedParams.data.id },
        cacheStrategy: { ttl: 60 }
      }),
    ]);

    const totalPages = Math.ceil(totalPosts / limit);
    return c.json({ data: posts, totalPages, currentPage: page, totalPosts }, StatusCode.OK);

  } catch (error: any) {
    logger.error('Failed to get user posts.', { authorId, page, limit, error: { message: error.message, stack: error.stack } });
    return c.json({ error: 'Failed to get user posts' }, StatusCode.INTERNAL_SERVER_ERROR);
  } finally {
    await prisma.$disconnect();
  }
});

userRouter.get('/users/:id', async (c: Context<UserHonoEnv>) => {
  const prisma = new PrismaClient({ datasourceUrl: c.env?.DATABASE_URL }).$extends(withAccelerate());
  const userId = parseInt(c.req.param('id'));
  try {
    const parsedParams = userIdSchema.safeParse({ id: userId });
    if (!parsedParams.success) {
      logger.warn('Get user details failed due to invalid user ID.', { userId, errors: parsedParams.error.errors });
      return c.json({ error: parsedParams.error.errors }, StatusCode.BAD_REQUEST);
    }

    const user = await prisma.user.findUnique({
      where: { id: parsedParams.data.id },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        bio: true,
        avatarUrl: true,
        bannerUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      logger.warn('User not found.', { userId });
      return c.json({ error: 'User not found' }, StatusCode.NOT_FOUND);
    }

    return c.json(user, StatusCode.OK);
  } catch (error: any) {
    logger.error('Failed to get user details.', { userId, error: { message: error.message, stack: error.stack } });
    return c.json({ error: 'Failed to get user details' }, StatusCode.INTERNAL_SERVER_ERROR);
  } finally {
    await prisma.$disconnect();
  }
});

userRouter.get('/users', async (c: Context<UserHonoEnv>) => {
  const prisma = new PrismaClient({ datasourceUrl: c.env?.DATABASE_URL }).$extends(withAccelerate());
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, username: true, name: true },
    });

    return c.json(users, StatusCode.OK);
  } catch (error: any) {
    logger.error('Failed to get users.', { error: { message: error.message, stack: error.stack } });
    return c.json({ error: 'Failed to get users' }, StatusCode.INTERNAL_SERVER_ERROR);
  } finally {
    await prisma.$disconnect();
  }
});