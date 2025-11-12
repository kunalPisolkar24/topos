import dotenv from 'dotenv';

dotenv.config();

export const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:29092';
export const POSTS_TOPIC = 'posts';
export const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200';
export const PORT = parseInt(process.env.PORT || '8002', 10);