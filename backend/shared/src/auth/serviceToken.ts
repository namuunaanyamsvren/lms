import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { AppError } from '../errors';

const ISSUER = 'lms-internal';
const AUDIENCE = 'lms-services';
const TTL = '60s';

export function createServiceToken(service: string): string {
  const secret = process.env.SERVICE_TOKEN_SECRET;
  if (!secret) throw new Error('SERVICE_TOKEN_SECRET is required');
  return jwt.sign({ service }, secret, {
    algorithm: 'HS256', expiresIn: TTL, issuer: ISSUER, audience: AUDIENCE, subject: service,
  } as SignOptions);
}

export function serviceAuthorizationHeaders(service: string): Record<string, string> {
  return { authorization: `Bearer ${createServiceToken(service)}` };
}

export function internalServiceAuth(req: Request, _res: Response, next: NextFunction) {
  const authorization = req.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  const secret = process.env.SERVICE_TOKEN_SECRET;
  if (!secret || !token) return next(AppError.unauthorized('Invalid internal service credentials'));
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE, maxAge: TTL,
    }) as JwtPayload;
    if (typeof decoded.service !== 'string' || decoded.sub !== decoded.service) {
      throw new Error('Invalid service identity');
    }
    req.internalService = decoded.service;
    return next();
  } catch {
    return next(AppError.unauthorized('Invalid internal service credentials'));
  }
}

export function requireInternalService(...services: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.internalService || !services.includes(req.internalService)) {
      return next(AppError.forbidden('Internal service is not authorized for this operation'));
    }
    return next();
  };
}
