const DEFAULT_MIN_LENGTH = 12;
const MAX_CHARACTER_LENGTH = 128;
const MAX_BCRYPT_BYTES = 72;
const COMMON_PASSWORDS = new Set([
  '123456789012',
  'admin123456',
  'letmein123456',
  'password',
  'password123',
  'qwerty123456',
  'welcome123456',
]);

const comparable = value => value
  .normalize('NFKC')
  .toLocaleLowerCase('en-US')
  .replace(/[^\p{L}\p{N}]/gu, '');

export const getPasswordMinimumLength = () => {
  const configured = Number(import.meta.env.VITE_PASSWORD_MIN_LENGTH);
  return Number.isSafeInteger(configured) && configured >= DEFAULT_MIN_LENGTH && configured <= 64
    ? configured
    : DEFAULT_MIN_LENGTH;
};

export const validatePasswordForForm = (password, userInfo = {}) => {
  const normalized = password.normalize('NFKC');
  const minLength = getPasswordMinimumLength();
  const length = Array.from(normalized).length;
  if (length < minLength) {
    return `Нууц үг хамгийн багадаа ${minLength} тэмдэгт байх ёстой.`;
  }
  if (
    length > MAX_CHARACTER_LENGTH ||
    new TextEncoder().encode(normalized).length > MAX_BCRYPT_BYTES
  ) {
    return 'Нууц үг зөвшөөрөгдөх дээд уртаас хэтэрсэн байна.';
  }
  if (COMMON_PASSWORDS.has(comparable(normalized))) {
    return 'Түгээмэл, амархан таагдах нууц үг ашиглах боломжгүй.';
  }

  const terms = [
    userInfo.email?.split('@')[0],
    userInfo.phone,
    userInfo.username,
    userInfo.firstName,
    userInfo.lastName,
  ]
    .filter(Boolean)
    .map(comparable)
    .filter(value => value.length >= 4);
  const candidate = comparable(normalized);
  if (terms.some(term => candidate.includes(term) || term.includes(candidate))) {
    return 'Нууц үг таны хувийн мэдээлэлтэй хэт төстэй байна.';
  }
  return null;
};
