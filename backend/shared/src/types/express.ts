import { Role } from '../constants/roles';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        organizationId: string;
        role: Role | string;
        email?: string;
      };
      organizationId?: string;
    }
  }
}

export {};
