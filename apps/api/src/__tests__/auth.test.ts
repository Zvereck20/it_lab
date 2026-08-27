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
        name: 'Администратор',
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

describe('inventory', () => {
  it('supports dependent categories, server filters and protected deletion', async () => {
    const agent = request.agent(app);
    const suffix = Date.now().toString();

    await agent
      .post('/api/auth/login')
      .send({ login: 'BOSS', password: process.env.ADMIN_PASSWORD })
      .expect(200);

    const printersResponse = await agent
      .post('/api/inventory/categories/main')
      .send({ name: `Принтеры ${suffix}` })
      .expect(201);

    const computersResponse = await agent
      .post('/api/inventory/categories/main')
      .send({ name: `Компьютеры ${suffix}` })
      .expect(201);

    const sparePartsResponse = await agent
      .post('/api/inventory/categories/additional')
      .send({
        name: `Запчасти ${suffix}`,
        mainCategoryIds: [printersResponse.body.id, computersResponse.body.id],
      })
      .expect(201);

    expect(sparePartsResponse.body.mainCategoryIds).toHaveLength(2);

    const itemResponse = await agent
      .post('/api/inventory/items')
      .send({
        name: 'Тестовый картридж',
        description: 'Для проверки поиска по описанию',
        count: 12,
        mainCategoryId: printersResponse.body.id,
        additionalCategoryId: sparePartsResponse.body.id,
      })
      .expect(201);

    const filteredResponse = await agent
      .get('/api/inventory/items')
      .query({
        page: 1,
        search: 'проверки',
        mainCategoryId: printersResponse.body.id,
        additionalCategoryId: sparePartsResponse.body.id,
      })
      .expect(200);

    expect(filteredResponse.body.pagination).toMatchObject({
      page: 1,
      limit: 50,
      total: 1,
      totalPages: 1,
    });
    expect(filteredResponse.body.items[0].name).toBe('Тестовый картридж');

    const blockedDeleteResponse = await agent
      .delete(`/api/inventory/categories/additional/${sparePartsResponse.body.id}`);

    expect(blockedDeleteResponse.status).toBe(409);
    expect(blockedDeleteResponse.body.code).toBe('CATEGORY_IN_USE');

    await agent.delete(`/api/inventory/items/${itemResponse.body.id}`).expect(204);
    await agent
      .delete(`/api/inventory/categories/additional/${sparePartsResponse.body.id}`)
      .expect(204);
    await agent
      .delete(`/api/inventory/categories/main/${printersResponse.body.id}`)
      .expect(204);
    await agent
      .delete(`/api/inventory/categories/main/${computersResponse.body.id}`)
      .expect(204);
  });
});

afterAll(async () => {
  await Promise.all([
    prisma.$disconnect(),
    sessionPool.end(),
  ]);
});
