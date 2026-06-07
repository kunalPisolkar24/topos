export type DomainErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "NETWORK"
  | "GRAPHQL"
  | "UNKNOWN";

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
  readonly cause?: unknown;
  readonly issues?: ReadonlyArray<{ readonly path: string; readonly message: string }>;
}

export const domainError = (
  code: DomainErrorCode,
  message: string,
  extras?: { cause?: unknown; issues?: DomainError["issues"] },
): DomainError => ({
  code,
  message,
  ...(extras?.cause !== undefined ? { cause: extras.cause } : {}),
  ...(extras?.issues ? { issues: extras.issues } : {}),
});

export const isDomainError = (value: unknown): value is DomainError =>
  typeof value === "object" &&
  value !== null &&
  "code" in value &&
  "message" in value &&
  typeof (value as { code: unknown }).code === "string" &&
  typeof (value as { message: unknown }).message === "string";
