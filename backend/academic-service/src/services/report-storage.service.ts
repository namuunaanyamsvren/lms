import crypto from 'crypto';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import PDFDocument from 'pdfkit';
import { AppError } from '@lms/shared';

import { prisma } from '../lib/prisma';

export type ReportColumn = { key: string; label: string };
export type ReportTable = { columns: ReportColumn[]; rows: Array<Record<string, unknown>> };

const spreadsheetSafe = (value: unknown) => {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

const csvCell = (value: unknown) => {
  const text = spreadsheetSafe(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// Leading BOM so Excel detects UTF-8 instead of mis-rendering Cyrillic column
// labels/values — centralized here (was previously duplicated at each call
// site: report.controller.ts's export endpoint and report-job.service.ts's
// background job renderer both independently prepended it).
export const renderCsv = (table: ReportTable): string => '﻿' + [
  table.columns.map(c => csvCell(c.label)).join(','),
  ...table.rows.map(row => table.columns.map(c => csvCell(row[c.key])).join(',')),
].join('\r\n');

export const renderPdf = (title: string, generatedAt: Date, table: ReportTable): Promise<Buffer> => {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 40, right: 40 } });
  const chunks: Buffer[] = [];
  doc.on('data', chunk => chunks.push(Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text(title);
  doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(`Үүсгэсэн: ${generatedAt.toISOString().slice(0, 19).replace('T', ' ')}`);
  doc.moveDown(0.8);

  const colWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / Math.max(table.columns.length, 1);
  const rowHeight = 18;

  const drawHeader = () => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a');
    table.columns.forEach((col, i) => {
      doc.text(col.label, doc.page.margins.left + i * colWidth, doc.y, { width: colWidth - 4, ellipsis: true });
    });
    doc.moveDown(1);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#cbd5e1').stroke();
    doc.moveDown(0.3);
  };

  drawHeader();
  doc.font('Helvetica').fontSize(8).fillColor('#1e293b');
  table.rows.forEach(row => {
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
      doc.font('Helvetica').fontSize(8).fillColor('#1e293b');
    }
    const y = doc.y;
    table.columns.forEach((col, i) => {
      doc.text(String(row[col.key] ?? ''), doc.page.margins.left + i * colWidth, y, { width: colWidth - 4, ellipsis: true });
    });
    doc.moveDown(1);
  });

  doc.end();
  return done;
};

const resolveStoragePath = (fileKey: string) => {
  const root = process.env.FILE_STORAGE_DIRECTORY?.trim();
  if (!root) throw new AppError('File storage is unavailable', 503);
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, ...fileKey.split('/'));
  if (!target.startsWith(`${absoluteRoot}${path.sep}`)) throw AppError.forbidden('Invalid storage key');
  return target;
};

export const storeReportFile = async (
  organizationId: string,
  ownerUserId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string,
) => {
  const storageKey = `${organizationId}/reports/${crypto.randomUUID()}/${filename}`;
  const target = resolveStoragePath(storageKey);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, buffer, { mode: 0o600 });
  const asset = await prisma.fileAsset.create({
    data: {
      organizationId,
      ownerUserId,
      storageKey,
      originalName: filename,
      mimeType,
      size: buffer.length,
      sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
      scanStatus: 'CLEAN',
      purpose: 'REPORT_EXPORT',
    },
  });
  return asset;
};
