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