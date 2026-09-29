import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { Prisma } from './generated/prisma/client.js';

export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: ContentfulStatusCode;
}

export class UserAlreadyExistsError extends DomainError {
  readonly code = 'USER_ALREADY_EXISTS';
  readonly httpStatus = 409;
  constructor() {
    super('A user with that email or username already exists');
  }
}

export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';
  readonly httpStatus = 401;
  constructor() {
    super('Invalid email or password');
  }
}

export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';
  readonly httpStatus = 404;
  constructor() {
    super('User not found');
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly httpStatus = 400;
  constructor(message: string) {
    super(message);
  }
}

export class PayloadTooLargeError extends DomainError {
  readonly code = 'PAYLOAD_TOO_LARGE';
  readonly httpStatus = 413;
  constructor() {
    super('Request body exceeds the maximum allowed size');
  }
}

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
  readonly httpStatus = 401;
  constructor() {
    super('Authentication required');
  }
}

export class ServiceUnavailableError extends DomainError {
  readonly code = 'SERVICE_UNAVAILABLE';
  readonly httpStatus = 503;
  constructor(message = 'Service temporarily unavailable') {
    super(message);
  }
}

export class GraphqlTimeoutError extends DomainError {
  readonly code = 'GRAPHQL_TIMEOUT';
  readonly httpStatus = 504;
  constructor() {
    super('GraphQL operation timed out');
  }
}

const CONNECTION_ESTABLISHMENT_PATTERN =
  /ECONNREFUSED|ETIMEDOUT|Connection pool timeout|connect ECONNREFUSED/i;

const TRANSIENT_PATTERN =
  /ECONNRESET|Connection terminated|Connection terminated unexpectedly/i;

export function isConnectionEstablishmentError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P1001';
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  return error instanceof Error && CONNECTION_ESTABLISHMENT_PATTERN.test(error.message);
}

export function isTransientDbError(error: unknown): boolean {
  if (isConnectionEstablishmentError(error)) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P1002' || error.code === 'P1017';
  }
  return error instanceof Error && TRANSIENT_PATTERN.test(error.message);
}

function isDbUnavailableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P1001' || error.code === 'P1002' || error.code === 'P1017';
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  if (error instanceof Error) {
    return /ECONNREFUSED|ETIMEDOUT|Connection pool timeout|ECONNRESET|Connection terminated|Service temporarily unavailable/i.test(
      error.message,
    );
  }
  return false;
}

export function toDomainError(error: unknown): DomainError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return new UserAlreadyExistsError();
    }
    if (error.code === 'P2023') {
      return new ValidationError('Invalid cursor');
    }
    if (error.code === 'P2025') {
      return new UserNotFoundError();
    }
    if (error.code === 'P1001' || error.code === 'P1002' || error.code === 'P1017') {
      return new ServiceUnavailableError();
    }
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new ServiceUnavailableError();
  }
  if (error instanceof DomainError) {
    return error;
  }
  if (isDbUnavailableError(error)) {
    return new ServiceUnavailableError();
  }
  throw error;
}
