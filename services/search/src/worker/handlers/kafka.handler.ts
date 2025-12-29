import { IngestService } from '../services/ingest.service.js';

export class KafkaHandler {
  constructor(private readonly ingestService: IngestService) {}

  public async handle(key: string | null, value: Buffer | null): Promise<void> {
    await this.ingestService.processEvent(key, value);
  }
}