export const DEFAULT_LOCALE = 'mn-MN';
export const FALLBACK_LOCALE = 'en-US';
export const DEFAULT_TIME_ZONE = 'Asia/Ulaanbaatar';

export const catalogs = {
  'mn-MN': {
    'onboarding.title': 'Байгууллага үүсгэх',
    'onboarding.subtitle': 'Шинэ LMS tenant болон анхны менежерийг бэлтгэнэ.',
    'onboarding.name': 'Байгууллагын нэр',
    'onboarding.slug': 'Tenant slug',
    'onboarding.domain': 'Домэйн (заавал биш)',
    'onboarding.adminFirstName': 'Менежерийн нэр',
    'onboarding.adminLastName': 'Менежерийн овог',
    'onboarding.adminEmail': 'Менежерийн и-мэйл',
    'onboarding.adminPassword': 'Менежерийн нууц үг',
    'onboarding.maxUsers': 'Хэрэглэгчийн дээд тоо',
    'onboarding.submit': 'Байгууллага үүсгэх',
    'onboarding.saving': 'Үүсгэж байна...',
    'onboarding.haveTenant': 'Tenant байгаа юу?',
    'onboarding.signIn': 'Нэвтрэх',
    'errors.canceled': 'Хүсэлт цуцлагдлаа.',
    'errors.network': 'Сүлжээний алдаа гарлаа. Дахин оролдоно уу.',
    'errors.default': 'Алдаа гарлаа. Дахин оролдоно уу.',
    'errors.UNAUTHORIZED': 'Нэвтрэх шаардлагатай.',
    'errors.FORBIDDEN': 'Хандах эрх хүрэлцэхгүй.',
    'errors.NOT_FOUND': 'Мэдээлэл олдсонгүй.',
    'errors.VALIDATION_ERROR': 'Оруулсан мэдээллээ шалгана уу.',
    'errors.INVALID_CREDENTIALS': 'И-мэйл эсвэл нууц үг буруу байна.',
    'errors.TENANT_NOT_FOUND': 'Байгууллага олдсонгүй.',
    'errors.DUPLICATE_RESOURCE': 'Ижил мэдээлэл аль хэдийн бүртгэлтэй байна.',
    'errors.RATE_LIMITED': 'Хэт олон хүсэлт илгээлээ. Түр хүлээгээд дахин оролдоно уу.',
    'errors.SESSION_EXPIRED': 'Нэвтрэлт дууссан байна. Дахин нэвтэрнэ үү.',
  },
  'en-US': {
    'onboarding.title': 'Create your organization',
    'onboarding.subtitle': 'Provision a new LMS tenant and its first administrator.',
    'onboarding.name': 'Organization name',
    'onboarding.slug': 'Tenant slug',
    'onboarding.domain': 'Domain (optional)',
    'onboarding.adminFirstName': 'Admin first name',
    'onboarding.adminLastName': 'Admin last name',
    'onboarding.adminEmail': 'Admin email',
    'onboarding.adminPassword': 'Admin password',
    'onboarding.maxUsers': 'Maximum users',
    'onboarding.submit': 'Create organization',
    'onboarding.saving': 'Creating...',
    'onboarding.haveTenant': 'Already have a tenant?',
    'onboarding.signIn': 'Sign in',
    'errors.canceled': 'Request was canceled.',
    'errors.network': 'Network error. Please try again.',
    'errors.default': 'Something went wrong. Please try again.',
  },
};

export function t(key, params = {}, locale = DEFAULT_LOCALE) {
  const template = catalogs[locale]?.[key] || catalogs[FALLBACK_LOCALE]?.[key] || key;
  return Object.entries(params).reduce(
    (value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)),
    template,
  );
}
