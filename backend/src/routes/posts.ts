import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { Hono, Context } from "hono";
import { z } from "zod";

import { StatusCode } from "../constants/status-code";
import { authMiddleware } from "../middleware/auth";
import { producePostEvent } from '../services/kafka';
import { logger } from '../logger';

const internalCreatePostSchema = z.object({
  title: z.string().min(1, "Title is required"),
  body: z.string().min(1, "Body is required"),
  tags: z.array(z.string()).optional().default([]),
  imageUrl: z.string().url("Invalid image URL").optional().nullable(),
});

const internalUpdatePostSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  body: z.string().min(1, "Body is required").optional(),
  tags: z.array(z.string()).optional(),
  imageUrl: z.string().url("Invalid image URL").optional().nullable(),
});

const internalPostIdSchema = z.object({
  id: z.number().int().positive("Post ID must be a positive integer"),
});

const internalSummaryUpdateSchema = z.object({
  summary: z.string().min(1, "Summary cannot be empty"),
});

export type HonoEnv = {
  Bindings: {
    DATABASE_URL: string;
    DATABASE_URL_MIGRATE: string;
    JWT_SECRET: string;
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

export const postRouter = new Hono<HonoEnv>();

postRouter.get("/", async (c: Context<HonoEnv>) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate());
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "6");
  const skip = (page - 1) * limit;
  try {
    const [posts, totalPosts] = await Promise.all([
      prisma.post.findMany({
        skip,
        take: limit,
        include: {
          tags: { include: { tag: true } },
          author: { select: { id: true, username: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
        cacheStrategy: { ttl: 60 },
      }),
      prisma.post.count({ cacheStrategy: { ttl: 60 } }),
    ]);
    const totalPages = Math.ceil(totalPosts / limit);
    return c.json(
      { data: posts, totalPages, currentPage: page, totalPosts },
      StatusCode.OK
    );
  } catch (error: any) {
    logger.error('Failed to get posts.', { error: { message: error.message, stack: error.stack } });
    return c.json(
      { error: "Failed to get posts" },
      StatusCode.INTERNAL_SERVER_ERROR
    );
  }
});

postRouter.get("/:id", async (c: Context<HonoEnv>) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate());
  try {
    const postId = parseInt(c.req.param("id"));
    const parsedParams = internalPostIdSchema.safeParse({ id: postId });
    if (!parsedParams.success) {
      logger.warn('Failed to get post due to invalid ID.', { postId, errors: parsedParams.error.errors });
      return c.json(
        { error: parsedParams.error.errors },
        StatusCode.BAD_REQUEST
      );
    }
    const post = await prisma.post.findUnique({
      where: { id: parsedParams.data.id },
      include: {
        tags: { include: { tag: true } },
        author: { select: { id: true, username: true, email: true, name: true, bio: true, avatarUrl: true } },
      },
      cacheStrategy: { ttl: 60 },
    });
    if (!post) {
      logger.warn('Post not found.', { postId: parsedParams.data.id });
      return c.json({ error: "Post not found" }, StatusCode.NOT_FOUND);
    }
    return c.json(post, StatusCode.OK);
  } catch (error: any) {
    logger.error('Failed to get post.', { postId: c.req.param("id"), error: { message: error.message, stack: error.stack } });
    return c.json(
      { error: "Failed to get post" },
      StatusCode.INTERNAL_SERVER_ERROR
    );
  }
});

postRouter.patch("/:id/summary", async (c: Context<HonoEnv>) => {
  const receivedSecret = c.req.header('X-Internal-Secret');
  const expectedSecret = c.env.API_CALLBACK_SECRET;

  if (!expectedSecret || receivedSecret !== expectedSecret) {
    logger.warn('Unauthorized summary update attempt.', { receivedSecret: receivedSecret ? 'present' : 'missing' });
    return c.json({ error: 'Unauthorized' }, StatusCode.UNAUTHORIZED);
  }

  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate());

  const postId = parseInt(c.req.param("id"));
  try {
    const parsedParams = internalPostIdSchema.safeParse({ id: postId });
    if (!parsedParams.success) {
      logger.warn('Summary update failed due to invalid post ID.', { postId, errors: parsedParams.error.errors });
      return c.json({ error: parsedParams.error.errors }, StatusCode.BAD_REQUEST);
    }

    const body = await c.req.json();
    const parsedBody = internalSummaryUpdateSchema.safeParse(body);
    if (!parsedBody.success) {
      logger.warn('Summary update failed due to invalid body.', { postId, errors: parsedBody.error.errors });
      return c.json({ error: parsedBody.error.errors }, StatusCode.BAD_REQUEST);
    }

    const updatedPost = await prisma.post.update({
      where: { id: parsedParams.data.id },
      data: {
        summary: parsedBody.data.summary,
        summaryStatus: 'COMPLETED',
      },
    });

    logger.info('Successfully updated summary for post.', { postId: updatedPost.id });
    return c.json(updatedPost, StatusCode.OK);

  } catch (error: any) {
    if ((error as any).code === 'P2025') {
      logger.warn('Attempted to update summary for a non-existent post.', { postId });
      return c.json({ error: 'Post not found' }, StatusCode.NOT_FOUND);
    }
    logger.error('Failed to update post with summary.', { postId, error: { message: error.message, code: (error as any).code, stack: error.stack } });
    return c.json(
      { error: "Failed to update post with summary" },
      StatusCode.INTERNAL_SERVER_ERROR
    );
  }
});


postRouter.post("/", authMiddleware, async (c: Context<HonoEnv>) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate());

  const userId = c.get("user").id;
  try {
    const body = await c.req.json();
    const parsedBody = internalCreatePostSchema.safeParse(body);
    if (!parsedBody.success) {
      logger.warn('Post creation failed due to validation error.', { userId, errors: parsedBody.error.errors });
      return c.json({ error: parsedBody.error.errors }, StatusCode.BAD_REQUEST);
    }

    const newPost = await prisma.post.create({
      data: {
        title: parsedBody.data.title,
        body: parsedBody.data.body,
        imageUrl: parsedBody.data.imageUrl,
        authorId: userId,
        summaryStatus: "PENDING",
        tags: {
          create: (parsedBody.data.tags || []).map((tagName: string) => ({
            tag: {
              connectOrCreate: {
                where: { name: tagName },
                create: { name: tagName },
              },
            },
          })),
        },
      },
      include: {
        tags: { include: { tag: true } },
        author: { select: { id: true, username: true, email: true, name: true } },
      },
    });

    try {
      await producePostEvent(c.env, newPost, 'create');
    } catch (kafkaError: any) {
      logger.error('Failed to produce Kafka event for new post.', { postId: newPost.id, error: { message: kafkaError.message } });
    }

    logger.info('Post created successfully.', { postId: newPost.id, authorId: userId });
    return c.json(newPost, StatusCode.CREATED);
  } catch (error: any) {
    logger.error('Failed to create post.', { userId, error: { message: error.message, stack: error.stack } });
    return c.json(
      { error: "Failed to create post" },
      StatusCode.INTERNAL_SERVER_ERROR
    );
  }
});

postRouter.put("/:id", authMiddleware, async (c: Context<HonoEnv>) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate());

  const postId = parseInt(c.req.param("id"));
  const userId = c.get("user").id;
  try {
    const parsedParams = internalPostIdSchema.safeParse({ id: postId });
    if (!parsedParams.success) {
      logger.warn('Post update failed due to invalid ID.', { postId, userId, errors: parsedParams.error.errors });
      return c.json(
        { error: parsedParams.error.errors },
        StatusCode.BAD_REQUEST
      );
    }

    const body = await c.req.json();
    const parsedBody = internalUpdatePostSchema.safeParse(body);
    if (!parsedBody.success) {
      logger.warn('Post update failed due to validation error.', { postId, userId, errors: parsedBody.error.errors });
      return c.json({ error: parsedBody.error.errors }, StatusCode.BAD_REQUEST);
    }

    const postToUpdate = await prisma.post.findUnique({
      where: { id: parsedParams.data.id },
      select: { authorId: true },
    });
    if (!postToUpdate) {
      logger.warn('Post to update not found.', { postId, userId });
      return c.json({ error: "Post not found" }, StatusCode.NOT_FOUND);
    }
    if (postToUpdate.authorId !== userId) {
      logger.warn('Unauthorized attempt to update post.', { postId, userId, authorId: postToUpdate.authorId });
      return c.json({ error: "Unauthorized" }, StatusCode.UNAUTHORIZED);
    }

    if (parsedBody.data.tags) {
      await prisma.postTag.deleteMany({
        where: { postId: parsedParams.data.id },
      });
    }

    const tagsToConnectOrCreate = (parsedBody.data.tags || []).map(
      (tagName: string) => ({
        tag: {
          connectOrCreate: {
            where: { name: tagName },
            create: { name: tagName },
          },
        },
      })
    );

    const updateData: any = {};
    if (parsedBody.data.title !== undefined) updateData.title = parsedBody.data.title;
    if (parsedBody.data.body !== undefined) updateData.body = parsedBody.data.body;
    if (parsedBody.data.imageUrl !== undefined) updateData.imageUrl = parsedBody.data.imageUrl;
    if (parsedBody.data.tags !== undefined) updateData.tags = { create: tagsToConnectOrCreate };

    if (parsedBody.data.body !== undefined || parsedBody.data.title !== undefined) {
      updateData.summary = null;
      updateData.summaryStatus = "PENDING";
    }

    const updatedPost = await prisma.post.update({
      where: { id: parsedParams.data.id },
      data: updateData,
      include: {
        author: { select: { name: true } }
      }
    });

    try {
      await producePostEvent(c.env, updatedPost, 'update');
    } catch (kafkaError: any) {
      logger.error('Failed to produce Kafka event for updated post.', { postId: updatedPost.id, error: { message: kafkaError.message } });
    }

    const finalUpdatedPost = await prisma.post.findUnique({
      where: { id: parsedParams.data.id },
      include: {
        tags: { include: { tag: true } },
        author: { select: { id: true, username: true, email: true } },
      },
    });

    logger.info('Post updated successfully.', { postId: finalUpdatedPost?.id, userId });
    return c.json(finalUpdatedPost, StatusCode.OK);
  } catch (error: any) {
    logger.error('Failed to update post.', { postId, userId, error: { message: error.message, stack: error.stack } });
    return c.json(
      { error: "Failed to update post" },
      StatusCode.INTERNAL_SERVER_ERROR
    );
  }
});

postRouter.delete("/:id", authMiddleware, async (c: Context<HonoEnv>) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate());

  const postId = parseInt(c.req.param("id"));
  const userId = c.get("user").id;
  try {
    const parsedParams = internalPostIdSchema.safeParse({ id: postId });
    if (!parsedParams.success) {
      logger.warn('Post deletion failed due to invalid ID.', { postId, userId, errors: parsedParams.error.errors });
      return c.json(
        { error: parsedParams.error.errors },
        StatusCode.BAD_REQUEST
      );
    }

    const postToDelete = await prisma.post.findUnique({
      where: { id: parsedParams.data.id },
    });
    if (!postToDelete) {
      logger.warn('Post to delete not found.', { postId, userId });
      return c.json({ error: "Post not found" }, StatusCode.NOT_FOUND);
    }
    if (postToDelete.authorId !== userId) {
      logger.warn('Unauthorized attempt to delete post.', { postId, userId, authorId: postToDelete.authorId });
      return c.json({ error: "Unauthorized" }, StatusCode.UNAUTHORIZED);
    }

    try {
      await producePostEvent(c.env, { id: parsedParams.data.id }, 'delete');
    } catch (kafkaError: any) {
      logger.error('Failed to produce Kafka delete event for post.', { postId, error: { message: kafkaError.message } });
    }

    await prisma.postTag.deleteMany({
      where: { postId: parsedParams.data.id },
    });
    await prisma.post.delete({ where: { id: parsedParams.data.id } });

    logger.info('Post deleted successfully.', { postId, userId });
    return c.json({ message: "Post deleted successfully" }, StatusCode.OK);
  } catch (error: any) {
    logger.error('Failed to delete post.', { postId, userId, error: { message: error.message, stack: error.stack } });
    return c.json(
      { error: "Failed to delete post" },
      StatusCode.INTERNAL_SERVER_ERROR
    );
  }
});
