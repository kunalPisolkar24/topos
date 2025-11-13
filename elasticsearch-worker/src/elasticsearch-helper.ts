import fetch from 'node-fetch';
import pino from 'pino';

const INDEX_NAME = 'posts';

// Define the structure of the post document
export interface PostDocument {
    postId: number;
    title: string;
    body: string;
    authorName: string;
    imageUrl: string | null;
    createdAt: Date;
}

/**
 * Creates or updates a post document in the Elasticsearch index.
 * The PUT method is idempotent, making it suitable for both creation and updates.
 * @param esUrl The base URL of the Elasticsearch service.
 * @param post The post data to be indexed.
*/
export async function syncPostToIndex(esUrl: string, post: PostDocument, logger: pino.Logger): Promise<void> {
    const documentId = post.postId;
    try {
        const response = await fetch(`${esUrl}/${INDEX_NAME}/_doc/${documentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(post)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Failed to sync document ${documentId}. Status: ${response.status}, Body: ${errorBody}`);
        }
        logger.info({ postId: documentId }, `Successfully synced document to Elasticsearch.`);
    } catch (error) {
        throw error;
    }
}

/**
 * Deletes a post document from the Elasticsearch index.
 * @param esUrl The base URL of the Elasticsearch service.
 * @param postId The ID of the post to delete.
 */
export async function deletePostFromIndex(esUrl: string, postId: number, logger: pino.Logger): Promise<void> {
    try {
        const response = await fetch(`${esUrl}/${INDEX_NAME}/_doc/${postId}`, {
            method: 'DELETE'
        });

        if (!response.ok && response.status !== 404) {
            const errorBody = await response.text();
            throw new Error(`Failed to delete document ${postId}. Status: ${response.status}, Body: ${errorBody}`);
        }
        logger.info({ postId }, `Successfully deleted document from Elasticsearch.`);
    } catch (error) {
        throw error;
    }
}