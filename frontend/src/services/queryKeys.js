// Central query-key factory for TanStack Query. Keep keys hierarchical so a
// broad invalidation (e.g. queryKeys.users.all) also invalidates narrower ones
// (e.g. queryKeys.users.list({ role: 'STUDENT' })).
export const queryKeys = {
  users: {
    all: ['users'],
    list: (params = {}) => ['users', 'list', params],
  },
  guardians: {
    all: ['guardians'],
    list: (params = {}) => ['guardians', 'list', params],
  },
  consentForms: {
    all: ['consentForms'],
    list: (params = {}) => ['consentForms', 'list', params],
    acknowledgements: (id) => ['consentForms', id, 'acknowledgements'],
  },
  reports: {
    catalog: ['reports', 'catalog'],
    data: (type, filters = {}) => ['reports', 'data', type, filters],
    jobs: ['reports', 'jobs'],
    schedules: ['reports', 'schedules'],
  },
  assignments: {
    all: ['assignments'],
    list: ['assignments', 'list'],
  },
  submissions: {
    all: ['submissions'],
    list: ['submissions', 'list'],
  },
  gradeCategories: {
    all: ['gradeCategories'],
    list: (courseId) => ['gradeCategories', 'list', courseId],
  },
  gradeAppeals: {
    all: ['gradeAppeals'],
    list: ['gradeAppeals', 'list'],
  },
  courseGradebook: {
    all: ['courseGradebook'],
    detail: (courseId) => ['courseGradebook', 'detail', courseId],
  },
  atRiskStudents: {
    all: ['atRiskStudents'],
    detail: (courseId) => ['atRiskStudents', 'detail', courseId],
  },
  transcript: {
    all: ['transcript'],
    detail: (studentId = 'me') => ['transcript', 'detail', studentId],
  },
  attendance: {
    all: ['attendance'],
    list: (params = {}) => ['attendance', 'list', params],
  },
  certificates: {
    all: ['certificates'],
    list: ['certificates', 'list'],
  },
  cohorts: {
    all: ['cohorts'],
    list: ['cohorts', 'list'],
  },
  teacherStudents: {
    all: ['teacherStudents'],
    list: ['teacherStudents', 'list'],
  },
  auditLogs: {
    all: ['auditLogs'],
    list: ['auditLogs', 'list'],
  },
  systemHealth: {
    all: ['systemHealth'],
  },
  documentRequests: {
    all: ['documentRequests'],
    list: (params = {}) => ['documentRequests', 'list', params],
  },
  scholarshipRequests: {
    all: ['scholarshipRequests'],
    list: (params = {}) => ['scholarshipRequests', 'list', params],
  },
  billing: {
    overview: ['billing', 'overview'],
    invoices: ['billing', 'invoices'],
    payments: ['billing', 'payments'],
  },
};
