import { Hono } from 'hono';
import { StatusCode } from '../constants/status-code';

export type SearchHonoEnv = {
  Bindings: {
    DATABASE_URL: string;
    DATABASE_URL_MIGRATE: string;
    JWT_SECRET: string;
    ELASTICSEARCH_URL: string;
    UPSTASH_REDIS_REST_URL: string;
    UPSTASH_REDIS_REST_TOKEN: string;
    RAILWAY_CONSUMER_WAKEUP_URL: string;
    RAILWAY_WAKEUP_SECRET: string;
    UPSTASH_RATELIMIT_REDIS_REST_URL: string;
    UPSTASH_RATELIMIT_REDIS_REST_TOKEN: string;
  };
};

export const searchRouter = new Hono<SearchHonoEnv>();

searchRouter.get('/health', async (c) => {
  const esUrl = c.env.ELASTICSEARCH_URL;

  if (!esUrl) {
    return c.json({ error: 'Elasticsearch service URL is not configured.' }, StatusCode.INTERNAL_SERVER_ERROR);
  }

  try {
    const response = await fetch(esUrl);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Elasticsearch responded with status: ${response.status}. Body: ${errorBody}`);
    }

    const data = await response.json();

    return c.json({
      status: 'ok',
      message: 'Successfully connected to Elasticsearch',
      clusterInfo: data,
    }, StatusCode.OK);

  } catch (error: any) {
    console.error("Failed to connect to Elasticsearch:", error);
    return c.json({
      status: 'error',
      message: 'Failed to connect to Elasticsearch. Please ensure the service is running and accessible.',
      error: error.message,
    }, StatusCode.INTERNAL_SERVER_ERROR);
  }
});

searchRouter.get('/', async (c) => {
  const esUrl = c.env.ELASTICSEARCH_URL;
  const query = c.req.query('q');

  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '10', 10);

  const safePage = page > 0 ? page : 1;
  const safeLimit = limit > 0 ? limit : 10;

  const from = (safePage - 1) * safeLimit;

  if (!query) {
    return c.json({ error: 'Search query parameter "q" is required.' }, StatusCode.BAD_REQUEST);
  }

  const searchBody = {
    from: from,
    size: safeLimit,
    query: {
      multi_match: {
        query: query,
        fields: ["title^3", "body"],
        fuzziness: "AUTO"
      }
    },
    _source: ["postId", "title", "imageUrl", "authorName", "createdAt"]
  };

  try {
    const res = await fetch(`${esUrl}/posts/_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody)
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Elasticsearch search failed with status: ${res.status}. Body: ${errorBody}`);
    }

    const data: any = await res.json();

    const results = data.hits.hits.map((hit: any) => hit._source);
    const totalResults = data.hits.total.value;
    const totalPages = Math.ceil(totalResults / safeLimit);

    return c.json({
      data: results,
      pagination: {
        currentPage: safePage,
        totalPages: totalPages,
        totalResults: totalResults
      }
    }, StatusCode.OK);

  } catch (error: any) {
    console.error("Failed to perform search:", error);
    return c.json({ error: "Search operation failed." }, StatusCode.INTERNAL_SERVER_ERROR);
  }
});