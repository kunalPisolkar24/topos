import { HeaderMap } from '@apollo/server';
import { logger } from './logger';

export interface GraphQLResponseHead {
    status?: number;
    headers: HeaderMap;
}

export type GraphQLResponseBody =
    | { kind: 'complete'; string: string }
    | { kind: 'chunked'; asyncIterator: AsyncIterableIterator<string> };

export interface GraphQLResponse extends GraphQLResponseHead {
    body: GraphQLResponseBody;
}

export function streamGraphQLResponse(response: GraphQLResponse): Response {
    const responseHeaders: Record<string, string> = {};
    for (const [key, value] of response.headers) {
        responseHeaders[key] = value;
    }

    const body = response.body;
    if (body.kind === 'complete') {
        return new Response(body.string, {
            status: response.status || 200,
            headers: responseHeaders,
        });
    }

    const iterator = body.asyncIterator;
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const encoder = new TextEncoder();
            try {
                for await (const chunk of iterator) {
                    controller.enqueue(encoder.encode(chunk));
                }
                controller.close();
            } catch (error) {
                logger.error({ msg: 'GraphQL stream error', error });
                controller.error(error);
            }
        },
    });

    return new Response(stream, {
        status: response.status || 200,
        headers: responseHeaders,
    });
}
