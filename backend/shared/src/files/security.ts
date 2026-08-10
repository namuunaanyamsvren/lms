import crypto from 'crypto';
import path from 'path';
import { AppError } from '../errors/AppError';

export const DEFAULT_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
export const MAX_SIGNED_URL_TTL_SECONDS = 15 * 60;

const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'video/mp4': ['.mp4'],
  'application/zip': ['.zip'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
};

const ZIP_MIMES = new Set([
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const startsWith = (buffer: Buffer, bytes: readonly number[], offset = 0) =>
  bytes.every((byte, index) => buffer[offset + index] === byte);

const scalarString = (value: unknown, field: string): string => {
  if (typeof value !== 'string') throw AppError.badRequest(`${field} must be a single string`);
  return value;
};

export function detectFileMime(buffer: Buffer): string | null {
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
      buffer.subarray(0, 6).toString('ascii') === 'GIF89a') {
    return 'image/gif';
  }
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    return 'video/mp4';
  }
  if (
    startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(buffer, [0x50, 0x4b, 0x07, 0x08])
  ) {
    return 'application/zip';
  }
  return null;
}

export function sanitizeUploadFilename(filename: unknown): string {
  const safeFilename = scalarString(filename, 'filename');
  const printable = [...safeFilename.normalize('NFKC')]
    .filter(character => {
      const code = character.charCodeAt(0);
      return code >= 0x20 && code !== 0x7f;
    })
    .join('');
  const basename = path.basename(printable)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 180);
  if (!basename || basename === '.' || basename === '..') {
    throw AppError.badRequest('Invalid upload filename');
  }
  return basename;
}

export type InspectedUpload = {
  filename: string;
  declaredMime: string;
  detectedMime: string;
  size: number;
  sha256: string;
  content: Buffer;
};

export function inspectUpload(
  input: unknown,
  declaredMime: unknown,
  originalFilename: unknown,
  maxBytes = DEFAULT_UPLOAD_MAX_BYTES,
): InspectedUpload {
  if (!Buffer.isBuffer(input) || input.length === 0) {
    throw AppError.badRequest('Upload body is empty');
  }
  const buffer = Buffer.from(input);
  if (buffer.length > maxBytes) {
    throw new AppError('Upload exceeds the permitted size', 413);
  }

  const normalizedMime = scalarString(declaredMime, 'content-type').split(';', 1)[0].trim().toLowerCase();
  const extensions = MIME_EXTENSIONS[normalizedMime];
  if (!extensions) throw AppError.badRequest('This file type is not allowed');

  const filename = sanitizeUploadFilename(originalFilename);
  const extension = path.extname(filename).toLowerCase();
  if (!extensions.includes(extension)) {
    throw AppError.badRequest('Filename extension does not match the declared file type');
  }

  const detectedMime = detectFileMime(buffer);
  const mimeMatches =
    detectedMime === normalizedMime ||
    (detectedMime === 'application/zip' && ZIP_MIMES.has(normalizedMime));
  if (!detectedMime || !mimeMatches) {
    throw AppError.badRequest('File content does not match the declared file type');
  }
  if (detectedMime === 'application/zip' && normalizedMime !== 'application/zip') {
    const archiveDirectory = buffer.toString('latin1');
    const requiredPrefix =
      normalizedMime.includes('wordprocessingml') ? 'word/' :
      normalizedMime.includes('spreadsheetml') ? 'xl/' :
      normalizedMime.includes('presentationml') ? 'ppt/' :
      '';
    if (
      !requiredPrefix ||
      !archiveDirectory.includes('[Content_Types].xml') ||
      !archiveDirectory.includes(requiredPrefix)
    ) {
      throw AppError.badRequest('Office document archive structure is invalid');
    }
  }

  return {
    filename,
    declaredMime: normalizedMime,
    detectedMime: normalizedMime,
    size: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    content: buffer,
  };
}

export type MalwareScanResult = {
  status: 'CLEAN' | 'NOT_CONFIGURED' | 'SCANNER_UNAVAILABLE';
  scanner?: string;
};

export async function scanUploadForMalware(
  buffer: Buffer,
  filename: string,
  sha256: string,
): Promise<MalwareScanResult> {
  const mode = (process.env.MALWARE_SCAN_MODE || 'disabled').toLowerCase();
  if (!['disabled', 'optional', 'required'].includes(mode)) {
    throw AppError.internal('MALWARE_SCAN_MODE is invalid');
  }
  const scannerUrl = process.env.MALWARE_SCANNER_URL?.trim();
  if (!scannerUrl) {
    if (mode === 'required') {
      throw new AppError('File scanning is temporarily unavailable', 503);
    }
    return { status: 'NOT_CONFIGURED' };
  }

  const timeoutMs = Number(process.env.MALWARE_SCAN_TIMEOUT_MS || 10_000);
  try {
    const response = await fetch(scannerUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        'x-file-name': encodeURIComponent(filename),
        'x-content-sha256': sha256,
      },
      body: new Uint8Array(buffer),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`scanner status ${response.status}`);
    const result = await response.json() as {
      clean?: boolean;
      threat?: string;
      scanner?: string;
    };
    if (result.clean !== true) {
      throw new AppError('Malicious file content detected', 422, true, {
        threat: result.threat ? 'detected' : 'unknown',
      });
    }
    return { status: 'CLEAN', scanner: result.scanner };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (mode === 'required') {
      throw new AppError('File scanning is temporarily unavailable', 503);
    }
    return { status: 'SCANNER_UNAVAILABLE' };
  }
}

const getSigningSecret = () => {
  const secret = process.env.FILE_SIGNING_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw AppError.internal('FILE_SIGNING_SECRET must contain at least 32 bytes');
  }
  return secret;
};

const canonicalSignatureInput = (
  organizationId: string,
  fileKey: string,
  expiresAt: number,
) => `${organizationId}\n${fileKey}\n${expiresAt}`;

const hasPathTraversal = (fileKey: string) =>
  fileKey.split('/').some(segment => segment === '..' || segment === '.');

const sign = (organizationId: string, fileKey: string, expiresAt: number) =>
  crypto
    .createHmac('sha256', getSigningSecret())
    .update(canonicalSignatureInput(organizationId, fileKey, expiresAt))
    .digest('base64url');

export function createSignedFileUrl(input: {
  organizationId: string;
  fileKey: string;
  expiresInSeconds?: number;
  now?: Date;
}) {
  const { organizationId, fileKey } = input;
  if (!fileKey.startsWith(`${organizationId}/`) || hasPathTraversal(fileKey)) {
    throw AppError.forbidden('File does not belong to the authenticated organization');
  }
  const expiresInSeconds = input.expiresInSeconds ?? MAX_SIGNED_URL_TTL_SECONDS;
  if (
    !Number.isSafeInteger(expiresInSeconds) ||
    expiresInSeconds < 1 ||
    expiresInSeconds > MAX_SIGNED_URL_TTL_SECONDS
  ) {
    throw AppError.badRequest(`Signed URL lifetime must be 1-${MAX_SIGNED_URL_TTL_SECONDS} seconds`);
  }
  const baseUrl = process.env.FILE_DOWNLOAD_BASE_URL?.trim();
  if (!baseUrl) throw AppError.internal('FILE_DOWNLOAD_BASE_URL is not configured');
  const expiresAt = Math.floor((input.now ?? new Date()).getTime() / 1000) + expiresInSeconds;
  const signature = sign(organizationId, fileKey, expiresAt);
  const url = new URL(baseUrl);
  if (url.pathname === '/') url.pathname = '/api/v1/uploads/download';
  url.searchParams.set('key', fileKey);
  url.searchParams.set('organizationId', organizationId);
  url.searchParams.set('expires', String(expiresAt));
  url.searchParams.set('signature', signature);
  return { url: url.toString(), expiresAt: new Date(expiresAt * 1000) };
}

export function verifySignedFileRequest(input: {
  organizationId: string;
  fileKey: string;
  expiresAt: number;
  signature: string;
  now?: Date;
}) {
  if (!input.fileKey.startsWith(`${input.organizationId}/`) || hasPathTraversal(input.fileKey)) {
    return false;
  }
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (!Number.isSafeInteger(input.expiresAt) || input.expiresAt < nowSeconds) return false;
  if (input.expiresAt - nowSeconds > MAX_SIGNED_URL_TTL_SECONDS) return false;
  const expected = sign(input.organizationId, input.fileKey, input.expiresAt);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(input.signature || '');
  return expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}
