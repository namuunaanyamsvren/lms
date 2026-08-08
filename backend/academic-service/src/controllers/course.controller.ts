import { Request, Response } from 'express';
import * as courses from '../services/course.service';

const context = (req: Request) => ({ organizationId: req.organizationId!, actor: req.user! });
export const list = async (req: Request, res: Response) => {
  const { organizationId, actor } = context(req);
  const data = await courses.listCourses(organizationId, actor, req.query as any);
  res.json({ success: true, data });
};
export const get = async (req: Request, res: Response) => {
  const { organizationId, actor } = context(req);
  res.json({ success: true, data: await courses.getCourse(organizationId, req.params.id, actor) });
};
export const create = async (req: Request, res: Response) => {
  const { organizationId, actor } = context(req);
  res.status(201).json({ success: true, data: await courses.createCourse(organizationId, actor, req.body) });
};
// JSON import intentionally uses the same validated canonical course shape, so
// imports cannot bypass tenant, instructor, lifecycle, or URL validation.
export const importCourse = create;
export const update = async (req: Request, res: Response) => {
  const { organizationId, actor } = context(req);
  res.json({ success: true, data: await courses.updateCourse(organizationId, req.params.id, actor, req.body) });
};
export const versions = async (req: Request, res: Response) => {
  const { organizationId, actor } = context(req);
  res.json({ success: true, data: await courses.listCourseVersions(organizationId, req.params.id, actor) });
};
export const compareVersions = async (req: Request, res: Response) => {
  const { organizationId, actor } = context(req);
  res.json({ success: true, data: await courses.compareCourseVersions(
    organizationId,
    req.params.id,
    actor,
    Number(req.query.from),
    Number(req.query.to),
  ) });
};
export const restoreVersion = async (req: Request, res: Response) => {
  const { organizationId, actor } = context(req);
  res.json({ success: true, data: await courses.restoreCourseVersion(organizationId, req.params.id, actor, Number(req.params.version)) });
};
export const remove = async (req: Request, res: Response) => {
  const { organizationId, actor } = context(req);
  await courses.deleteCourse(organizationId, req.params.id, actor); res.status(204).send();
};
export const duplicate = async (req: Request, res: Response) => {
  const { organizationId, actor } = context(req);
  res.status(201).json({ success: true, data: await courses.duplicateCourse(organizationId, req.params.id, actor, req.body) });
};
export const addInstructor = async (req: Request, res: Response) => {
  const { organizationId, actor } = context(req);
  res.status(201).json({ success: true, data: await courses.addInstructor(organizationId, req.params.id, actor, req.body.userId) });
};
export const removeInstructor = async (req: Request, res: Response) => {
  const { organizationId, actor } = context(req);
  await courses.removeInstructor(organizationId, req.params.id, actor, req.params.userId); res.status(204).send();
};
export const createModule = async (req: Request, res: Response) => {
  const { organizationId, actor } = context(req);
  res.status(201).json({ success: true, data: await courses.createModule(organizationId, req.params.id, actor, req.body.title) });
};
export const updateModule = async (req: Request, res: Response) => {
  const { organizationId, actor } = context(req);
  res.json({ success: true, data: await courses.updateModule(organizationId, req.params.moduleId, actor, req.body) });
};
export const removeModule = async (req: Request, res: Response) => {
  const { organizationId, actor } = context(req);
  await courses.deleteModule(organizationId, req.params.moduleId, actor); res.status(204).send();
};
export const reorderModules = async (req: Request, res: Response) => {
  const { organizationId, actor } = context(req);
  await courses.reorderModules(organizationId, req.params.id, actor, req.body.ids); res.json({ success: true });
};
export const createLesson = async (req: Request, res: Response) => {
  const { organizationId, actor } = context(req);
  res.status(201).json({ success: true, data: await courses.createLesson(organizationId, req.params.moduleId, actor, req.body) });
};
export const updateLesson = async (req: Request, res: Response) => {
  const { organizationId, actor } = context(req);
  res.json({ success: true, data: await courses.updateLesson(organizationId, req.params.lessonId, actor, req.body) });
};
export const removeLesson = async (req: Request, res: Response) => {
  const { organizationId, actor } = context(req);
  await courses.deleteLesson(organizationId, req.params.lessonId, actor); res.status(204).send();
};
export const reorderLessons = async (req: Request, res: Response) => {
  const { organizationId, actor } = context(req);
  await courses.reorderLessons(organizationId, req.params.moduleId, actor, req.body.ids); res.json({ success: true });
};
export const completeLesson = async (req: Request, res: Response) => {
  res.json({ success: true, data: await courses.completeLesson(req.organizationId!, req.params.lessonId, req.user!.userId) });
};
