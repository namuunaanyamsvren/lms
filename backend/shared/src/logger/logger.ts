import winston from 'winston';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, service }) => {
  return `${timestamp} [${service || 'app'}] ${level}: ${stack || message}`;
});

export function createLogger(serviceName: string) {
  const structured = process.env.LOG_FORMAT === 'json' || process.env.NODE_ENV === 'production';
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: serviceName },
    format: structured
      ? combine(errors({ stack: true }), timestamp(), json())
      : combine(errors({ stack: true }), timestamp(), logFormat),
    transports: [
      new winston.transports.Console({
        format: structured
          ? combine(errors({ stack: true }), timestamp(), json())
          : combine(colorize(), timestamp(), logFormat),
      }),
    ],
  });
}
