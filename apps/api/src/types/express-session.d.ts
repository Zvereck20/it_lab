import type { AuthUser } from '@itlab/contracts';

declare module 'express-session' {
  interface SessionData {
    user?: AuthUser;
  }
}

export {};
