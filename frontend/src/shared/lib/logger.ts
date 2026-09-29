type LogLevel = "debug" | "info" | "warn" | "error";

const isDev = import.meta.env.DEV;

function formatMessage(level: LogLevel, message: string): string {
  return `[${level.toUpperCase()}] ${message}`;
}

function log(level: LogLevel, message: string, ...args: unknown[]): void {
  if (!isDev && level === "debug") return;
  const formatted = formatMessage(level, message);
  switch (level) {
    case "warn":
      console.warn(formatted, ...args);
      break;
    case "error":
      console.error(formatted, ...args);
      break;
    default:
      console.log(formatted, ...args);
  }
}

export const logger = {
  debug: (message: string, ...args: unknown[]) => log("debug", message, ...args),
  info: (message: string, ...args: unknown[]) => log("info", message, ...args),
  warn: (message: string, ...args: unknown[]) => log("warn", message, ...args),
  error: (message: string, ...args: unknown[]) => log("error", message, ...args),
};
