import crypto from 'crypto';
import path from 'path';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { Request, Response } from 'express';
import {
  AppError,
  createSignedFileUrl,
  inspectUpload,
  scanUploadForMalware,
  verifySignedFileRequest,
  sanitizeUploadFilename,
  DEFAULT_UPLOAD_MAX_BYTES,
} from '@lms/shared';

import { prisma } from '../lib/prisma';
const elevatedFileRoles = new Set([
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'INSTRUCTOR',
  'STAFF',
]);

const resolveStoragePath = (fileKey: string) => {
  const root = process.env.FILE_STORAGE_DIRECTORY?.trim();
  if (!root) throw new AppError('File storage is unavailable', 503);
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, ...fileKey.split('/'));
  if (!target.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw AppError.forbidden('Invalid storage key');
  }
  return target;
};

const scalarQuery = (value: unknown): string => {
  if (typeof value !== 'string') throw AppError.badRequest('Invalid signed file URL');
  return value;
};

export const inspectFile = async (req: Request, res: Response) => {
  if (!Buffer.isBuffer(req.body)) throw AppError.badRequest('Upload must contain a binary body');
  const filename = req.header('x-file-name') || '';
  const upload = inspectUpload(req.body, req.header('content-type') || '', filename);
  const scan = await scanUploadForMalware(
    req.body,
    upload.filename,
    upload.sha256,
  );
  const storageKey = `${req.organizationId}/${crypto.randomUUID()}/${upload.filename}`;
  const admittedForStorage = scan.status === 'CLEAN' ||
    (scan.status === 'NOT_CONFIGURED' && process.env.NODE_ENV !== 'production');
  if (!admittedForStorage) {
    throw new AppError('File cannot be admitted while malware scanning is unavailable', 503);
  }
  const target = resolveStoragePath(storageKey);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, req.body, { flag: 'wx', mode: 0o600 });
  let asset: { id: string };
  try {
    asset = await prisma.fileAsset.create({
      data: {
        organizationId: req.organizationId!,
        ownerUserId: req.user!.userId,
        storageKey,
        originalName: upload.filename,
        mimeType: upload.detectedMime,
        size: upload.size,
        sha256: upload.sha256,
        scanStatus: scan.status,
        purpose: (req.header('x-file-purpose') || 'GENERAL').slice(0, 50),
      },
      select: { id: true },
    });
  } catch (error) {
    await unlink(target).catch(() => undefined);
    throw error;
  }
  return res.status(201).json({
    success: true,
    data: {
      ...upload,
      storageKey,
      assetId: asset.id,
      malwareScan: scan,
      admittedForStorage,
    },
  });
};

export const signFile = async (req: Request, res: Response) => {
  const asset = await prisma.fileAsset.findFirst({
    where: {
      organizationId: req.organizationId!,
      storageKey: req.body.fileKey,
    },
    select: { ownerUserId: true, scanStatus: true },
  });
  if (!asset) throw AppError.notFound('File asset not found');
  if (
    asset.ownerUserId !== req.user!.userId &&
    !elevatedFileRoles.has(String(req.user!.role))
  ) {
    throw AppError.notFound('File asset not found');
  }
  if (asset.scanStatus !== 'CLEAN' && process.env.NODE_ENV === 'production') {
    throw AppError.forbidden('File has not passed malware scanning');
  }
  const result = createSignedFileUrl({
    organizationId: req.organizationId!,
    fileKey: req.body.fileKey,
    expiresInSeconds: req.body.expiresInSeconds,
  });
  return res.json({ success: true, data: result });
};

export const downloadFile = async (req: Request, res: Response) => {
  const organizationId = scalarQuery(req.query.organizationId);
  const fileKey = scalarQuery(req.query.key);
  const expiresAt = Number(scalarQuery(req.query.expires));
  const signature = scalarQuery(req.query.signature);
  if (!verifySignedFileRequest({
    organizationId,
    fileKey,
    expiresAt,
    signature,
  })) {
    throw AppError.forbidden('Invalid or expired file URL');
  }
  const asset = await prisma.fileAsset.findFirst({
    where: { organizationId, storageKey: fileKey },
    select: {
      originalName: true,
      mimeType: true,
      size: true,
      scanStatus: true,
    },
  });
  if (!asset || (process.env.NODE_ENV === 'production' && asset.scanStatus !== 'CLEAN')) {
    throw AppError.notFound('File asset not found');
  }
  const body = await readFile(resolveStoragePath(fileKey)).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') throw AppError.notFound('Stored file not found');
      throw new AppError('File storage is unavailable', 503);
    },
  );
  const filename = sanitizeUploadFilename(asset.originalName);
  try {
    inspectUpload(body, asset.mimeType, filename, DEFAULT_UPLOAD_MAX_BYTES);
  } catch {
    throw AppError.forbidden('Stored file failed content validation');
  }
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', asset.mimeType);
  res.setHeader('Content-Length', String(body.length));
  res.setHeader(
    'Content-Disposition',
    `${asset.mimeType.startsWith('image/') ? 'inline' : 'attachment'}; filename="${filename}"`,
  );
  return res.send(body);
};
