import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { Context, Hono } from "hono";
import { Redis } from "@upstash/redis/cloudflare";
import { z } from "zod";

import { StatusCode } from "../constants/status-code";
import { authMiddleware } from "../middleware/auth";
import { syncPostToIndex, deletePostFromIndex } from '../services/elasticsearch';

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
  };
  Variables: {
    user: {
      id: number;
    };
  };
};

export const postRouter = new Hono<HonoEnv>();
const SUMMARIZATION_QUEUE_KEY = "summarization_jobs_v1";

async function triggerConsumerWakeup(
  c: Context<HonoEnv>,
  operationDetails: string,
  postId: number
) {
  const wakeupUrl = c.env.RAILWAY_CONSUMER_WAKEUP_URL;
  const wakeupSecret = c.env.RAILWAY_WAKEUP_SECRET;

  if (!wakeupUrl || !wakeupSecret) {
    return;
  }

  const headers: HeadersInit = {
    "X-Wakeup-Secret": wakeupSecret,
    "Content-Type": "application/json",
  };

  const wakeupPromise = fetch(wakeupUrl, {
    method: "POST",
    headers: headers,
  })
    .then(async (response) => {
      if (!response.ok) {
        console.error(`Wakeup call for postId ${postId} to ${wakeupUrl} FAILED with HTTP Status ${response.status}.`);
      }
    })
    .catch((error) => {
        console.error(`CRITICAL NETWORK/FETCH ERROR during wakeup call for postId ${postId} to ${wakeupUrl}:`, error);
    });

  if (c.executionCtx && typeof c.executionCtx.waitUntil === "function") {
    c.executionCtx.waitUntil(wakeupPromise);
  }
}

postRouter.get("/", async (c) => {
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
    return c.json(
      { error: "Failed to get posts" },
      StatusCode.INTERNAL_SERVER_ERROR
    );
  }
});

postRouter.get("/:id", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate());
  try {
    const postId = parseInt(c.req.param("id"));
    const parsedParams = internalPostIdSchema.safeParse({ id: postId });
    if (!parsedParams.success)
      return c.json(
        { error: parsedParams.error.errors },
        StatusCode.BAD_REQUEST
      );
    const post = await prisma.post.findUnique({
      where: { id: parsedParams.data.id },
      include: {
        tags: { include: { tag: true } },
        author: { select: { id: true, username: true, email: true, name: true, bio: true, avatarUrl: true } },
      },
      cacheStrategy: { ttl: 60 },
    });
    if (!post) return c.json({ error: "Post not found" }, StatusCode.NOT_FOUND);
    return c.json(post, StatusCode.OK);
  } catch (error: any) {
    return c.json(
      { error: "Failed to get post" },
      StatusCode.INTERNAL_SERVER_ERROR
    );
  }
});

postRouter.post("/", authMiddleware, async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate());
  const redis = Redis.fromEnv(c.env);

  try {
    const body = await c.req.json();
    const parsedBody = internalCreatePostSchema.safeParse(body);
    if (!parsedBody.success) {
      return c.json({ error: parsedBody.error.errors }, StatusCode.BAD_REQUEST);
    }
    const userId = c.get("user").id;

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
      await syncPostToIndex(c.env.ELASTICSEARCH_URL, {
          postId: newPost.id,
          title: newPost.title,
          body: newPost.body,
          authorName: newPost.author.name || 'Unknown',
          imageUrl: newPost.imageUrl,
          createdAt: newPost.createdAt
      });
    } catch (esError) {
        console.error(`[POST /] Failed to sync new post ${newPost.id} to Elasticsearch:`, esError);
    }

    try {
      const jobPayload = { postId: newPost.id, text: newPost.body, attempt: 1 };
      await redis.lpush(SUMMARIZATION_QUEUE_KEY, JSON.stringify(jobPayload));
      triggerConsumerWakeup(c, "Create", newPost.id);
    } catch (queueError: any) {
      console.error(`Failed to enqueue job for postId ${newPost.id}. Error: ${queueError.message}`, queueError);
    }

    return c.json(newPost, StatusCode.CREATED);
  } catch (error: any) {
    return c.json(
      { error: "Failed to create post" },
      StatusCode.INTERNAL_SERVER_ERROR
    );
  }
});

postRouter.put("/:id", authMiddleware, async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate());
  const redis = Redis.fromEnv(c.env);
  try {
    const postId = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const parsedParams = internalPostIdSchema.safeParse({ id: postId });
    if (!parsedParams.success)
      return c.json(
        { error: parsedParams.error.errors },
        StatusCode.BAD_REQUEST
      );

    const parsedBody = internalUpdatePostSchema.safeParse(body);
    if (!parsedBody.success)
      return c.json({ error: parsedBody.error.errors }, StatusCode.BAD_REQUEST);

    const userId = c.get("user").id;

    const postToUpdate = await prisma.post.findUnique({
      where: { id: parsedParams.data.id },
      select: { authorId: true },
    });
    if (!postToUpdate)
      return c.json({ error: "Post not found" }, StatusCode.NOT_FOUND);
    if (postToUpdate.authorId !== userId)
      return c.json({ error: "Unauthorized" }, StatusCode.UNAUTHORIZED);

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

    let triggerSummarization = false;
    if (parsedBody.data.body !== undefined || parsedBody.data.title !== undefined) {
      updateData.summary = null;
      updateData.summaryStatus = "PENDING";
      triggerSummarization = true;
    }

    const updatedPost = await prisma.post.update({
      where: { id: parsedParams.data.id },
      data: updateData,
    });

    const updatedPostForIndex = await prisma.post.findUnique({
        where: { id: parsedParams.data.id },
        include: { author: { select: { name: true } } }
    });

    if (updatedPostForIndex) {
        try {
            await syncPostToIndex(c.env.ELASTICSEARCH_URL, {
                postId: updatedPostForIndex.id,
                title: updatedPostForIndex.title,
                body: updatedPostForIndex.body,
                authorName: updatedPostForIndex.author.name || 'Unknown',
                imageUrl: updatedPostForIndex.imageUrl,
                createdAt: updatedPostForIndex.createdAt
            });
        } catch (esError) {
            console.error(`[PUT /:id] Failed to sync updated post ${parsedParams.data.id} to Elasticsearch:`, esError);
        }
    }

    if (triggerSummarization) {
      try {
        const jobPayload = { postId: updatedPost.id, text: updatedPost.body, attempt: 1 };
        await redis.lpush(SUMMARIZATION_QUEUE_KEY, JSON.stringify(jobPayload));
        triggerConsumerWakeup(c, "Update", updatedPost.id);
      } catch (queueError: any) {
        console.error(`Failed to enqueue job for updated postId ${updatedPost.id}. Error: ${queueError.message}`, queueError);
      }
    }

    const finalUpdatedPost = await prisma.post.findUnique({
      where: { id: parsedParams.data.id },
      include: {
        tags: { include: { tag: true } },
        author: { select: { id: true, username: true, email: true } },
      },
    });
    return c.json(finalUpdatedPost, StatusCode.OK);
  } catch (error: any) {
    return c.json(
      { error: "Failed to update post" },
      StatusCode.INTERNAL_SERVER_ERROR
    );
  }
});

postRouter.delete("/:id", authMiddleware, async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate());
  try {
    const postId = parseInt(c.req.param("id"));
    const parsedParams = internalPostIdSchema.safeParse({ id: postId });
    if (!parsedParams.success)
      return c.json(
        { error: parsedParams.error.errors },
        StatusCode.BAD_REQUEST
      );
    const userId = c.get("user").id;
    const postToDelete = await prisma.post.findUnique({
      where: { id: parsedParams.data.id },
    });
    if (!postToDelete)
      return c.json({ error: "Post not found" }, StatusCode.NOT_FOUND);
    if (postToDelete.authorId !== userId)
      return c.json({ error: "Unauthorized" }, StatusCode.UNAUTHORIZED);
    
    try {
        await deletePostFromIndex(c.env.ELASTICSEARCH_URL, parsedParams.data.id);
    } catch (esError) {
        console.error(`[DELETE /:id] Failed to delete post ${parsedParams.data.id} from Elasticsearch:`, esError);
    }

    await prisma.postTag.deleteMany({
      where: { postId: parsedParams.data.id },
    });
    await prisma.post.delete({ where: { id: parsedParams.data.id } });
    return c.json({ message: "Post deleted successfully" }, StatusCode.OK);
  } catch (error: any) {
    return c.json(
      { error: "Failed to delete post" },
      StatusCode.INTERNAL_SERVER_ERROR
    );
  }
});
