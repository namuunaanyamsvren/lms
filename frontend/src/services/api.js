import { apiClient, authRequest } from './apiClient';
import { notifyScheduleChanged } from './scheduleCache';

const BASE_API_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const fetchWithAuth = async (url, options = {}) => {
  const response = await apiClient.request({
    url: url.startsWith(BASE_API_URL) ? url.slice(BASE_API_URL.length) : url,
    method: options.method || 'GET',
    headers: options.headers,
    data: options.body ? JSON.parse(options.body) : undefined,
    signal: options.signal,
  });
  return response.status === 204 ? { success: true } : response.data;
};

const normalizeNotification = (notification) => ({
  ...notification,
  description: notification.body,
  read: notification.isRead,
  metadata: notification.metadata || {},
  actionUrl: notification.metadata?.actionUrl || null,
  targetType: notification.metadata?.targetType || null,
  targetId: notification.metadata?.targetId || null,
});

export const fetchCourses = async (params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
  const data = await fetchWithAuth(`${BASE_API_URL}/courses?${query}`);
  return data.success ? data.data : { items: [], pagination: { page: 1, pages: 0, total: 0 } };
};

export const fetchCourseById = async id => {
  const data = await fetchWithAuth(`${BASE_API_URL}/courses/${id}`);
  return data.data;
};

export const createCourse = payload =>
  fetchWithAuth(`${BASE_API_URL}/courses`, { method: 'POST', body: JSON.stringify(payload) });

export const updateCourse = (id, payload) =>
  fetchWithAuth(`${BASE_API_URL}/courses/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const fetchCourseVersions = async id => {
  const data = await fetchWithAuth(`${BASE_API_URL}/courses/${id}/versions`);
  return data.data || [];
};
export const compareCourseVersions = async (id, from, to) => {
  const data = await fetchWithAuth(`${BASE_API_URL}/courses/${id}/versions/compare?from=${from}&to=${to}`);
  return data.data;
};
export const restoreCourseVersion = (id, version) =>
  fetchWithAuth(`${BASE_API_URL}/courses/${id}/versions/${version}/restore`, { method: 'POST', body: '{}' });

export const deleteCourse = id => fetchWithAuth(`${BASE_API_URL}/courses/${id}`, { method: 'DELETE' });
export const duplicateCourse = (id, payload) => fetchWithAuth(`${BASE_API_URL}/courses/${id}/duplicate`, { method: 'POST', body: JSON.stringify(payload) });
export const addCourseInstructor = (id, userId) => fetchWithAuth(`${BASE_API_URL}/courses/${id}/instructors`, { method: 'POST', body: JSON.stringify({ userId }) });
export const removeCourseInstructor = (id, userId) => fetchWithAuth(`${BASE_API_URL}/courses/${id}/instructors/${userId}`, { method: 'DELETE' });
export const createModule = (courseId, payload) => fetchWithAuth(`${BASE_API_URL}/courses/${courseId}/modules`, { method: 'POST', body: JSON.stringify(payload) });
export const updateModule = (moduleId, payload) => fetchWithAuth(`${BASE_API_URL}/modules/${moduleId}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteModule = moduleId => fetchWithAuth(`${BASE_API_URL}/modules/${moduleId}`, { method: 'DELETE' });
export const reorderModules = (courseId, ids) => fetchWithAuth(`${BASE_API_URL}/courses/${courseId}/modules/reorder`, { method: 'PUT', body: JSON.stringify({ ids }) });
export const createLesson = (moduleId, payload) => fetchWithAuth(`${BASE_API_URL}/modules/${moduleId}/lessons`, { method: 'POST', body: JSON.stringify(payload) });
export const updateLesson = (lessonId, payload) => fetchWithAuth(`${BASE_API_URL}/lessons/${lessonId}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteLesson = lessonId => fetchWithAuth(`${BASE_API_URL}/lessons/${lessonId}`, { method: 'DELETE' });
export const reorderLessons = (moduleId, ids) => fetchWithAuth(`${BASE_API_URL}/modules/${moduleId}/lessons/reorder`, { method: 'PUT', body: JSON.stringify({ ids }) });
export const completeLesson = lessonId => fetchWithAuth(`${BASE_API_URL}/lessons/${lessonId}/complete`, { method: 'POST', body: '{}' });
export const fetchAcademicStructure = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/academic-structure`);
  return data.data;
};
export const createAcademicItem = (resource, payload) => fetchWithAuth(`${BASE_API_URL}/academic-structure/${resource}`, { method: 'POST', body: JSON.stringify(payload) });
export const updateAcademicItem = (resource, id, payload) => fetchWithAuth(`${BASE_API_URL}/academic-structure/${resource}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteAcademicItem = (resource, id) => fetchWithAuth(`${BASE_API_URL}/academic-structure/${resource}/${id}`, { method: 'DELETE' });
export const rolloverAcademicYear = (id, payload) => fetchWithAuth(`${BASE_API_URL}/academic-structure/years/${id}/rollover`, { method: 'POST', body: JSON.stringify(payload) });

const queryString = params => new URLSearchParams(
  Object.entries(params || {}).filter(([, value]) => value !== '' && value != null),
).toString();

export const fetchSchedules = async (params = {}) => {
  const query = queryString(params);
  const data = await fetchWithAuth(`${BASE_API_URL}/schedules${query ? `?${query}` : ''}`);
  return data.data;
};

export const fetchMySchedules = async (params = {}) => {
  const query = queryString(params);
  const data = await fetchWithAuth(`${BASE_API_URL}/schedules/me${query ? `?${query}` : ''}`);
  return data.data;
};

export const fetchScheduleOptions = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/schedules/options`);
  return data.data;
};

export const fetchScheduleById = async id => {
  const data = await fetchWithAuth(`${BASE_API_URL}/schedules/${id}`);
  return data.data;
};

export const createSchedule = payload =>
  fetchWithAuth(`${BASE_API_URL}/schedules`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then(data => {
    notifyScheduleChanged({ action: 'created', scheduleId: data.data?.id });
    return data;
  });

export const updateSchedule = (id, payload) =>
  fetchWithAuth(`${BASE_API_URL}/schedules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }).then(data => {
    notifyScheduleChanged({ action: 'updated', scheduleId: id });
    return data;
  });

export const deleteSchedule = id =>
  fetchWithAuth(`${BASE_API_URL}/schedules/${id}`, { method: 'DELETE' }).then(data => {
    notifyScheduleChanged({ action: 'deleted', scheduleId: id });
    return data;
  });

export const getStudentDashboardData = async () => {
  const raw = await fetchWithAuth(`${BASE_API_URL}/dashboards/student`);
  return raw.data;
};

export const getAdminDashboardData = async () => {
  const raw = await fetchWithAuth(`${BASE_API_URL}/dashboards/admin`);
  return raw.data;
};

export const getTeacherDashboardData = async () => {
  const raw = await fetchWithAuth(`${BASE_API_URL}/dashboards/teacher`);
  return raw.data;
};

export const getParentDashboardData = async (studentId = '') => {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : '';
  const raw = await fetchWithAuth(`${BASE_API_URL}/dashboards/parent${query}`);
  return raw.data;
};

export const getStaffDashboardData = async () => {
  const raw = await fetchWithAuth(`${BASE_API_URL}/dashboards/staff`);
  return raw.data;
};

export const getPrincipalDashboardData = async () => {
  const raw = await fetchWithAuth(`${BASE_API_URL}/dashboards/principal`);
  return raw.data;
};

export const fetchAssignments = async () => {
  try {
    const data = await fetchWithAuth(`${BASE_API_URL}/assignments`);
    return data.success ? data.data : [];
  } catch (err) {
    console.error('Failed to fetch assignments:', err);
    return [];
  }
};

export const createAssignment = payload =>
  fetchWithAuth(`${BASE_API_URL}/assignments`, { method: 'POST', body: JSON.stringify(payload) });

export const updateAssignment = (id, payload) =>
  fetchWithAuth(`${BASE_API_URL}/assignments/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const submitAssignment = (assignmentId, payload) =>
  fetchWithAuth(`${BASE_API_URL}/assignments/${assignmentId}/submissions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateSubmission = (id, payload) =>
  fetchWithAuth(`${BASE_API_URL}/submissions/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const uploadSubmissionFile = async (file) => {
  const response = await apiClient.request({
    url: '/uploads',
    method: 'POST',
    data: file,
    timeout: 60_000,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-file-name': file.name,
      'x-file-purpose': 'SUBMISSION_ATTACHMENT',
    },
  });
  return response.data.data;
};

export const addSubmissionAttachment = (submissionId, fileAssetId) =>
  fetchWithAuth(`${BASE_API_URL}/submissions/${submissionId}/attachments`, {
    method: 'POST',
    body: JSON.stringify({ fileAssetId }),
  });

export const removeSubmissionAttachment = (submissionId, attachmentId) =>
  fetchWithAuth(`${BASE_API_URL}/submissions/${submissionId}/attachments/${attachmentId}`, { method: 'DELETE' });

export const fetchQuizzes = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/quizzes`);
  return data.success ? data.data : [];
};
export const fetchQuiz = async id => { const data = await fetchWithAuth(`${BASE_API_URL}/quizzes/${id}`); return data.data; };
export const createQuiz = payload => fetchWithAuth(`${BASE_API_URL}/quizzes`, { method:'POST', body:JSON.stringify(payload) });
export const updateQuiz = (id,payload) => fetchWithAuth(`${BASE_API_URL}/quizzes/${id}`, { method:'PUT', body:JSON.stringify(payload) });
export const deleteQuiz = id => fetchWithAuth(`${BASE_API_URL}/quizzes/${id}`, { method:'DELETE' });
export const createQuizQuestion = (id,payload) => fetchWithAuth(`${BASE_API_URL}/quizzes/${id}/questions`, { method:'POST', body:JSON.stringify(payload) });
export const fetchQuestionBank = async params => { const data=await fetchWithAuth(`${BASE_API_URL}/question-bank?${new URLSearchParams(params||{})}`); return data.data; };
export const linkQuizQuestion = (id,questionId) => fetchWithAuth(`${BASE_API_URL}/quizzes/${id}/question-links`, { method:'POST', body:JSON.stringify({questionId}) });
export const startQuizAttempt = async id => { const data=await fetchWithAuth(`${BASE_API_URL}/quizzes/${id}/attempts`, {method:'POST',body:'{}'}); return data.data; };
export const resumeQuizAttempt = async id => { const data=await fetchWithAuth(`${BASE_API_URL}/quiz-attempts/${id}`); return data.data; };
export const saveQuizAnswer = (attemptId,questionId,answer) => fetchWithAuth(`${BASE_API_URL}/quiz-attempts/${attemptId}/answers/${questionId}`, {method:'PUT',body:JSON.stringify({answer,clientTimestamp:new Date().toISOString()})});
export const submitQuizAttempt = id => fetchWithAuth(`${BASE_API_URL}/quiz-attempts/${id}/submit`, {method:'POST',body:JSON.stringify({idempotencyKey:crypto.randomUUID()})});
export const fetchQuizHistory = async id => { const data=await fetchWithAuth(`${BASE_API_URL}/quizzes/${id}/attempts/me`); return data.data; };
export const recordQuizAudit = (id,eventType,metadata={}) => fetchWithAuth(`${BASE_API_URL}/quiz-attempts/${id}/audit-events`, {method:'POST',body:JSON.stringify({eventType,metadata})});
export const fetchQuizAnalytics = async id => { const data=await fetchWithAuth(`${BASE_API_URL}/quizzes/${id}/analytics`); return data.data; };
export const gradeQuizAnswer = (attemptId,questionId,payload) => fetchWithAuth(`${BASE_API_URL}/quiz-attempts/${attemptId}/answers/${questionId}/grade`, {method:'PUT',body:JSON.stringify(payload)});

export const fetchAttendance = async (params = {}) => {
  try {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
    const data = await fetchWithAuth(`${BASE_API_URL}/attendance?${query}`);
    return data.success ? data.data : [];
  } catch (err) {
    console.error('Failed to fetch attendance:', err);
    return [];
  }
};

export const fetchCohorts = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/cohorts`);
  return data.data;
};

export const createAttendance = payload =>
  fetchWithAuth(`${BASE_API_URL}/attendance`, { method: 'POST', body: JSON.stringify(payload) });

export const updateAttendance = (id, payload) =>
  fetchWithAuth(`${BASE_API_URL}/attendance/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const batchRecordAttendance = (payload) =>
  fetchWithAuth(`${BASE_API_URL}/attendance/batch`, { method: 'POST', body: JSON.stringify(payload) });

export const fetchAttendanceHistory = async (id) => {
  const data = await fetchWithAuth(`${BASE_API_URL}/attendance/${id}/history`);
  return data.success ? data.data : [];
};

export const exportAttendanceCsv = async (params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
  const response = await apiClient.request({ url: `/attendance/export?${query}`, method: 'GET', responseType: 'blob' });
  return response.data;
};

export const fetchGrades = async () => {
  try {
    const data = await fetchWithAuth(`${BASE_API_URL}/grades`);
    return data.success ? data.data : [];
  } catch (err) {
    console.error('Failed to fetch grades:', err);
    return [];
  }
};

export const fetchSubmissions = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/submissions`);
  return data.data;
};

export const createGrade = (submissionId, payload) =>
  fetchWithAuth(`${BASE_API_URL}/submissions/${submissionId}/grades`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateGrade = (id, payload) =>
  fetchWithAuth(`${BASE_API_URL}/grades/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const fetchGradeCategories = async (courseId) => {
  const data = await fetchWithAuth(`${BASE_API_URL}/courses/${courseId}/grade-categories`);
  return data.success ? data.data : [];
};

export const createGradeCategory = (courseId, payload) =>
  fetchWithAuth(`${BASE_API_URL}/courses/${courseId}/grade-categories`, { method: 'POST', body: JSON.stringify(payload) });

export const updateGradeCategory = (id, payload) =>
  fetchWithAuth(`${BASE_API_URL}/grade-categories/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const deleteGradeCategory = (id) =>
  fetchWithAuth(`${BASE_API_URL}/grade-categories/${id}`, { method: 'DELETE' });

export const createManualGrade = (payload) =>
  fetchWithAuth(`${BASE_API_URL}/grades/manual`, { method: 'POST', body: JSON.stringify(payload) });

export const publishGrade = (id) =>
  fetchWithAuth(`${BASE_API_URL}/grades/${id}/publish`, { method: 'POST' });

export const fetchGradeHistory = async (id) => {
  const data = await fetchWithAuth(`${BASE_API_URL}/grades/${id}/history`);
  return data.success ? data.data : [];
};

export const createGradeAppeal = (gradeId, payload) =>
  fetchWithAuth(`${BASE_API_URL}/grades/${gradeId}/appeals`, { method: 'POST', body: JSON.stringify(payload) });

export const fetchGradeAppeals = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/grades/appeals`);
  return data.success ? data.data : [];
};

export const resolveGradeAppeal = (id, payload) =>
  fetchWithAuth(`${BASE_API_URL}/grades/appeals/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const downloadGradeImportTemplate = () =>
  new Blob(['studentEmail,score,feedback\nstudent@example.com,90,Great work\n'], { type: 'text/csv' });

export const bulkImportGrades = (assignmentId, csvText) =>
  fetchWithAuth(`${BASE_API_URL}/assignments/${assignmentId}/grades/bulk-import`, { method: 'POST', body: JSON.stringify({ csv: csvText }) });

export const exportGradesCsv = async (assignmentId) => {
  const response = await apiClient.request({ url: `/assignments/${assignmentId}/grades/export`, method: 'GET', responseType: 'blob' });
  return response.data;
};

export const fetchCourseGradebook = async (courseId) => {
  const data = await fetchWithAuth(`${BASE_API_URL}/courses/${courseId}/gradebook`);
  return data.success ? data.data : { categories: [], students: [] };
};

export const fetchAtRiskStudents = async (courseId) => {
  const data = await fetchWithAuth(`${BASE_API_URL}/courses/${courseId}/at-risk-students`);
  return data.success ? data.data : [];
};

export const fetchTranscript = async (studentId = 'me') => {
  const data = await fetchWithAuth(`${BASE_API_URL}/students/${studentId}/transcript`);
  return data.success ? data.data : { courses: [], terms: [], cumulativeGpa: null };
};

export const fetchCertificates = async () => {
  try {
    const data = await fetchWithAuth(`${BASE_API_URL}/certificates`);
    return data.success ? data.data : [];
  } catch (err) {
    console.error('Failed to fetch certificates:', err);
    return [];
  }
};
export const downloadCertificate = async (id) => {
  const response = await apiClient.request({ url: `/certificates/${id}/download`, method: 'GET', responseType: 'blob' });
  const url = URL.createObjectURL(response.data); const link = document.createElement('a');
  link.href = url; link.download = `certificate-${id}.pdf`; link.click(); URL.revokeObjectURL(url);
};
export const verifyCertificate = async code => {
  const response = await fetch(`${BASE_API_URL}/certificates/verify/${encodeURIComponent(code)}`);
  if (!response.ok) throw new Error('Certificate not found'); return (await response.json()).data;
};
export const revokeCertificate = (id, reason) => fetchWithAuth(`${BASE_API_URL}/certificates/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) });
export const reissueCertificate = (id, reason) => fetchWithAuth(`${BASE_API_URL}/certificates/${id}/reissue`, { method: 'POST', body: JSON.stringify({ reason }) });
export const fetchCertificateTemplates = async () => (await fetchWithAuth(`${BASE_API_URL}/certificate-templates`)).data;
export const createCertificateTemplate = payload => fetchWithAuth(`${BASE_API_URL}/certificate-templates`, { method: 'POST', body: JSON.stringify(payload) });
export const previewCertificateTemplate = async (payload) => {
  const response = await apiClient.request({ url: '/certificate-templates/preview', method: 'POST', data: payload, responseType: 'blob' });
  return response.data;
};
export const completeCohort = (cohortId) => fetchWithAuth(`${BASE_API_URL}/cohorts/${cohortId}/complete`, { method: 'POST', body: '{}' });

export const fetchUsers = async (params = {}, signal) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
  const data = await fetchWithAuth(`${BASE_API_URL}/users?${query}`, { signal });
  return data.success ? { items: data.data, pagination: data.pagination } : { items: [], pagination: null };
};

export const createUser = (payload) =>
  fetchWithAuth(`${BASE_API_URL}/users`, { method: 'POST', body: JSON.stringify(payload) });

export const updateUserAdmin = (id, payload) =>
  fetchWithAuth(`${BASE_API_URL}/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const deactivateUserAdmin = (id) =>
  fetchWithAuth(`${BASE_API_URL}/users/${id}`, { method: 'DELETE' });

export const fetchStudentAccessRequests = async (params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
  const data = await fetchWithAuth(`${BASE_API_URL}/notifications/student-access-requests?${query}`);
  return data.success ? { items: data.data, pagination: data.pagination } : { items: [], pagination: null };
};

export const fetchMyStudentAccessRequests = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/notifications/student-access-requests/me`);
  return data.success ? data.data : [];
};

export const reviewStudentAccessRequest = (id, payload) =>
  fetchWithAuth(`${BASE_API_URL}/notifications/student-access-requests/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const downloadUserCsvTemplate = async () => {
  const response = await apiClient.request({ url: '/users/import/template', method: 'GET', responseType: 'blob' });
  return response.data;
};

export const importUsersCsv = (csvText) =>
  fetchWithAuth(`${BASE_API_URL}/users/import`, { method: 'POST', body: JSON.stringify({ csv: csvText }) });

export const exportUsersCsv = async (params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
  const response = await apiClient.request({ url: `/users/export?${query}`, method: 'GET', responseType: 'blob' });
  return response.data;
};

export const updateMyProfile = (payload) =>
  fetchWithAuth(`${BASE_API_URL}/users/me`, { method: 'PATCH', body: JSON.stringify(payload) });

export const fetchMyMemberships = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/users/me/memberships`);
  return data.success ? data.data : [];
};

export const uploadAvatar = async (file) => {
  const response = await apiClient.request({
    url: '/uploads',
    method: 'POST',
    data: file,
    timeout: 60_000,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-file-name': file.name,
      'x-file-purpose': 'AVATAR',
    },
  });
  return response.data.data;
};

export const getSignedFileUrl = async (fileKey) => {
  const response = await apiClient.request({ url: '/uploads/sign', method: 'POST', data: { fileKey } });
  return response.data.data;
};

export const uploadFile = async (file, purpose = 'GENERAL') => {
  const response = await apiClient.request({
    url: '/uploads',
    method: 'POST',
    data: file,
    timeout: 60_000,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-file-name': file.name,
      'x-file-purpose': purpose,
    },
  });
  return response.data.data;
};

export const fetchGuardianLinks = async (params = {}, signal) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
  const data = await fetchWithAuth(`${BASE_API_URL}/guardians?${query}`, { signal });
  return data.success ? data.data : [];
};

export const createGuardianLink = (payload) =>
  fetchWithAuth(`${BASE_API_URL}/guardians`, { method: 'POST', body: JSON.stringify(payload) });

export const respondToGuardianLink = (id, status) =>
  fetchWithAuth(`${BASE_API_URL}/guardians/${id}/respond`, { method: 'PATCH', body: JSON.stringify({ status }) });

export const updateGuardianLink = (id, payload) =>
  fetchWithAuth(`${BASE_API_URL}/guardians/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const revokeGuardianLink = (id) =>
  fetchWithAuth(`${BASE_API_URL}/guardians/${id}`, { method: 'DELETE' });

export const fetchConsentForms = async (params = {}, signal) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
  const data = await fetchWithAuth(`${BASE_API_URL}/consent-forms?${query}`, { signal });
  return data.success ? data.data : [];
};

export const createConsentForm = (payload) =>
  fetchWithAuth(`${BASE_API_URL}/consent-forms`, { method: 'POST', body: JSON.stringify(payload) });

export const updateConsentForm = (id, payload) =>
  fetchWithAuth(`${BASE_API_URL}/consent-forms/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const publishConsentForm = (id) =>
  fetchWithAuth(`${BASE_API_URL}/consent-forms/${id}/publish`, { method: 'POST' });

export const fetchConsentAcknowledgements = async (id) => {
  const data = await fetchWithAuth(`${BASE_API_URL}/consent-forms/${id}/acknowledgements`);
  return data.success ? data.data : [];
};

export const acknowledgeConsentForm = (id, payload) =>
  fetchWithAuth(`${BASE_API_URL}/consent-forms/${id}/acknowledge`, { method: 'POST', body: JSON.stringify(payload) });

export const fetchTeacherStudents = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/students`);
  return data.success ? data.data : [];
};

export const fetchAvailableStudents = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/students/available`);
  return data.success ? data.data : [];
};

export const enrollStudent = (cohortId, userId) =>
  fetchWithAuth(`${BASE_API_URL}/cohorts/${cohortId}/enrollments`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });

export const importCohortEnrollments = (cohortId, csv) =>
  fetchWithAuth(`${BASE_API_URL}/cohorts/${cohortId}/enrollments/import`, {
    method: 'POST',
    body: JSON.stringify({ csv }),
  });

export const removeEnrollment = enrollmentId =>
  fetchWithAuth(`${BASE_API_URL}/enrollments/${enrollmentId}`, { method: 'DELETE' });

export const createCohort = payload =>
  fetchWithAuth(`${BASE_API_URL}/cohorts`, { method: 'POST', body: JSON.stringify(payload) });

export const fetchAnnouncements = async (params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
  const data = await fetchWithAuth(`${BASE_API_URL}/announcements?${query}`);
  return data.success ? data.data : [];
};

export const createAnnouncement = payload =>
  fetchWithAuth(`${BASE_API_URL}/announcements`, { method: 'POST', body: JSON.stringify(payload) });

export const fetchNotifications = async (limit = 20) => {
  const data = await fetchWithAuth(`${BASE_API_URL}/notifications?limit=${limit}`);
  return data.success ? data.data.map(normalizeNotification) : [];
};

export const markNotificationAsRead = (id) =>
  fetchWithAuth(`${BASE_API_URL}/notifications/${id}/read`, { method: 'PATCH' });

export const markAllNotificationsAsRead = () =>
  fetchWithAuth(`${BASE_API_URL}/notifications/read-all`, { method: 'PATCH' });

export const deleteNotification = (id) =>
  fetchWithAuth(`${BASE_API_URL}/notifications/${id}`, { method: 'DELETE' });

export const clearNotifications = () =>
  fetchWithAuth(`${BASE_API_URL}/notifications`, { method: 'DELETE' });
export const fetchUnreadNotificationCount = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/notifications/unread-count`);
  return data.data.count;
};
export const fetchNotificationPreferences = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/notifications/preferences`);
  return data.data;
};
export const updateNotificationPreferences = async payload => {
  const data = await fetchWithAuth(`${BASE_API_URL}/notifications/preferences`, { method:'PUT', body:JSON.stringify(payload) });
  return data.data;
};

export const fetchCurrentOrganization = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/organizations/current`);
  return data.data;
};

export const fetchPublicOrganizations = async (params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
  const data = await fetchWithAuth(`${BASE_API_URL}/organizations/public?${query}`);
  return data.data || [];
};

export const requestStudentAccess = (payload) =>
  fetchWithAuth(`${BASE_API_URL}/notifications/student-access-requests`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateCurrentOrganization = async (organization) => {
  const data = await fetchWithAuth(`${BASE_API_URL}/organizations/current`, {
    method: 'PUT',
    body: JSON.stringify(organization),
  });
  return data.data;
};

export const updateOrganizationSettings = async (settings) => {
  const data = await fetchWithAuth(`${BASE_API_URL}/organizations/current/settings`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
  return data.data;
};

export const onboardOrganization = async (payload) => {
  const data = await authRequest({
    url: '/organizations/onboard',
    method: 'POST',
    data: payload,
  });
  return data.data;
};
export const fetchPlatformOrganizations=async(params={})=>{const q=new URLSearchParams(Object.entries(params).filter(([,v])=>v!==''&&v!=null));const d=await fetchWithAuth(`${BASE_API_URL}/organizations/platform?${q}`);return d.data;};
export const fetchPlatformDashboard=async()=>{const d=await fetchWithAuth(`${BASE_API_URL}/organizations/platform/dashboard`);return d.data;};
export const updateOrganizationLifecycle=(id,status)=>fetchWithAuth(`${BASE_API_URL}/organizations/platform/${id}/status`,{method:'PATCH',body:JSON.stringify({status})});
export const requestDomainVerification=domain=>fetchWithAuth(`${BASE_API_URL}/organizations/current/domain-verification`,{method:'POST',body:JSON.stringify({domain})});
export const verifyOrganizationDomain=()=>fetchWithAuth(`${BASE_API_URL}/organizations/current/domain-verification/verify`,{method:'POST',body:'{}'});

export const fetchAuditLogs = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/audit-logs`);
  return data.success ? data.data : [];
};

export const fetchSystemHealth = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/system-health`);
  return data.data;
};

export const fetchDocumentRequests = async (params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
  const data = await fetchWithAuth(`${BASE_API_URL}/document-requests?${query}`);
  return data.success ? data.data : [];
};

export const createDocumentRequest = (payload) =>
  fetchWithAuth(`${BASE_API_URL}/document-requests`, { method: 'POST', body: JSON.stringify(payload) });

export const updateDocumentRequestStatus = (id, status, rejectionReason) =>
  fetchWithAuth(`${BASE_API_URL}/document-requests/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, rejectionReason }) });

export const cancelDocumentRequest = (id) =>
  fetchWithAuth(`${BASE_API_URL}/document-requests/${id}/cancel`, { method: 'POST' });

export const fetchScholarshipRequests = async (params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
  const data = await fetchWithAuth(`${BASE_API_URL}/scholarship-requests?${query}`);
  return data.success ? data.data : [];
};

export const createScholarshipRequest = (payload) =>
  fetchWithAuth(`${BASE_API_URL}/scholarship-requests`, { method: 'POST', body: JSON.stringify(payload) });

export const updateScholarshipRequestStatus = (id, status, rejectionReason) =>
  fetchWithAuth(`${BASE_API_URL}/scholarship-requests/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, rejectionReason }) });

export const cancelScholarshipRequest = (id) =>
  fetchWithAuth(`${BASE_API_URL}/scholarship-requests/${id}/cancel`, { method: 'POST' });

export const fetchReportCatalog = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/reports/catalog`);
  return data.success ? data.data : [];
};

// Report filter fields (courseId/cohortId/from/to) are all optional() server-side,
// but only when the key is fully absent — an empty string sent as e.g. "courseId="
// still fails the backend's .min(1) check. Every filter object must be stripped
// of empty/null/undefined values before it's sent, not just for the read path.
const compactFilters = (filters = {}) =>
  Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value != null));

export const fetchReportData = async (type, filters = {}) => {
  const query = new URLSearchParams(compactFilters(filters));
  const data = await fetchWithAuth(`${BASE_API_URL}/reports/${type}?${query}`);
  return data.success ? data.data : { columns: [], rows: [] };
};

export const exportReportFile = async (type, filters = {}, format = 'csv') => {
  const query = new URLSearchParams({ ...compactFilters(filters), format });
  const response = await apiClient.request({ url: `/reports/${type}/export?${query}`, method: 'GET', responseType: 'blob' });
  return response.data;
};

export const createReportJob = (type, payload) =>
  fetchWithAuth(`${BASE_API_URL}/reports/${type}/jobs`, {
    method: 'POST',
    body: JSON.stringify({ ...payload, filters: compactFilters(payload.filters) }),
  });

export const fetchReportJobs = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/reports/jobs`);
  return data.success ? data.data : [];
};

export const fetchReportJobDownload = async (id) => {
  const data = await fetchWithAuth(`${BASE_API_URL}/reports/jobs/${id}/download`);
  return data.success ? data.data : null;
};

export const createReportSchedule = (payload) =>
  fetchWithAuth(`${BASE_API_URL}/reports/schedules`, { method: 'POST', body: JSON.stringify(payload) });

export const fetchReportSchedules = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/reports/schedules`);
  return data.success ? data.data : [];
};

export const updateReportSchedule = (id, payload) =>
  fetchWithAuth(`${BASE_API_URL}/reports/schedules/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const deleteReportSchedule = (id) =>
  fetchWithAuth(`${BASE_API_URL}/reports/schedules/${id}`, { method: 'DELETE' });

export const fetchBillingOverview = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/payments`);
  return data.data;
};

export const fetchInvoices = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/payments/invoices`);
  return data.success ? data.data : [];
};

export const fetchPaymentHistory = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/payments/history`);
  return data.success ? data.data : [];
};

export const updateSubscription = (payload) =>
  fetchWithAuth(`${BASE_API_URL}/payments/subscription`, { method: 'PUT', body: JSON.stringify(payload) });

export const issueInvoice = (payload) =>
  fetchWithAuth(`${BASE_API_URL}/payments/invoices`, { method: 'POST', body: JSON.stringify(payload) });

export const payInvoice = (id, payload = {}) =>
  fetchWithAuth(`${BASE_API_URL}/payments/invoices/${id}/pay`, { method: 'POST', body: JSON.stringify(payload) });

export const createQPayInvoice = (id) =>
  fetchWithAuth(`${BASE_API_URL}/payments/invoices/${id}/qpay`, { method: 'POST', body: '{}' });

export const createStripeCheckout = async (payload = {}) => {
  const data = await fetchWithAuth(`${BASE_API_URL}/payments/checkout`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.data;
};

export const fetchOutstandingInvoices = async () => {
  const data = await fetchWithAuth(`${BASE_API_URL}/payments/outstanding`);
  return data.data;
};

export const sendOutstandingReminders = () =>
  fetchWithAuth(`${BASE_API_URL}/payments/reminders/outstanding`, { method: 'POST', body: '{}' });

export const failInvoice = (id) =>
  fetchWithAuth(`${BASE_API_URL}/payments/invoices/${id}/fail`, { method: 'POST', body: '{}' });

export const refundInvoice = (id) =>
  fetchWithAuth(`${BASE_API_URL}/payments/invoices/${id}/refund`, { method: 'POST', body: '{}' });
