import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, service }) => {
  return `${timestamp} [${service || 'app'}] ${level}: ${stack || message}`;
});

export function createLogger(serviceName: string) {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: serviceName },
    format: combine(errors({ stack: true }), timestamp(), logFormat),
    transports: [
      new winston.transports.Console({
        format: combine(colorize(), timestamp(), logFormat),
      }),
    ],
  });
}
