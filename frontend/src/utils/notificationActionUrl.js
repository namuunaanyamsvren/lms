import { getRoleRedirectPath } from '../context/AuthContext';

// A notification's actionUrl is either absolute ('/student/assignments?...')
// when only one role can ever receive that notification type, or role-relative
// ('document-requests') when the same notification (e.g. a staff-workflow
// status update) can land on a student, parent, teacher, staff, or admin —
// each of whom has that page under a different role-prefixed base path.
const targetRoutes = {
  studentAccessRequest: '/admin/student-access-requests',
  assignment: '/student/assignments',
  attendance: 'attendance',
  report: 'reports',
  documentRequest: 'document-requests',
  scholarshipRequest: 'scholarships',
  consentForm: '/consent-forms',
  schedule: 'schedules',
};

const appendTargetId = (url, targetType, targetId) => {
  if (!targetId) return url;
  if (targetType === 'assignment' && !url.includes('assignmentId=')) {
    return `${url}${url.includes('?') ? '&' : '?'}assignmentId=${encodeURIComponent(targetId)}`;
  }
  return url;
};

export const resolveNotificationActionUrl = (actionOrNotification, role) => {
  const notification = typeof actionOrNotification === 'object' && actionOrNotification !== null
    ? actionOrNotification
    : { actionUrl: actionOrNotification };
  let actionUrl = notification.actionUrl || targetRoutes[notification.targetType];
  actionUrl = appendTargetId(actionUrl, notification.targetType, notification.targetId);
  if (!actionUrl) return null;
  if (actionUrl.startsWith('/')) return actionUrl;
  return `${getRoleRedirectPath(role)}/${actionUrl}`;
};
