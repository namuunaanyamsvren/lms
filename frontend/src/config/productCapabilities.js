export const productCapabilities = [
  { key: 'messaging', label: 'In-app messaging', enabled: false, audience: ['INSTRUCTOR', 'STUDENT', 'PARENT'] },
  { key: 'discussionForum', label: 'Discussion forum', enabled: false, audience: ['INSTRUCTOR', 'STUDENT', 'PARENT'] },
  { key: 'liveClass', label: 'Live class', enabled: false, audience: ['INSTRUCTOR', 'STUDENT'] },
  { key: 'calendarExport', label: 'Calendar export', enabled: false, audience: ['INSTRUCTOR', 'STUDENT', 'PARENT'] },
  { key: 'globalSearch', label: 'Global search', enabled: false, audience: ['INSTRUCTOR', 'STUDENT', 'PARENT', 'STAFF'] },
  { key: 'learningAnalytics', label: 'Learning analytics', enabled: false, audience: ['INSTRUCTOR', 'PARENT', 'PRINCIPAL'] },
  { key: 'recommendations', label: 'Recommendations', enabled: false, audience: ['STUDENT', 'INSTRUCTOR'] },
  { key: 'gamification', label: 'Badges and leaderboard', enabled: false, audience: ['STUDENT', 'INSTRUCTOR'] },
  { key: 'surveyFeedback', label: 'Survey and feedback', enabled: false, audience: ['STUDENT', 'PARENT', 'INSTRUCTOR', 'STAFF'] },
  { key: 'mobilePwa', label: 'Mobile PWA', enabled: true, audience: ['STUDENT', 'INSTRUCTOR', 'PARENT'] },
  { key: 'nativeMobileApi', label: 'Native mobile API', enabled: false, audience: ['PUBLIC'] },
  { key: 'interoperability', label: 'SCORM/xAPI/LTI', enabled: false, audience: ['INSTRUCTOR', 'ORG_ADMIN'] },
  { key: 'sisIntegration', label: 'SIS integration', enabled: false, audience: ['ORG_ADMIN', 'STAFF'] },
  { key: 'sso', label: 'SSO', enabled: false, audience: ['ORG_ADMIN', 'SUPER_ADMIN'] },
  { key: 'publicWebhooks', label: 'Public webhooks', enabled: false, audience: ['ORG_ADMIN', 'SUPER_ADMIN'] },
  { key: 'multiLanguageContent', label: 'Multi-language content', enabled: false, audience: ['INSTRUCTOR', 'STUDENT'] },
  { key: 'aiQuizAssistant', label: 'AI quiz assistant', enabled: false, audience: ['INSTRUCTOR'] },
];

export const isCapabilityEnabled = (key) =>
  Boolean(productCapabilities.find((capability) => capability.key === key)?.enabled);
