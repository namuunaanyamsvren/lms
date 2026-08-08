import { Role } from '../constants/roles';

declare global {
  // Express request augmentation requires declaration merging.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        organizationId: string;
        role: Role | string;
        sessionId: string;
        emailVerified: boolean;
        emailVerificationRequired: boolean;
        phoneVerified: boolean;
        phoneVerificationRequired: boolean;
      };
      organizationId?: string;
      internalService?: string;
      requestId?: string;
    }
  }
}

export {};
