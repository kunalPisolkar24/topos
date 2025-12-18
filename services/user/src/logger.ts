type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogObject {
  level: LogLevel;
  service: string;
  message: string;
  [key: string]: any;
}

export const logger = {
  info: (message: string, context: object = {}) => {
    log('info', message, context);
  },
  warn: (message: string, context: object = {}) => {
    log('warn', message, context);
},
  error: (message: string, context: object = {}) => {
    log('error', message, context);
  },
};

function log(level: LogLevel, message: string, context: object) {
  const logObject: LogObject = {
    level,
    service: 'hono-backend',
    message,
    ...context,
  };

  console.log(JSON.stringify(logObject));
}