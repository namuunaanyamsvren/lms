import { NextFunction, Request, Response } from 'express';
import { AppError } from '@lms/shared';
import { ZodTypeAny } from 'zod';

type RequestPart = 'body' | 'params' | 'query';

export const validate = (part: RequestPart, schema: ZodTypeAny) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      return next(AppError.badRequest('Invalid request', result.error.flatten()));
    }

    (req as any)[part] = result.data;
    next();
  };
