import fetch, { RequestInit, HeadersInit } from 'node-fetch';
import { LIGHTNING_AI_URL, LIGHTNING_AI_AUTH_TOKEN, SUMMARIZE_TIMEOUT_MS } from '../config.js';

interface SummarizeResult {
    summary?: string;
    error?: string;
}

export async function callSummarizeService(text: string): Promise<string | null> {
    if (!LIGHTNING_AI_URL || !LIGHTNING_AI_AUTH_TOKEN) {
        console.error("ML service URL or Auth Token not configured for summarize call.");
        return null;
    }
    console.log("Calling ML service /summarize endpoint...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SUMMARIZE_TIMEOUT_MS);

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': LIGHTNING_AI_AUTH_TOKEN
    };

    try {
        const response = await fetch(`${LIGHTNING_AI_URL}/summarize`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ text }),
            signal: controller.signal as any
        } as RequestInit);
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Summarizer service error: ${response.status} - ${errText}`);
        }
        const result = await response.json() as SummarizeResult;
        if (result.summary) {
            console.log("Successfully received summary from ML service.");
            return result.summary;
        } else {
            throw new Error(result.error || "No summary in ML response");
        }
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.error('Error calling ML /summarize: Request timed out.');
        } else {
            console.error(`Error calling ML /summarize: ${error.message}`);
        }
        return null;
    }
}