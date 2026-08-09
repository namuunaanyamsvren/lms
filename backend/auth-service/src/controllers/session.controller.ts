import { Request, Response } from 'express';
import { AppError, clearRefreshCookie } from '@lms/shared';
import { getSessionRequestContext } from '../services/session.service';
import {
  listActiveSessions,
  logoutAllSessions,
  revokeOwnedSession,
} from '../services/session-management.service';

import { prisma } from '../lib/prisma';

export const logoutAll = async (req: Request, res: Response) => {
  await logoutAllSessions(
    prisma,
    req.user!.userId,
    req.user!.organizationId,
    getSessionRequestContext(req),
  );
  clearRefreshCookie(res);
  return res.json({ success: true, message: 'Бүх төхөөрөмжөөс амжилттай гарлаа.' });
};

export const getActiveSessions = async (req: Request, res: Response) => {
  const sessions = await listActiveSessions(
    prisma,
    req.user!.userId,
    req.user!.sessionId,
  );
  return res.json({ success: true, data: sessions });
};

export const revokeSession = async (req: Request, res: Response) => {
  const result = await revokeOwnedSession(
    prisma,
    req.user!.userId,
    req.user!.organizationId,
    req.params.id,
    getSessionRequestContext(req),
  );
  if (!result.found) throw AppError.notFound('Session not found');

  if (req.params.id === req.user!.sessionId) {
    clearRefreshCookie(res);
  }
  return res.json({
    success: true,
    message: result.revoked ? 'Session амжилттай цуцлагдлаа.' : 'Session аль хэдийн цуцлагдсан.',
  });
};
