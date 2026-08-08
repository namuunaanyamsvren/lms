import cors, { CorsOptions } from 'cors';
import { Application } from 'express';
import { AppError } from '../errors/AppError';
import { getCsrfHeaderName } from '../auth/csrf';

export const getAllowedOrigins = () => {
  const configured = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL;
  const values = configured
    ? configured.split(',').map(value => value.trim()).filter(Boolean)
    : ['http://localhost:5173'];

  const origins = values.map(value => {
    if (value === '*') throw new Error('Wildcard CORS origins are not allowed');
    const url = new URL(value);
    if (url.origin !== value.replace(/\/$/, '')) {
      throw new Error(`CORS origin must not include a path: ${value}`);
    }
    return url.origin;
  });
  return new Set(origins);
};

export const buildCorsOptions = (): CorsOptions => {
  const allowedOrigins = getAllowedOrigins();
  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(AppError.forbidden('Origin is not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Device-Name',
      getCsrfHeaderName(),
    ],
  };
};

export const applyCors = (app: Application) => {
  app.use(cors(buildCorsOptions()));
};
