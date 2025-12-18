import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { Hono, Context } from "hono";
import { StatusCode } from "../constants/status-code";
import { logger } from '../logger';

export type TagHonoEnv = {
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
};

export const tagRouter = new Hono<TagHonoEnv>();

tagRouter.get("/", async (c: Context<TagHonoEnv>) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate());
  const searchQuery = c.req.query("query");
  const limitParam = 4;

  try {
    let tags;
    const cacheOptions = {
      cacheStrategy: {
        ttl: 300,
      },
    };

    if (searchQuery && searchQuery.trim() !== "") {
      logger.info('Searching for tags.', { query: searchQuery });
      tags = await prisma.tag.findMany({
        where: {
          name: {
            contains: searchQuery.trim(),
            mode: "insensitive",
          },
        },
        take: limitParam,
        orderBy: {
          name: "asc",
        },
        ...cacheOptions,
      });
    } else {
      logger.info('Fetching default tags.');
      tags = await prisma.tag.findMany({
        take: limitParam,
        orderBy: {
          name: "asc",
        },
        ...cacheOptions,
      });
    }
    return c.json(tags, StatusCode.OK);
  } catch (error: any) {
    logger.error('Failed to get tags.', { query: searchQuery, error: { message: error.message, stack: error.stack } });
    return c.json(
      { error: "Failed to get tags" },
      StatusCode.INTERNAL_SERVER_ERROR
    );
  }
});

tagRouter.get("/getPost/:tag", async (c: Context<TagHonoEnv>) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate());
  const tagName = c.req.param("tag");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "6");
  const skip = (page - 1) * limit;

  try {
    logger.info('Fetching posts for tag.', { tagName, page, limit });
    const [posts, totalPosts] = await Promise.all([
      prisma.post.findMany({
        where: {
          tags: {
            some: {
              tag: {
                name: tagName,
              },
            },
          },
        },
        skip: skip,
        take: limit,
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
          author: {
            select: {
              id: true,
              username: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: {
          id: "desc",
        },
        cacheStrategy: { ttl: 60 },
      }),
      prisma.post.count({
        where: {
          tags: {
            some: {
              tag: {
                name: tagName,
              },
            },
          },
        },
        cacheStrategy: { ttl: 60 },
      }),
    ]);

    const totalPages = Math.ceil(totalPosts / limit);

    return c.json(
      {
        data: posts,
        totalPages: totalPages,
        currentPage: page,
        totalPosts: totalPosts,
      },
      StatusCode.OK
    );
  } catch (error: any) {
    logger.error('Failed to get posts for tag.', { tagName, page, limit, error: { message: error.message, stack: error.stack } });
    return c.json(
      { error: "Failed to get posts for the given tag" },
      StatusCode.INTERNAL_SERVER_ERROR
    );
  }
});