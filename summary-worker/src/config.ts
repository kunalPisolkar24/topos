import dotenv from 'dotenv';

dotenv.config();

export const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:29092';
export const POSTS_TOPIC = 'posts';
export const PORT = parseInt(process.env.PORT || '8001', 10);

// For calling the ML summarization service
export const LIGHTNING_AI_URL = process.env.LIGHTNING_AI_URL!;
export const LIGHTNING_AI_AUTH_TOKEN = process.env.LIGHTNING_AI_AUTH_TOKEN;
export const SUMMARIZE_TIMEOUT_MS = 4 * 60 * 1000;

export const API_CALLBACK_URL = process.env.API_CALLBACK_URL || 'http://backend:8787';
export const API_CALLBACK_SECRET = process.env.API_CALLBACK_SECRET;