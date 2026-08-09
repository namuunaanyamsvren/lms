import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 8000,
  features: {
    billing: process.env.FEATURE_BILLING_ENABLED === 'true',
  },
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:8001',
    organization: process.env.ORGANIZATION_SERVICE_URL || 'http://localhost:8002',
    academic: process.env.ACADEMIC_SERVICE_URL || 'http://localhost:8003',
    billing: process.env.BILLING_SERVICE_URL || 'http://localhost:8004',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8005',
  },
};
