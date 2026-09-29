import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { prisma } from '../db/prisma.js';
import { seedInventory } from '../db/seedInventory.js';
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

    await agent
      .post('/api/inventory/items')
      .send({
        name: 'Позиция без дополнительной категории',
        description: '',
        count: 1,
        mainCategoryId: printersResponse.body.id,
        additionalCategoryIds: [],
      })
      .expect(400);

    const itemResponse = await agent
      .post('/api/inventory/items')
      .send({
        name: 'Тестовый картридж',
        description: 'Для проверки поиска по описанию',
        count: 12,
        mainCategoryId: printersResponse.body.id,
        additionalCategoryIds: [sparePartsResponse.body.id],
      })
      .expect(201);
    expect(itemResponse.body.additionalCategoryIds).toEqual([sparePartsResponse.body.id]);

    const receiptMovement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { inventoryItemId: itemResponse.body.id },
    });
    expect(receiptMovement).toMatchObject({
      operationType: 'STOCK_RECEIPT',
      quantityDelta: 12,
      performedById: 'ADMIN',
      performedByName: 'Администратор',
    });

    await agent
      .patch(`/api/inventory/items/${itemResponse.body.id}`)
      .send({
        name: 'Тестовый картридж',
        description: 'Для проверки поиска по описанию',
        count: 9,
        mainCategoryId: printersResponse.body.id,
        additionalCategoryIds: [sparePartsResponse.body.id],
      })
      .expect(200);

    const decreaseMovement = await prisma.inventoryMovement.findFirstOrThrow({
      where: {
        inventoryItemId: itemResponse.body.id,
        operationType: 'MANUAL_DECREASE',
      },
    });
    expect(decreaseMovement.quantityDelta).toBe(-3);

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

describe('employees and repairs', () => {
  it('supports employee CRUD and server-side repair filters', async () => {
    const agent = request.agent(app);
    const suffix = Date.now().toString();
    const individualCustomer = {
      customerType: 'INDIVIDUAL',
      customerPhone: '+79000000000',
      customerFirstName: 'Иван',
      customerLastName: 'Иванов',
      customerMiddleName: '',
      companyName: '',
      inn: '',
    };

    await agent
      .post('/api/auth/login')
      .send({ login: 'BOSS', password: process.env.ADMIN_PASSWORD })
      .expect(200);

    await agent
      .post('/api/employees')
      .send({
        name: 'Техник 123',
        login: `invalid-tech-${suffix}`,
        password: 'test-password-123',
        role: 'TECHNICIAN',
      })
      .expect(400);

    const technicianResponse = await agent
      .post('/api/employees')
      .send({
        name: 'Техник Тестовый',
        login: `tech-${suffix}`,
        password: 'test-password-123',
        role: 'TECHNICIAN',
      })
      .expect(201);

    expect(technicianResponse.body.passwordHash).toBeUndefined();

    const managerResponse = await agent
      .post('/api/employees')
      .send({
        name: 'Менеджер Тестовый',
        login: `manager-${suffix}`,
        password: 'test-password-123',
        role: 'MANAGER',
      })
      .expect(201);

    const unassignedRepairResponse = await agent
      .post('/api/repairs')
      .send({
        name: `Ремонт без сотрудника ${suffix}`,
        description: 'Проверка необязательного ответственного',
        ...individualCustomer,
        technicianId: null,
      })
      .expect(201);

    expect(unassignedRepairResponse.body.status).toBe('CREATED');
    expect(unassignedRepairResponse.body.assignmentMode).toBe('FREE_QUEUE');
    expect(unassignedRepairResponse.body.technician).toBeNull();

    await agent
      .post('/api/repairs')
      .send({
        name: `Ремонт с неверным телефоном ${suffix}`,
        description: '',
        ...individualCustomer,
        customerPhone: '+7 (900) ABC-00-00',
        technicianId: null,
      })
      .expect(400);

    await agent
      .post('/api/repairs')
      .send({
        name: `Ремонт с неверным ФИО ${suffix}`,
        description: '',
        ...individualCustomer,
        customerFirstName: 'Иван123',
        technicianId: null,
      })
      .expect(400);

    await agent
      .post('/api/repairs')
      .send({
        name: `Некорректное назначение ${suffix}`,
        description: '',
        ...individualCustomer,
        technicianId: managerResponse.body.id,
      })
      .expect(400);

    const assignedRepairResponse = await agent
      .post('/api/repairs')
      .send({
        name: `Ремонт принтера ${suffix}`,
        description: 'Поиск ремонта по описанию устройства',
        ...individualCustomer,
        technicianId: technicianResponse.body.id,
      })
      .expect(201);

    const technicianAgent = request.agent(app);
    await technicianAgent
      .post('/api/auth/login')
      .send({ login: `tech-${suffix}`, password: 'test-password-123' })
      .expect(200);

    const takenRepairResponse = await technicianAgent
      .post(`/api/repairs/${unassignedRepairResponse.body.id}/take`)
      .expect(200);
    expect(takenRepairResponse.body.assignmentMode).toBe('ASSIGNED');
    expect(takenRepairResponse.body.technician.id).toBe(technicianResponse.body.id);

    const statusResponse = await technicianAgent
      .patch(`/api/repairs/${unassignedRepairResponse.body.id}/status`)
      .send({ status: 'DIAGNOSTICS', comment: 'Устройство передано на диагностику' })
      .expect(200);
    expect(statusResponse.body.status).toBe('DIAGNOSTICS');

    const repairDetailsResponse = await technicianAgent
      .get(`/api/repairs/${unassignedRepairResponse.body.id}`)
      .expect(200);
    expect(repairDetailsResponse.body.statusHistory).toHaveLength(2);
    expect(repairDetailsResponse.body.statusHistory[0].comment)
      .toBe('Устройство передано на диагностику');
    expect(repairDetailsResponse.body.statusHistory[0]).toMatchObject({
      changedByName: 'Техник Тестовый',
      changedByRole: 'TECHNICIAN',
    });
    expect(repairDetailsResponse.body.statusHistory[1]).toMatchObject({
      status: 'CREATED',
      changedByName: 'Администратор',
      changedByRole: 'ADMIN',
      comment: '',
    });

    const filteredResponse = await agent
      .get('/api/repairs')
      .query({
        page: 1,
        search: 'устройства',
        technicianId: technicianResponse.body.id,
        status: 'CREATED',
      })
      .expect(200);

    expect(filteredResponse.body.pagination).toMatchObject({
      page: 1,
      limit: 50,
      total: 1,
      totalPages: 1,
    });

    const blockedRoleResponse = await agent
      .patch(`/api/employees/${technicianResponse.body.id}`)
      .send({
        name: 'Техник Тестовый',
        login: `tech-${suffix}`,
        role: 'MANAGER',
      });
    expect(blockedRoleResponse.status).toBe(409);
    expect(blockedRoleResponse.body.code).toBe('EMPLOYEE_IN_USE');

    await agent
      .delete(`/api/employees/${technicianResponse.body.id}`)
      .expect(409);

    await agent
      .patch(`/api/repairs/${assignedRepairResponse.body.id}`)
      .send({
        name: `Ремонт принтера ${suffix}`,
        description: 'Ответственный снят',
        ...individualCustomer,
        technicianId: null,
      })
      .expect(200);

    await agent
      .patch(`/api/repairs/${unassignedRepairResponse.body.id}`)
      .send({
        name: `Ремонт без сотрудника ${suffix}`,
        description: 'Возвращён в свободную кассу',
        ...individualCustomer,
        technicianId: null,
      })
      .expect(200);

    await agent.delete(`/api/employees/${technicianResponse.body.id}`).expect(204);
    await agent.delete(`/api/repairs/${assignedRepairResponse.body.id}`).expect(204);
    await agent.delete(`/api/repairs/${unassignedRepairResponse.body.id}`).expect(204);
    await agent.delete(`/api/employees/${managerResponse.body.id}`).expect(204);
  });
});

describe('orders', () => {
  it('supports order categories, filters, free queue and status history', async () => {
    const agent = request.agent(app);
    const suffix = Date.now().toString();
    await agent
      .post('/api/auth/login')
      .send({ login: 'BOSS', password: process.env.ADMIN_PASSWORD })
      .expect(200);

    const mainCategoryResponse = await agent
      .post('/api/orders/categories/main')
      .send({ name: `Оргтехника ${suffix}` })
      .expect(201);
    const otherMainCategoryResponse = await agent
      .post('/api/orders/categories/main')
      .send({ name: `Прочее ${suffix}` })
      .expect(201);
    const additionalCategoryResponse = await agent
      .post('/api/orders/categories/additional')
      .send({
        name: `Поставка ${suffix}`,
        mainCategoryIds: [mainCategoryResponse.body.id],
      })
      .expect(201);
    const technicianResponse = await agent
      .post('/api/employees')
      .send({
        name: 'Техник Заказов',
        login: `order-tech-${suffix}`,
        password: 'test-password-123',
        role: 'TECHNICIAN',
      })
      .expect(201);

    const orderBody = {
      name: `Заказ принтера ${suffix}`,
      description: 'Поставка нового офисного принтера',
      companyName: `ООО Ромашка ${suffix}`,
      inn: '1234567890',
      customerPhone: '+79001234567',
      contactFirstName: 'Иван',
      contactLastName: 'Иванов',
      contactMiddleName: '',
      mainCategoryId: mainCategoryResponse.body.id,
      additionalCategoryIds: [additionalCategoryResponse.body.id],
      technicianId: null,
    };

    await agent
      .post('/api/orders')
      .send({ ...orderBody, mainCategoryId: otherMainCategoryResponse.body.id })
      .expect(400);

    const orderResponse = await agent
      .post('/api/orders')
      .send(orderBody)
      .expect(201);
    expect(orderResponse.body).toMatchObject({
      status: 'CREATED',
      assignmentMode: 'FREE_QUEUE',
      additionalCategoryIds: [additionalCategoryResponse.body.id],
    });

    const filteredResponse = await agent
      .get('/api/orders')
      .query({
        page: 1,
        search: 'Ромашка',
        mainCategoryId: mainCategoryResponse.body.id,
        additionalCategoryId: additionalCategoryResponse.body.id,
        technicianId: 'free_queue',
        status: 'CREATED',
      })
      .expect(200);
    expect(filteredResponse.body.pagination).toMatchObject({
      page: 1,
      limit: 50,
      total: 1,
      totalPages: 1,
    });

    await agent
      .delete(`/api/orders/categories/additional/${additionalCategoryResponse.body.id}`)
      .expect(409);

    const technicianAgent = request.agent(app);
    await technicianAgent
      .post('/api/auth/login')
      .send({ login: `order-tech-${suffix}`, password: 'test-password-123' })
      .expect(200);

    const unassignedStatusResponse = await technicianAgent
      .patch(`/api/orders/${orderResponse.body.id}/status`)
      .send({ status: 'DIAGNOSTICS', comment: 'Попытка изменить свободный заказ' })
      .expect(403);
    expect(unassignedStatusResponse.body).toMatchObject({
      code: 'FORBIDDEN',
      message: 'Можно менять статус только назначенного вам заказа',
    });

    await technicianAgent
      .post(`/api/orders/${orderResponse.body.id}/take`)
      .expect(200);

    const technicianStatusResponse = await technicianAgent
      .patch(`/api/orders/${orderResponse.body.id}/status`)
      .send({ status: 'DIAGNOSTICS', comment: 'Заказ принят на проверку' })
      .expect(200);
    expect(technicianStatusResponse.body.status).toBe('DIAGNOSTICS');

    const detailsResponse = await agent
      .get(`/api/orders/${orderResponse.body.id}`)
      .expect(200);
    expect(detailsResponse.body.statusHistory).toHaveLength(2);
    expect(detailsResponse.body.statusHistory[0]).toMatchObject({
      status: 'DIAGNOSTICS',
      changedByName: 'Техник Заказов',
      changedByRole: 'TECHNICIAN',
      comment: 'Заказ принят на проверку',
    });

    await agent.delete(`/api/employees/${technicianResponse.body.id}`).expect(409);
    await agent.delete(`/api/orders/${orderResponse.body.id}`).expect(204);
    await agent.delete(`/api/employees/${technicianResponse.body.id}`).expect(204);
    await agent
      .delete(`/api/orders/categories/additional/${additionalCategoryResponse.body.id}`)
      .expect(204);
    await agent
      .delete(`/api/orders/categories/main/${mainCategoryResponse.body.id}`)
      .expect(204);
    await agent
      .delete(`/api/orders/categories/main/${otherMainCategoryResponse.body.id}`)
      .expect(204);
  });
});

describe('inventory allocations', () => {
  it('allocates stock to assigned orders and repairs with an audit trail', async () => {
    const agent = request.agent(app);
    const suffix = Date.now().toString();
    const individualCustomer = {
      customerType: 'INDIVIDUAL',
      customerPhone: '+79000000000',
      customerFirstName: 'Пётр',
      customerLastName: 'Петров',
      customerMiddleName: '',
      companyName: '',
      inn: '',
    };

    await agent
      .post('/api/auth/login')
      .send({ login: 'BOSS', password: process.env.ADMIN_PASSWORD })
      .expect(200);

    const inventoryMainCategory = await agent
      .post('/api/inventory/categories/main')
      .send({ name: `Компоненты распределения ${suffix}` })
      .expect(201);
    const inventoryAdditionalCategory = await agent
      .post('/api/inventory/categories/additional')
      .send({
        name: `Платы распределения ${suffix}`,
        mainCategoryIds: [inventoryMainCategory.body.id],
      })
      .expect(201);
    const inventoryItem = await agent
      .post('/api/inventory/items')
      .send({
        name: `Тестовая плата ${suffix}`,
        description: '',
        count: 20,
        mainCategoryId: inventoryMainCategory.body.id,
        additionalCategoryIds: [inventoryAdditionalCategory.body.id],
      })
      .expect(201);

    const technician = await agent
      .post('/api/employees')
      .send({
        name: 'Техник Распределения',
        login: `allocation-tech-${suffix}`,
        password: 'test-password-123',
        role: 'TECHNICIAN',
      })
      .expect(201);

    const orderMainCategory = await agent
      .post('/api/orders/categories/main')
      .send({ name: `Заказы распределения ${suffix}` })
      .expect(201);
    const orderAdditionalCategory = await agent
      .post('/api/orders/categories/additional')
      .send({
        name: `Монтаж распределения ${suffix}`,
        mainCategoryIds: [orderMainCategory.body.id],
      })
      .expect(201);
    const order = await agent
      .post('/api/orders')
      .send({
        name: `Заказ распределения ${suffix}`,
        description: '',
        companyName: `ООО Распределение ${suffix}`,
        inn: '1234567890',
        customerPhone: '+79001234567',
        contactFirstName: 'Иван',
        contactLastName: 'Иванов',
        contactMiddleName: '',
        mainCategoryId: orderMainCategory.body.id,
        additionalCategoryIds: [orderAdditionalCategory.body.id],
        technicianId: technician.body.id,
      })
      .expect(201);
    const repair = await agent
      .post('/api/repairs')
      .send({
        name: `Ремонт распределения ${suffix}`,
        description: '',
        ...individualCustomer,
        technicianId: technician.body.id,
      })
      .expect(201);

    expect(order.body.number).toMatch(/^З-\d{6}$/u);
    expect(repair.body.number).toMatch(/^Р-\d{6}$/u);

    const technicianAgent = request.agent(app);
    await technicianAgent
      .post('/api/auth/login')
      .send({ login: `allocation-tech-${suffix}`, password: 'test-password-123' })
      .expect(200);

    const orderSearch = await technicianAgent
      .get('/api/inventory/allocation-targets')
      .query({ search: order.body.number })
      .expect(200);
    expect(orderSearch.body.items).toEqual([
      {
        id: order.body.id,
        type: 'ORDER',
        number: order.body.number,
        disabled: false,
      },
    ]);

    const allocationResponse = await technicianAgent
      .post(`/api/inventory/items/${inventoryItem.body.id}/allocate`)
      .send({
        quantity: 3,
        targets: [
          { type: 'ORDER', id: order.body.id },
          { type: 'REPAIR', id: repair.body.id },
        ],
      })
      .expect(200);
    expect(allocationResponse.body).toEqual({
      inventoryItemId: inventoryItem.body.id,
      remainingCount: 14,
      allocatedTargets: 2,
    });

    const [orderComponent, repairComponent, allocationMovements] = await Promise.all([
      prisma.orderComponent.findUniqueOrThrow({
        where: {
          orderId_inventoryItemId: {
            orderId: order.body.id,
            inventoryItemId: inventoryItem.body.id,
          },
        },
      }),
      prisma.repairComponent.findUniqueOrThrow({
        where: {
          repairId_inventoryItemId: {
            repairId: repair.body.id,
            inventoryItemId: inventoryItem.body.id,
          },
        },
      }),
      prisma.inventoryMovement.findMany({
        where: {
          inventoryItemId: inventoryItem.body.id,
          operationType: { in: ['ORDER_ALLOCATION', 'REPAIR_ALLOCATION'] },
        },
      }),
    ]);
    expect(orderComponent).toMatchObject({ quantity: 3, nameSnapshot: inventoryItem.body.name });
    expect(repairComponent).toMatchObject({ quantity: 3, nameSnapshot: inventoryItem.body.name });
    expect(allocationMovements).toHaveLength(2);
    expect(allocationMovements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        operationType: 'ORDER_ALLOCATION',
        quantityDelta: -3,
        performedById: technician.body.id,
        performedByName: 'Техник Распределения',
      }),
      expect.objectContaining({
        operationType: 'REPAIR_ALLOCATION',
        quantityDelta: -3,
        performedById: technician.body.id,
        performedByName: 'Техник Распределения',
      }),
    ]));

    const insufficientResponse = await technicianAgent
      .post(`/api/inventory/items/${inventoryItem.body.id}/allocate`)
      .send({
        quantity: 8,
        targets: [
          { type: 'ORDER', id: order.body.id },
          { type: 'REPAIR', id: repair.body.id },
        ],
      })
      .expect(409);
    expect(insufficientResponse.body.code).toBe('INSUFFICIENT_STOCK');

    await agent
      .patch(`/api/orders/${order.body.id}/status`)
      .send({ status: 'COMPLETED', comment: '' })
      .expect(200);

    const completedOrderSearch = await technicianAgent
      .get('/api/inventory/allocation-targets')
      .query({ search: order.body.number })
      .expect(200);
    expect(completedOrderSearch.body.items[0].disabled).toBe(true);

    const completedAllocation = await technicianAgent
      .post(`/api/inventory/items/${inventoryItem.body.id}/allocate`)
      .send({ quantity: 1, targets: [{ type: 'ORDER', id: order.body.id }] })
      .expect(409);
    expect(completedAllocation.body.code).toBe('TARGET_COMPLETED');

    await prisma.orderComponent.deleteMany({ where: { orderId: order.body.id } });
    await prisma.repairComponent.deleteMany({ where: { repairId: repair.body.id } });
    await agent.delete(`/api/orders/${order.body.id}`).expect(204);
    await agent.delete(`/api/repairs/${repair.body.id}`).expect(204);
    await agent.delete(`/api/inventory/items/${inventoryItem.body.id}`).expect(204);
    await agent.delete(`/api/employees/${technician.body.id}`).expect(204);
    await agent
      .delete(`/api/orders/categories/additional/${orderAdditionalCategory.body.id}`)
      .expect(204);
    await agent
      .delete(`/api/orders/categories/main/${orderMainCategory.body.id}`)
      .expect(204);
    await agent
      .delete(`/api/inventory/categories/additional/${inventoryAdditionalCategory.body.id}`)
      .expect(204);
    await agent
      .delete(`/api/inventory/categories/main/${inventoryMainCategory.body.id}`)
      .expect(204);
  });
});

describe('inventory development seed', () => {
  it('creates 100 database items from existing category links without duplicates', async () => {
    const suffix = Date.now().toString();
    const mainCategory = await prisma.mainCategory.create({
      data: { name: `Seed основная ${suffix}` },
    });
    const additionalCategory = await prisma.additionalCategory.create({
      data: {
        name: `Seed дополнительная ${suffix}`,
        mainCategories: {
          create: { mainCategoryId: mainCategory.id },
        },
      },
    });

    await seedInventory();
    await seedInventory();

    const mockItemsCount = await prisma.inventoryItem.count({
      where: { name: { startsWith: 'Тестовая складская позиция ' } },
    });
    expect(mockItemsCount).toBe(100);

    await prisma.inventoryItem.deleteMany({
      where: { name: { startsWith: 'Тестовая складская позиция ' } },
    });
    await prisma.additionalCategory.delete({ where: { id: additionalCategory.id } });
    await prisma.mainCategory.delete({ where: { id: mainCategory.id } });
  });
});

afterAll(async () => {
  await Promise.all([
    prisma.$disconnect(),
    sessionPool.end(),
  ]);
});
