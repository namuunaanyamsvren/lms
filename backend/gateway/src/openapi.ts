import { generatedRouteInventory } from './openapi-route-inventory.generated';

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'EduPulse LMS API',
    version: '1.0.0',
    description: 'Multi-tenant LMS API exposed through the API gateway.',
  },
  'x-routeInventory': generatedRouteInventory,
  servers: [{ url: 'http://localhost:8000', description: 'Local gateway' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
        },
      },
      Schedule: {
        type: 'object',
        required: ['id', 'courseId', 'teacherId', 'organizationId', 'title', 'dayOfWeek', 'startTime', 'endTime', 'semester'],
        properties: {
          id: { type: 'string' },
          courseId: { type: 'string' },
          teacherId: { type: 'string' },
          organizationId: { type: 'string' },
          termId: { type: 'string', nullable: true },
          roomId: { type: 'string', nullable: true },
          title: { type: 'string' },
          dayOfWeek: {
            type: 'string',
            enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
          },
          startTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
          endTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
          room: { type: 'string', nullable: true },
          semester: { type: 'string' },
          timezone: { type: 'string', enum: ['Asia/Ulaanbaatar'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  tags: [
    { name: 'Auth' }, { name: 'Organizations' }, { name: 'Academic' },
    { name: 'Notifications' },
    { name: 'Privacy' }, { name: 'Files' },
  ],
  paths: {
    '/api/v1/auth/login': {
      post: { tags: ['Auth'], summary: 'Sign in', responses: { '200': { description: 'Authenticated' }, '401': { description: 'Invalid credentials' } } },
    },
    '/api/v1/auth/register': {
      post: { tags: ['Auth'], summary: 'Self-register in an existing tenant', responses: { '201': { description: 'Registered' } } },
    },
    '/api/v1/auth/google': {
      get: {
        tags: ['Auth'],
        summary: 'Start tenant-scoped Google OAuth login',
        parameters: [{ name: 'organizationId', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { '302': { description: 'Redirected to Google' } },
      },
    },
    '/api/v1/auth/google/callback': {
      get: {
        tags: ['Auth'],
        summary: 'Google OAuth callback',
        responses: { '302': { description: 'Redirected to the frontend callback' } },
      },
    },
    '/api/v1/auth/google/exchange': {
      post: {
        tags: ['Auth'],
        summary: 'Exchange a one-time Google login code for an access token',
        responses: { '200': { description: 'Authenticated' }, '401': { description: 'Invalid or expired code' } },
      },
    },
    '/api/v1/auth/privacy/export': {
      get: {
        tags: ['Privacy'],
        security: [{ bearerAuth: [] }],
        summary: 'Download the current user identity, security and academic data',
        responses: {
          '200': { description: 'No-store JSON attachment' },
          '503': { description: 'A complete cross-service export is unavailable' },
        },
      },
    },
    '/api/v1/auth/privacy/account': {
      delete: {
        tags: ['Privacy'],
        security: [{ bearerAuth: [] }],
        summary: 'Anonymize the current account and revoke all access',
        responses: {
          '200': { description: 'Account anonymized' },
          '400': { description: 'Exact DELETE confirmation is required' },
        },
      },
    },
    '/api/v1/auth/audit-events': {
      get: {
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        summary: 'Export tenant auth audit events as JSON or CSV',
        parameters: [
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'csv'] } },
          { name: 'after', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'before', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 1000 } },
        ],
        responses: { '200': { description: 'Tenant-scoped audit events' } },
      },
    },
    '/api/v1/organizations/onboard': {
      post: { tags: ['Organizations'], summary: 'Provision a tenant and first administrator', responses: { '201': { description: 'Tenant provisioned' } } },
    },
    '/api/v1/organizations/current': {
      get: { tags: ['Organizations'], security: [{ bearerAuth: [] }], summary: 'Get current tenant', responses: { '200': { description: 'Tenant' } } },
      put: { tags: ['Organizations'], security: [{ bearerAuth: [] }], summary: 'Update current tenant', responses: { '200': { description: 'Updated' } } },
    },
    '/api/v1/courses': {
      get: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'List accessible courses', responses: { '200': { description: 'Courses' } } },
      post: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'Create course', responses: { '201': { description: 'Created' } } },
    },
    '/api/v1/schedules': {
      get: {
        tags: ['Academic'],
        security: [{ bearerAuth: [] }],
        summary: 'List schedules accessible to the current role',
        parameters: [
          { name: 'courseId', in: 'query', schema: { type: 'string' } },
          { name: 'semester', in: 'query', schema: { type: 'string' } },
          { name: 'termId', in: 'query', schema: { type: 'string' } },
          { name: 'teacherId', in: 'query', schema: { type: 'string' } },
          { name: 'studentId', in: 'query', schema: { type: 'string' }, description: 'Parent-only child filter; students are always self-scoped.' },
        ],
        responses: { '200': { description: 'Enrollment/guardian scoped schedules' } },
      },
      post: {
        tags: ['Academic'],
        security: [{ bearerAuth: [] }],
        summary: 'Create a course schedule',
        responses: {
          '201': { description: 'Created' },
          '403': { description: 'Insufficient role or course ownership' },
          '409': { description: 'Teacher or room time overlap' },
        },
      },
    },
    '/api/v1/schedules/options': {
      get: {
        tags: ['Academic'],
        security: [{ bearerAuth: [] }],
        summary: 'List role-scoped schedule form/filter options',
        responses: {
          '200': { description: 'Courses, terms, rooms, teachers, parent children, and timezone policy' },
        },
      },
    },
    '/api/v1/schedules/me': {
      get: {
        tags: ['Academic'],
        security: [{ bearerAuth: [] }],
        summary: 'List current user schedules through teaching, enrollment, or guardian links',
        parameters: [
          { name: 'courseId', in: 'query', schema: { type: 'string' } },
          { name: 'semester', in: 'query', schema: { type: 'string' } },
          { name: 'termId', in: 'query', schema: { type: 'string' } },
          { name: 'teacherId', in: 'query', schema: { type: 'string' } },
          { name: 'studentId', in: 'query', schema: { type: 'string' }, description: 'Parent-only child filter; students are always self-scoped.' },
        ],
        responses: { '200': { description: 'Current user schedules' } },
      },
    },
    '/api/v1/schedules/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Academic'],
        security: [{ bearerAuth: [] }],
        summary: 'Get an accessible schedule',
        responses: { '200': { description: 'Schedule' }, '404': { description: 'Not found or inaccessible' } },
      },
      put: {
        tags: ['Academic'],
        security: [{ bearerAuth: [] }],
        summary: 'Update a course schedule',
        responses: {
          '200': { description: 'Updated' },
          '403': { description: 'Insufficient role or course ownership' },
          '409': { description: 'Teacher or room time overlap' },
        },
      },
      delete: {
        tags: ['Academic'],
        security: [{ bearerAuth: [] }],
        summary: 'Delete a course schedule',
        responses: { '204': { description: 'Deleted' }, '403': { description: 'Insufficient role or course ownership' } },
      },
    },
    '/api/v1/assignments': {
      get: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'List assignments', responses: { '200': { description: 'Assignments' } } },
      post: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'Create assignment', responses: { '201': { description: 'Created' } } },
    },
    '/api/v1/attendance': {
      get: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'List attendance, optionally filtered by cohort/student/date range/status', responses: { '200': { description: 'Attendance' } } },
      post: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'Record a single attendance entry', responses: { '201': { description: 'Created' } } },
    },
    '/api/v1/attendance/batch': {
      post: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'Batch-record attendance for a cohort roster on a given date', responses: { '201': { description: 'Created/updated rows' } } },
    },
    '/api/v1/attendance/export': {
      get: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'Export attendance as CSV', responses: { '200': { description: 'CSV file' } } },
    },
    '/api/v1/attendance/{id}/history': {
      get: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'List an attendance record\'s edit history', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Attendance history' } } },
    },
    '/api/v1/uploads': {
      post: {
        tags: ['Files'],
        security: [{ bearerAuth: [] }],
        summary: 'Validate, malware-scan and persist an allowlisted binary file',
        parameters: [
          { name: 'x-file-name', in: 'header', required: true, schema: { type: 'string' } },
          { name: 'x-file-purpose', in: 'header', schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
        },
        responses: {
          '201': { description: 'File admitted and stored' },
          '400': { description: 'Extension, MIME or magic-byte mismatch' },
          '422': { description: 'Malware detected' },
          '503': { description: 'Required scanner or storage unavailable' },
        },
      },
    },
    '/api/v1/uploads/sign': {
      post: {
        tags: ['Files'],
        security: [{ bearerAuth: [] }],
        summary: 'Create a tenant/owner-authorized URL valid for at most 15 minutes',
        responses: { '200': { description: 'Signed URL and expiry' } },
      },
    },
    '/api/v1/uploads/download': {
      get: {
        tags: ['Files'],
        summary: 'Stream a private file after signature and expiry verification',
        responses: {
          '200': { description: 'Validated file stream' },
          '403': { description: 'Invalid or expired URL' },
        },
      },
    },
    '/api/v1/grades': {
      get: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'List grades', responses: { '200': { description: 'Grades' } } },
    },
    '/api/v1/grades/manual': {
      post: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'Create a manual (non-submission) grade', responses: { '201': { description: 'Grade created' } } },
    },
    '/api/v1/grades/{id}/publish': {
      post: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'Publish a draft grade', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Grade published' } } },
    },
    '/api/v1/grades/{id}/history': {
      get: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'List a grade\'s edit history', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Grade history' } } },
    },
    '/api/v1/grades/{id}/appeals': {
      post: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'File an appeal on a published grade', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Appeal created' } } },
    },
    '/api/v1/grades/appeals': {
      get: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'List grade appeals visible to the caller', responses: { '200': { description: 'Appeals' } } },
    },
    '/api/v1/grades/appeals/{id}': {
      put: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'Resolve a grade appeal', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Appeal resolved' } } },
    },
    '/api/v1/courses/{courseId}/grade-categories': {
      get: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'List a course\'s weighted grade categories', parameters: [{ name: 'courseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Grade categories' } } },
      post: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'Create a weighted grade category', parameters: [{ name: 'courseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Grade category created' } } },
    },
    '/api/v1/grade-categories/{id}': {
      put: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'Update a grade category', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Grade category updated' } } },
      delete: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'Delete a grade category', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '204': { description: 'Deleted' } } },
    },
    '/api/v1/assignments/{assignmentId}/grades/bulk-import': {
      post: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'Bulk-import grades for an assignment from CSV', parameters: [{ name: 'assignmentId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Import results, one row per CSV row' } } },
    },
    '/api/v1/assignments/{assignmentId}/grades/export': {
      get: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'Export an assignment\'s grades as CSV', parameters: [{ name: 'assignmentId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'CSV file' } } },
    },
    '/api/v1/courses/{courseId}/gradebook': {
      get: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'Course roster with aggregated grades', parameters: [{ name: 'courseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Gradebook' } } },
    },
    '/api/v1/students/{studentId}/transcript': {
      get: { tags: ['Academic'], security: [{ bearerAuth: [] }], summary: 'Student transcript with term and cumulative GPA', parameters: [{ name: 'studentId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Transcript' } } },
    },
    '/api/v1/notifications': {
      get: { tags: ['Notifications'], security: [{ bearerAuth: [] }], summary: 'List own notifications', responses: { '200': { description: 'Notifications' } } },
      post: { tags: ['Notifications'], security: [{ bearerAuth: [] }], summary: 'Queue notification', responses: { '202': { description: 'Queued' } } },
    },
  },
} as const;
