import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { prisma } from '../db/prisma.js';
import { sessionPool } from '../db/sessionPool.js';

const app = createApp();

describe('authentication', () => {
  it('rejects invalid ADMIN credentials without revealing which field is wrong', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ login: 'BOSS', password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Неверный логин или пароль',
    });
  });

  it('does not expose a session before login', async () => {
    const response = await request(app).get('/api/auth/session');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('creates, reads and destroys an ADMIN session', async () => {
    const agent = request.agent(app);

    const loginResponse = await agent
      .post('/api/auth/login')
      .send({ login: 'BOSS', password: process.env.ADMIN_PASSWORD });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.headers['set-cookie']).toBeDefined();
    expect(loginResponse.body).toEqual({
      user: {
        id: null,
        login: 'BOSS',
        role: 'ADMIN',
      },
    });

    const sessionResponse = await agent.get('/api/auth/session');

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.user.role).toBe('ADMIN');

    const logoutResponse = await agent.post('/api/auth/logout');
    expect(logoutResponse.status).toBe(204);

    const expiredSessionResponse = await agent.get('/api/auth/session');
    expect(expiredSessionResponse.status).toBe(401);
  });
});

afterAll(async () => {
  await Promise.all([
    prisma.$disconnect(),
    sessionPool.end(),
  ]);
});
