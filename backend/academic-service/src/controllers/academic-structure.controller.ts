import { Request, Response } from 'express';
import * as structure from '../services/academic-structure.service';
export const overview = async (req: Request, res: Response) => res.json({ success: true, data: await structure.overview(req.organizationId!) });
export const list = async (req: Request, res: Response) => res.json({ success: true, data: await structure.list(req.organizationId!, req.params.resource, req.query.parentId as string | undefined) });
export const create = async (req: Request, res: Response) => res.status(201).json({ success: true, data: await structure.create(req.organizationId!, req.params.resource, req.body) });
export const update = async (req: Request, res: Response) => res.json({ success: true, data: await structure.update(req.organizationId!, req.params.resource, req.params.id, req.body) });
export const remove = async (req: Request, res: Response) => { await structure.remove(req.organizationId!, req.params.resource, req.params.id); res.status(204).send(); };
export const rollover = async (req: Request, res: Response) => res.status(201).json({ success: true, data: await structure.rollover(req.organizationId!, req.params.id, req.body) });
