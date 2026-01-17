import { EachBatchPayload } from 'kafkajs';
import { z } from 'zod';
import { ISearchIndexer } from '../../core/interfaces/repository.interface.js';
import { IDlqProducer } from '../../core/interfaces/message-broker.interface.js';
import { ILogger } from '../../core/interfaces/logger.interface.js';
import { PostDocument } from '../../core/entities/post.entity.js';

const PostEventSchema = z.object({
  PostID: z.string(),
  Title: z.string(),
  Body: z.string(),
  ImageURL: z.string().nullable().optional(),
  CreatedAt: z.string(),
  slug: z.string().optional(),
  summary: z.string().optional()
});

export class IngestService {
  constructor(
    private readonly indexer: ISearchIndexer,
    private readonly dlqProducer: IDlqProducer,
    private readonly logger: ILogger
  ) { }

  async processBatch(payload: EachBatchPayload): Promise<void> {
    const { batch, resolveOffset, heartbeat, commitOffsetsIfNecessary } = payload;
    
    const docsToUpsert: PostDocument[] = [];
    const idsToDelete: string[] = [];

    for (const message of batch.messages) {
      if (!message.value) {
        if (message.key) idsToDelete.push(message.key.toString());
        continue;
      }

      try {
        const rawString = message.value.toString();
        const eventData = JSON.parse(rawString);
        
        const parsed = PostEventSchema.safeParse(eventData);

        if (!parsed.success) {
            throw new Error(`Validation failed: ${parsed.error.message}`);
        }

        const data = parsed.data;

        const doc: PostDocument = {
            postId: data.PostID,
            title: data.Title,
            body: data.Body,
            summary: data.summary,
            slug: data.slug,
            imageUrl: data.ImageURL || null,
            createdAt: data.CreatedAt
        };

        docsToUpsert.push(doc);

      } catch (err: any) {
        this.logger.error('Message Processing Error - Sending to DLQ', { error: err.message });
        await this.dlqProducer.publish({
            originalTopic: batch.topic,
            failedAt: new Date().toISOString(),
            error: err.message,
            key: message.key?.toString(),
            payload: message.value?.toString()
        });
      }
    }

    if (docsToUpsert.length > 0) {
        await this.indexer.bulkUpsert(docsToUpsert);
    }
    if (idsToDelete.length > 0) {
        await this.indexer.bulkDelete(idsToDelete);
    }

    const lastMsg = batch.messages[batch.messages.length - 1];
    resolveOffset(lastMsg.offset);
    await commitOffsetsIfNecessary();
    await heartbeat();
    
    this.logger.info('Batch Processed', { 
        upserted: docsToUpsert.length, 
        deleted: idsToDelete.length, 
        partition: batch.partition 
    });
  }
}