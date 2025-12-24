export interface DlqMessage {
  originalTopic: string;
  failedAt: string;
  error: string;
  payload: unknown;
  key?: string;
}