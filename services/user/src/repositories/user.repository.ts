import type { PrismaClient, User } from '../generated/prisma/client.js';
import { DomainError, ServiceUnavailableError, toDomainError } from '../errors.js';
import type { PaginationArgs } from '../domain/user.js';
import {
  isConnectionEstablishmentError,
  withRetry,
  type RetryErrorCheck,
} from '../lib/retry.js';
import type { Metrics } from '../observability/metrics.js';
import type { UpdateProfileInput } from '../schemas.js';

const DB_TIMEOUT_MS = 7000;

function withDbTimeout<T>(promise: Promise<T>, ms = DB_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new ServiceUnavailableError()), ms),
    ),
  ]);
}

export class UserRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly metrics?: Metrics,
  ) {}

  async create(data: {
    email: string;
    username: string;
    password: string;
    name: string;
  }): Promise<User> {
    return this.retried(
      'create',
      async () => {
        try {
          return await this.prisma.user.create({ data });
        } catch (error) {
          if (isConnectionEstablishmentError(error)) {
            throw error;
          }
          throw toDomainError(error);
        }
      },
      {
        // Writes retry only on connection-establishment errors: the query was
        // never sent, so a retry cannot double-insert.
        retryOn: isConnectionEstablishmentError,
      },
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.retried('findByEmail', () =>
      this.prisma.user.findFirst({ where: { email, deletedAt: null } }),
    );
  }

  async findByEmailOrUsername(email: string, username: string): Promise<User | null> {
    return this.retried('findByEmailOrUsername', () =>
      this.prisma.user.findFirst({
        where: { deletedAt: null, OR: [{ email }, { username }] },
      }),
    );
  }

  async findById(id: string): Promise<User | null> {
    return this.retried('findById', () =>
      this.prisma.user.findFirst({ where: { id, deletedAt: null } }),
    );
  }

  async findByIdIncludingDeleted(id: string): Promise<User | null> {
    return this.retried('findByIdIncludingDeleted', () =>
      this.prisma.user.findFirst({ where: { id } }),
    );
  }

  async findAll({ limit, cursor }: PaginationArgs): Promise<User[]> {
    return this.retried('findAll', () =>
      this.prisma.user.findMany({
        where: { deletedAt: null },
        take: limit,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  }

  async update(id: string, data: UpdateProfileInput): Promise<User> {
    return this.retried(
      'update',
      async () => {
        try {
          return await this.prisma.user.update({ where: { id }, data });
        } catch (error) {
          if (isConnectionEstablishmentError(error)) {
            throw error;
          }
          throw toDomainError(error);
        }
      },
      {
        retryOn: isConnectionEstablishmentError,
      },
    );
  }

  private retried<T>(
    operation: string,
    run: () => Promise<T>,
    options: { retryOn?: RetryErrorCheck } = {},
  ): Promise<T> {
    return withDbTimeout(withRetry(() => this.timed(operation, run), options)).catch((error) => {
      try {
        throw toDomainError(error);
      } catch (e) {
        if (e instanceof DomainError) {
          throw e;
        }
        throw error;
      }
    });
  }

  private async timed<T>(operation: string, run: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await run();
      this.metrics?.recordDbQuery(operation, 'success', (performance.now() - start) / 1000);
      return result;
    } catch (error) {
      this.metrics?.recordDbQuery(operation, 'error', (performance.now() - start) / 1000);
      throw error;
    }
  }
}
