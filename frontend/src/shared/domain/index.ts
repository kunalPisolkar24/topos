export type { DomainError, DomainErrorCode } from "./errors";
export { domainError, isDomainError } from "./errors";
export {
  err,
  isErr,
  isOk,
  map,
  mapErr,
  ok,
  unwrapOr,
  type Err,
  type Ok,
  type Result,
} from "./result";
