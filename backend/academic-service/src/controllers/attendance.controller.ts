import { Request, Response } from 'express';
import * as attendance from '../services/attendance.service';

const ctx = (r: Request) => ({ org: r.organizationId!, actor: r.user! });

export const recordBatch = async (r: Request, s: Response) => {
  const c = ctx(r);
  s.status(201).json({ success: true, data: await attendance.recordBatch(c.org, c.actor, r.body) });
};

export const getHistory = async (r: Request, s: Response) => {
  const c = ctx(r);
  s.json({ success: true, data: await attendance.getHistory(c.org, c.actor, r.params.id) });
};

export const exportCsv = async (r: Request, s: Response) => {
  const c = ctx(r);
  const query = r.query as unknown as { cohortId?: string; from?: Date; to?: Date };
  const csv = await attendance.exportCsv(c.org, c.actor, query);
  s.setHeader('Content-Type', 'text/csv; charset=utf-8');
  s.setHeader('Content-Disposition', `attachment; filename="attendance-${new Date().toISOString().slice(0, 10)}.csv"`);
  s.send(csv);
};
