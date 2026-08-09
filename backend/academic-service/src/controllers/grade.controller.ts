import { Request, Response } from 'express';
import * as grade from '../services/grade.service';

const ctx = (r: Request) => ({ org: r.organizationId!, actor: r.user! });

export const listCategories = async (r: Request, s: Response) => {
  const c = ctx(r);
  s.json({ success: true, data: await grade.listCategories(c.org, c.actor, r.params.courseId) });
};
export const createCategory = async (r: Request, s: Response) => {
  const c = ctx(r);
  s.status(201).json({ success: true, data: await grade.createCategory(c.org, c.actor, r.params.courseId, r.body) });
};
export const updateCategory = async (r: Request, s: Response) => {
  const c = ctx(r);
  s.json({ success: true, data: await grade.updateCategory(c.org, c.actor, r.params.id, r.body) });
};
export const deleteCategory = async (r: Request, s: Response) => {
  const c = ctx(r);
  await grade.deleteCategory(c.org, c.actor, r.params.id);
  s.status(204).send();
};

export const createManualGrade = async (r: Request, s: Response) => {
  const c = ctx(r);
  s.status(201).json({ success: true, data: await grade.createManualGrade(c.org, c.actor, r.body) });
};
export const publishGrade = async (r: Request, s: Response) => {
  const c = ctx(r);
  s.json({ success: true, data: await grade.publishGrade(c.org, c.actor, r.params.id) });
};
export const getGradeHistory = async (r: Request, s: Response) => {
  const c = ctx(r);
  s.json({ success: true, data: await grade.getGradeHistory(c.org, c.actor, r.params.id) });
};

export const createAppeal = async (r: Request, s: Response) => {
  const c = ctx(r);
  s.status(201).json({ success: true, data: await grade.createAppeal(c.org, c.actor, r.params.id, r.body.reason) });
};
export const listAppeals = async (r: Request, s: Response) => {
  const c = ctx(r);
  s.json({ success: true, data: await grade.listAppeals(c.org, c.actor) });
};
export const resolveAppeal = async (r: Request, s: Response) => {
  const c = ctx(r);
  s.json({ success: true, data: await grade.resolveAppeal(c.org, c.actor, r.params.id, r.body) });
};

export const bulkImportGrades = async (r: Request, s: Response) => {
  const c = ctx(r);
  s.json({ success: true, data: await grade.bulkImportGrades(c.org, c.actor, r.params.assignmentId, r.body.csv) });
};
export const exportGradesCsv = async (r: Request, s: Response) => {
  const c = ctx(r);
  const csv = await grade.exportGradesCsv(c.org, c.actor, r.params.assignmentId);
  s.setHeader('Content-Type', 'text/csv; charset=utf-8');
  s.setHeader('Content-Disposition', `attachment; filename="grades-${r.params.assignmentId}.csv"`);
  s.send(csv);
};

export const getCourseGradebook = async (r: Request, s: Response) => {
  const c = ctx(r);
  s.json({ success: true, data: await grade.getCourseGradebook(c.org, c.actor, r.params.courseId) });
};
export const getTranscript = async (r: Request, s: Response) => {
  const c = ctx(r);
  s.json({ success: true, data: await grade.getTranscript(c.org, c.actor, r.params.studentId) });
};
export const getAtRiskStudents = async (r: Request, s: Response) => {
  const c = ctx(r);
  s.json({ success: true, data: await grade.getAtRiskStudents(c.org, c.actor, r.params.courseId) });
};
