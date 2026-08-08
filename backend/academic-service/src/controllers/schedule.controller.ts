import { Request, Response } from 'express';
import * as schedules from '../services/schedule.service';

const actorFrom = (req: Request) => ({
  userId: req.user!.userId,
  role: req.user!.role,
  organizationId: req.organizationId!,
});

const noStore = (res: Response) => {
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Schedule-Timezone', schedules.SCHEDULE_TIMEZONE);
};

export async function listSchedules(req: Request, res: Response) {
  noStore(res);
  const data = await schedules.listSchedules(actorFrom(req), req.query);
  res.json({ success: true, data, meta: { timezone: schedules.SCHEDULE_TIMEZONE } });
}

export async function listMySchedules(req: Request, res: Response) {
  noStore(res);
  const data = await schedules.listSchedules(actorFrom(req), req.query);
  res.json({ success: true, data, meta: { timezone: schedules.SCHEDULE_TIMEZONE } });
}

export async function getSchedule(req: Request, res: Response) {
  noStore(res);
  const data = await schedules.getSchedule(actorFrom(req), req.params.id);
  res.json({ success: true, data, meta: { timezone: schedules.SCHEDULE_TIMEZONE } });
}

export async function getScheduleOptions(req: Request, res: Response) {
  noStore(res);
  const data = await schedules.getScheduleOptions(actorFrom(req));
  res.json({ success: true, data });
}

export async function createSchedule(req: Request, res: Response) {
  const data = await schedules.createSchedule(actorFrom(req), req.body);
  res.status(201).json({ success: true, data });
}

export async function updateSchedule(req: Request, res: Response) {
  const data = await schedules.updateSchedule(actorFrom(req), req.params.id, req.body);
  res.json({ success: true, data });
}

export async function deleteSchedule(req: Request, res: Response) {
  await schedules.deleteSchedule(actorFrom(req), req.params.id);
  res.status(204).send();
}
