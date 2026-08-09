export const offlineLessonCachePolicy = {
  cacheName: 'lms-offline-lessons-v1',
  allowedContentTypes: ['text/html', 'text/plain', 'application/pdf', 'image/png', 'image/jpeg'],
  maxItemsPerTenant: 100,
  purgeEvents: ['logout', 'tenant-switch', 'session-expired'],
};

export const nativeMobileApiPolicy = {
  apiVersionHeader: 'x-lms-api-version',
  minSupportedVersion: '2026-08',
  deviceSessionHeader: 'x-lms-device-id',
  supportsPushSubscriptions: true,
};
