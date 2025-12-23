import { SearchService } from '../services/search.service.js';

export class KafkaHandler {
  constructor(private readonly searchService: SearchService) {}

  public async handle(key: string | null, value: Buffer | null): Promise<void> {
    await this.searchService.processEvent(key, value);
  }
}