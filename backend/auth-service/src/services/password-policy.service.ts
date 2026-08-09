import crypto from 'crypto';
import { AppError } from '@lms/shared';

const DEFAULT_MIN_LENGTH = 12;
const MAX_CHARACTER_LENGTH = 128;
const MAX_BCRYPT_BYTES = 72;
const DEFAULT_PWNED_API_URL = 'https://api.pwnedpasswords.com';
const DEFAULT_TIMEOUT_MS = 3_000;

const COMMON_PASSWORDS = new Set([
  '123456789012',
  'admin123456',
  'letmein123456',
  'password',
  'password123',
  'qwerty123456',
  'welcome123456',
]);

export interface PasswordUserInfo {
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface PasswordPolicyOptions {
  minLength?: number;
  userInfo?: PasswordUserInfo;
  compromisedCheckEnabled?: boolean;
  compromisedFailureMode?: 'allow' | 'deny';
  fetchImpl?: typeof fetch;
}

const parseMinimumLength = (override?: number): number => {
  const configured = override ?? Number(process.env.PASSWORD_MIN_LENGTH || DEFAULT_MIN_LENGTH);
  if (!Number.isSafeInteger(configured) || configured < DEFAULT_MIN_LENGTH || configured > 64) {
    throw AppError.internal('Password policy configuration is invalid');
  }
  return configured;
};

const comparable = (value: string): string =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]/gu, '');

const userInfoTerms = (userInfo: PasswordUserInfo): string[] => {
  const emailLocalPart = userInfo.email?.split('@')[0];
  return [
    emailLocalPart,
    userInfo.phone,
    userInfo.username,
    userInfo.firstName,
    userInfo.lastName,
  ]
    .filter((value): value is string => Boolean(value))
    .map(comparable)
    .filter(value => value.length >= 4);
};

const isDerivedFromUserInfo = (
  password: string,
  userInfo: PasswordUserInfo = {},
): boolean => {
  const candidate = comparable(password);
  return userInfoTerms(userInfo).some(term =>
    candidate.includes(term) || term.includes(candidate));
};

const isCompromisedCheckEnabled = (override?: boolean): boolean =>
  override ?? process.env.PASSWORD_COMPROMISED_CHECK_ENABLED === 'true';

const getFailureMode = (
  override?: 'allow' | 'deny',
): 'allow' | 'deny' => {
  const value = override ?? process.env.PASSWORD_COMPROMISED_CHECK_FAILURE_MODE ?? 'allow';
  if (value !== 'allow' && value !== 'deny') {
    throw AppError.internal('Password compromised-check configuration is invalid');
  }
  return value;
};

export const normalizePassword = (password: string): string =>
  password.normalize('NFKC');

export const checkCompromisedPassword = async (
  password: string,
  options: PasswordPolicyOptions = {},
): Promise<boolean> => {
  if (!isCompromisedCheckEnabled(options.compromisedCheckEnabled)) return false;

  // The Have I Been Pwned k-anonymity API requires SHA-1 prefix lookup.
  // This digest is never used for password storage or authentication.
  const pwnedRangeDigest = crypto
    .createHash('sha1')
    .update(password, 'utf8')
    .digest('hex')
    .toUpperCase();
  const prefix = pwnedRangeDigest.slice(0, 5);
  const suffix = pwnedRangeDigest.slice(5);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    const baseUrl = process.env.PASSWORD_COMPROMISED_API_URL || DEFAULT_PWNED_API_URL;
    const response = await fetchImpl(`${baseUrl}/range/${prefix}`, {
      headers: {
        'Add-Padding': 'true',
        'User-Agent': 'LMS-password-policy',
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Compromised-password service unavailable');
    const matches = (await response.text()).split(/\r?\n/);
    return matches.some(line => line.split(':', 1)[0]?.toUpperCase() === suffix);
  } catch {
    if (getFailureMode(options.compromisedFailureMode) === 'deny') {
      throw AppError.internal(
        'Нууц үгийн аюулгүй байдлыг одоогоор шалгах боломжгүй байна. Дараа дахин оролдоно уу.',
      );
    }
    // Availability-first: local checks still apply while the optional
    // k-anonymity service is unavailable.
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

export const enforcePasswordPolicy = async (
  password: string,
  options: PasswordPolicyOptions = {},
): Promise<string> => {
  const normalized = normalizePassword(password);
  const minLength = parseMinimumLength(options.minLength);
  const characterLength = Array.from(normalized).length;

  if (characterLength < minLength) {
    throw AppError.badRequest(`Нууц үг хамгийн багадаа ${minLength} тэмдэгт байх ёстой.`);
  }
  if (
    characterLength > MAX_CHARACTER_LENGTH ||
    Buffer.byteLength(normalized, 'utf8') > MAX_BCRYPT_BYTES
  ) {
    throw AppError.badRequest('Нууц үг зөвшөөрөгдөх дээд уртаас хэтэрсэн байна.');
  }
  if (COMMON_PASSWORDS.has(comparable(normalized))) {
    throw AppError.badRequest('Түгээмэл, амархан таагдах нууц үг ашиглах боломжгүй.');
  }
  if (isDerivedFromUserInfo(normalized, options.userInfo)) {
    throw AppError.badRequest('Нууц үг хувийн мэдээлэлтэй хэт төстэй байна.');
  }
  if (await checkCompromisedPassword(normalized, options)) {
    throw AppError.badRequest('Энэ нууц үг өмнө нь мэдээллийн алдагдалд өртсөн байна.');
  }

  return normalized;
};
