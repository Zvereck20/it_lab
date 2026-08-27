import { timingSafeEqual } from 'node:crypto';

import type { AuthUser } from '@itlab/contracts';
import { loginRequestSchema } from '@itlab/contracts';
import argon2 from 'argon2';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

import { ADMIN_LOGIN, SESSION_COOKIE_NAME } from '../config/auth.js';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { destroySession, regenerateSession, saveSession } from '../utils/session.js';

export const authRouter = Router();

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    code: 'TOO_MANY_ATTEMPTS',
    message: 'Слишком много попыток входа. Попробуйте позже',
  },
});

const safePasswordCompare = (password: string, expectedPassword: string) => {
  const passwordBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(expectedPassword);

  return passwordBuffer.length === expectedBuffer.length
    && timingSafeEqual(passwordBuffer, expectedBuffer);
};

const authenticate = async (login: string, password: string): Promise<AuthUser | null> => {
  if (login === ADMIN_LOGIN) {
    return safePasswordCompare(password, env.ADMIN_PASSWORD)
      ? { id: null, login: ADMIN_LOGIN, name: 'Администратор', role: 'ADMIN' }
      : null;
  }

  const user = await prisma.user.findUnique({ where: { login } });

  if (!user?.isActive || !(await argon2.verify(user.passwordHash, password))) {
    return null;
  }

  return {
    id: user.id,
    login: user.login,
    name: user.name,
    role: user.role,
  };
};

authRouter.post('/login', loginRateLimiter, async (request, response) => {
  const parsedBody = loginRequestSchema.safeParse(request.body);

  if (!parsedBody.success) {
    response.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Проверьте введённые данные',
      fieldErrors: parsedBody.error.flatten().fieldErrors,
    });
    return;
  }

  const user = await authenticate(parsedBody.data.login, parsedBody.data.password);

  if (!user) {
    response.status(401).json({
      code: 'INVALID_CREDENTIALS',
      message: 'Неверный логин или пароль',
    });
    return;
  }

  await regenerateSession(request);
  request.session.user = user;
  await saveSession(request);

  response.json({ user });
});

authRouter.get('/session', requireAuth, (request, response) => {
  response.json({ user: request.session.user });
});

authRouter.post('/logout', async (request, response) => {
  await destroySession(request);
  response.clearCookie(SESSION_COOKIE_NAME);
  response.status(204).end();
});
