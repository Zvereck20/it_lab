import type { Prisma } from '../generated/prisma/client.js';
import type { AuthUser, OrderInput, OrderStatus } from '@itlab/contracts';
import {
  additionalCategoryInputSchema,
  mainCategoryInputSchema,
  orderInputSchema,
  orderListQuerySchema,
  orderStatusInputSchema,
} from '@itlab/contracts';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../db/prisma.js';
import { allowRoles } from '../middlewares/allowRoles.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const ORDER_PAGE_SIZE = 50;
const idSchema = z.string().uuid();

const orderSelect = {
  id: true,
  name: true,
  description: true,
  companyName: true,
  inn: true,
  customerPhone: true,
  contactFirstName: true,
  contactLastName: true,
  contactMiddleName: true,
  mainCategoryId: true,
  assignmentMode: true,
  technicianId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  mainCategory: {
    select: { id: true, name: true },
  },
  additionalCategories: {
    select: {
      additionalCategory: {
        select: { id: true, name: true },
      },
    },
  },
  technician: {
    select: { id: true, name: true, login: true },
  },
} satisfies Prisma.OrderSelect;

const orderDetailsSelect = {
  ...orderSelect,
  statusHistory: {
    orderBy: [{ changedAt: 'desc' as const }, { id: 'desc' as const }],
    select: {
      id: true,
      status: true,
      changedAt: true,
      changedByUserId: true,
      changedByName: true,
      changedByRole: true,
      comment: true,
    },
  },
} satisfies Prisma.OrderSelect;

type SelectedOrder = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;
type SelectedOrderDetails = Prisma.OrderGetPayload<{ select: typeof orderDetailsSelect }>;

const isPrismaError = (error: unknown, code: string) =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === code);

const validationError = (message = 'Проверьте введённые данные') => ({
  code: 'VALIDATION_ERROR',
  message,
});

const categoryConflict = {
  code: 'CATEGORY_IN_USE',
  message: 'Категория используется. Сначала удалите или перенесите связанные заказы',
};

const mapOrder = (order: SelectedOrder) => {
  const additionalCategories = order.additionalCategories
    .map((link) => link.additionalCategory)
    .sort((left, right) => left.name.localeCompare(right.name, 'ru-RU'));

  return {
    ...order,
    description: order.description ?? '',
    contactMiddleName: order.contactMiddleName ?? '',
    additionalCategoryIds: additionalCategories.map((category) => category.id),
    additionalCategories,
  };
};

const mapOrderDetails = (order: SelectedOrderDetails) => ({
  ...mapOrder(order),
  statusHistory: order.statusHistory.map((entry) => ({
    ...entry,
    comment: entry.comment ?? '',
  })),
});

const validateTechnician = async (technicianId: string | null) => {
  if (!technicianId) return null;

  const technician = await prisma.user.findFirst({
    where: { id: technicianId, role: 'TECHNICIAN', isActive: true },
    select: { id: true },
  });

  return technician
    ? null
    : 'Ответственный сотрудник не найден или не является техническим специалистом';
};

const validateCategoryLinks = async (
  mainCategoryId: string,
  additionalCategoryIds: string[],
) => {
  const mainCategory = await prisma.orderMainCategory.findUnique({
    where: { id: mainCategoryId },
    select: { id: true },
  });

  if (!mainCategory) return 'Основная категория не найдена';

  const linksCount = await prisma.orderMainAdditionalCategory.count({
    where: {
      mainCategoryId,
      additionalCategoryId: { in: additionalCategoryIds },
    },
  });

  return linksCount === additionalCategoryIds.length
    ? null
    : 'Одна из дополнительных категорий не связана с выбранной основной';
};

const buildOrderData = (input: OrderInput) => ({
  name: input.name,
  description: input.description || null,
  companyName: input.companyName,
  inn: input.inn,
  customerPhone: input.customerPhone,
  contactFirstName: input.contactFirstName,
  contactLastName: input.contactLastName,
  contactMiddleName: input.contactMiddleName || null,
  mainCategoryId: input.mainCategoryId,
  assignmentMode: input.technicianId ? 'ASSIGNED' as const : 'FREE_QUEUE' as const,
  technicianId: input.technicianId,
});

const buildStatusHistoryData = (
  user: AuthUser,
  status: OrderStatus,
  comment = '',
) => ({
  status,
  changedByUserId: user.id,
  changedByName: user.name,
  changedByRole: user.role,
  comment: comment || null,
});

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

ordersRouter.get('/categories', async (_request, response) => {
  const [mainCategories, additionalCategories] = await Promise.all([
    prisma.orderMainCategory.findMany({
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, name: true },
    }),
    prisma.orderAdditionalCategory.findMany({
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        mainCategories: { select: { mainCategoryId: true } },
      },
    }),
  ]);

  response.json({
    mainCategories,
    additionalCategories: additionalCategories.map((category) => ({
      id: category.id,
      name: category.name,
      mainCategoryIds: category.mainCategories.map((link) => link.mainCategoryId),
    })),
  });
});

ordersRouter.post('/categories/main', allowRoles('ADMIN'), async (request, response) => {
  const parsedBody = mainCategoryInputSchema.safeParse(request.body);
  if (!parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }

  try {
    const category = await prisma.orderMainCategory.create({
      data: parsedBody.data,
      select: { id: true, name: true },
    });
    response.status(201).json(category);
  } catch (error) {
    if (isPrismaError(error, 'P2002')) {
      response.status(409).json({
        code: 'CATEGORY_EXISTS',
        message: 'Категория с таким названием уже существует',
      });
      return;
    }
    throw error;
  }
});

ordersRouter.patch('/categories/main/:id', allowRoles('ADMIN'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  const parsedBody = mainCategoryInputSchema.safeParse(request.body);
  if (!parsedId.success || !parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }

  try {
    const category = await prisma.orderMainCategory.update({
      where: { id: parsedId.data },
      data: parsedBody.data,
      select: { id: true, name: true },
    });
    response.json(category);
  } catch (error) {
    if (isPrismaError(error, 'P2002')) {
      response.status(409).json({
        code: 'CATEGORY_EXISTS',
        message: 'Категория с таким названием уже существует',
      });
      return;
    }
    if (isPrismaError(error, 'P2025')) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Категория не найдена' });
      return;
    }
    throw error;
  }
});

ordersRouter.delete('/categories/main/:id', allowRoles('ADMIN'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  if (!parsedId.success) {
    response.status(400).json(validationError());
    return;
  }

  const usedOrders = await prisma.order.count({ where: { mainCategoryId: parsedId.data } });
  if (usedOrders > 0) {
    response.status(409).json(categoryConflict);
    return;
  }

  try {
    await prisma.orderMainCategory.delete({ where: { id: parsedId.data } });
    response.status(204).end();
  } catch (error) {
    if (isPrismaError(error, 'P2025')) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Категория не найдена' });
      return;
    }
    if (isPrismaError(error, 'P2003')) {
      response.status(409).json(categoryConflict);
      return;
    }
    throw error;
  }
});

ordersRouter.post('/categories/additional', allowRoles('ADMIN'), async (request, response) => {
  const parsedBody = additionalCategoryInputSchema.safeParse(request.body);
  if (!parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }

  try {
    const category = await prisma.orderAdditionalCategory.create({
      data: {
        name: parsedBody.data.name,
        mainCategories: {
          create: parsedBody.data.mainCategoryIds.map((mainCategoryId) => ({ mainCategoryId })),
        },
      },
      select: { id: true, name: true },
    });
    response.status(201).json({
      ...category,
      mainCategoryIds: parsedBody.data.mainCategoryIds,
    });
  } catch (error) {
    if (isPrismaError(error, 'P2002')) {
      response.status(409).json({
        code: 'CATEGORY_EXISTS',
        message: 'Категория с таким названием уже существует',
      });
      return;
    }
    if (isPrismaError(error, 'P2003')) {
      response.status(400).json(validationError('Одна из основных категорий не найдена'));
      return;
    }
    throw error;
  }
});

ordersRouter.patch('/categories/additional/:id', allowRoles('ADMIN'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  const parsedBody = additionalCategoryInputSchema.safeParse(request.body);
  if (!parsedId.success || !parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }

  const incompatibleOrder = await prisma.orderAdditionalCategoryLink.findFirst({
    where: {
      additionalCategoryId: parsedId.data,
      order: { mainCategoryId: { notIn: parsedBody.data.mainCategoryIds } },
    },
    select: { orderId: true },
  });

  if (incompatibleOrder) {
    response.status(409).json({
      code: 'CATEGORY_LINK_IN_USE',
      message: 'Нельзя убрать связь: она используется заказом',
    });
    return;
  }

  try {
    const category = await prisma.$transaction(async (transaction) => {
      await transaction.orderMainAdditionalCategory.deleteMany({
        where: { additionalCategoryId: parsedId.data },
      });
      return transaction.orderAdditionalCategory.update({
        where: { id: parsedId.data },
        data: {
          name: parsedBody.data.name,
          mainCategories: {
            create: parsedBody.data.mainCategoryIds.map((mainCategoryId) => ({ mainCategoryId })),
          },
        },
        select: { id: true, name: true },
      });
    });
    response.json({ ...category, mainCategoryIds: parsedBody.data.mainCategoryIds });
  } catch (error) {
    if (isPrismaError(error, 'P2002')) {
      response.status(409).json({
        code: 'CATEGORY_EXISTS',
        message: 'Категория с таким названием уже существует',
      });
      return;
    }
    if (isPrismaError(error, 'P2003')) {
      response.status(400).json(validationError('Одна из основных категорий не найдена'));
      return;
    }
    if (isPrismaError(error, 'P2025')) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Категория не найдена' });
      return;
    }
    throw error;
  }
});

ordersRouter.delete('/categories/additional/:id', allowRoles('ADMIN'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  if (!parsedId.success) {
    response.status(400).json(validationError());
    return;
  }

  const usedOrders = await prisma.orderAdditionalCategoryLink.count({
    where: { additionalCategoryId: parsedId.data },
  });
  if (usedOrders > 0) {
    response.status(409).json(categoryConflict);
    return;
  }

  try {
    await prisma.orderAdditionalCategory.delete({ where: { id: parsedId.data } });
    response.status(204).end();
  } catch (error) {
    if (isPrismaError(error, 'P2025')) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Категория не найдена' });
      return;
    }
    if (isPrismaError(error, 'P2003')) {
      response.status(409).json(categoryConflict);
      return;
    }
    throw error;
  }
});

ordersRouter.get('/', async (request, response) => {
  const parsedQuery = orderListQuerySchema.safeParse(request.query);
  if (!parsedQuery.success) {
    response.status(400).json(validationError('Некорректные параметры поиска или фильтра'));
    return;
  }

  const {
    page,
    search,
    mainCategoryId,
    additionalCategoryId,
    technicianId,
    status,
  } = parsedQuery.data;

  if (additionalCategoryId && !mainCategoryId) {
    response.status(400).json(validationError('Сначала выберите основную категорию'));
    return;
  }

  const where: Prisma.OrderWhereInput = {
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
            { companyName: { contains: search, mode: 'insensitive' as const } },
            { inn: { contains: search } },
          ],
        }
      : {}),
    ...(mainCategoryId ? { mainCategoryId } : {}),
    ...(additionalCategoryId
      ? { additionalCategories: { some: { additionalCategoryId } } }
      : {}),
    ...(technicianId
      ? technicianId === 'free_queue'
        ? { assignmentMode: 'FREE_QUEUE' }
        : { technicianId }
      : {}),
    ...(status ? { status } : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * ORDER_PAGE_SIZE,
      take: ORDER_PAGE_SIZE,
      select: orderSelect,
    }),
    prisma.order.count({ where }),
  ]);

  response.json({
    items: orders.map(mapOrder),
    pagination: {
      page,
      limit: ORDER_PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / ORDER_PAGE_SIZE),
    },
  });
});

ordersRouter.get('/:id', async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  if (!parsedId.success) {
    response.status(400).json(validationError());
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: parsedId.data },
    select: orderDetailsSelect,
  });
  if (!order) {
    response.status(404).json({ code: 'NOT_FOUND', message: 'Заказ не найден' });
    return;
  }
  response.json(mapOrderDetails(order));
});

ordersRouter.post('/', allowRoles('MANAGER'), async (request, response) => {
  const parsedBody = orderInputSchema.safeParse(request.body);
  if (!parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }

  const [technicianError, categoryError] = await Promise.all([
    validateTechnician(parsedBody.data.technicianId),
    validateCategoryLinks(
      parsedBody.data.mainCategoryId,
      parsedBody.data.additionalCategoryIds,
    ),
  ]);
  if (technicianError || categoryError) {
    response.status(400).json(validationError(technicianError ?? categoryError ?? undefined));
    return;
  }

  const user = request.session.user;
  if (!user) {
    response.status(401).json({ code: 'UNAUTHORIZED', message: 'Требуется авторизация' });
    return;
  }

  const order = await prisma.order.create({
    data: {
      ...buildOrderData(parsedBody.data),
      additionalCategories: {
        create: parsedBody.data.additionalCategoryIds.map((additionalCategoryId) => ({
          additionalCategoryId,
        })),
      },
      statusHistory: { create: buildStatusHistoryData(user, 'CREATED') },
    },
    select: orderSelect,
  });
  response.status(201).json(mapOrder(order));
});

ordersRouter.patch('/:id', allowRoles('MANAGER'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  const parsedBody = orderInputSchema.safeParse(request.body);
  if (!parsedId.success || !parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }

  const [technicianError, categoryError] = await Promise.all([
    validateTechnician(parsedBody.data.technicianId),
    validateCategoryLinks(
      parsedBody.data.mainCategoryId,
      parsedBody.data.additionalCategoryIds,
    ),
  ]);
  if (technicianError || categoryError) {
    response.status(400).json(validationError(technicianError ?? categoryError ?? undefined));
    return;
  }

  try {
    const order = await prisma.order.update({
      where: { id: parsedId.data },
      data: {
        ...buildOrderData(parsedBody.data),
        additionalCategories: {
          deleteMany: {},
          create: parsedBody.data.additionalCategoryIds.map((additionalCategoryId) => ({
            additionalCategoryId,
          })),
        },
      },
      select: orderSelect,
    });
    response.json(mapOrder(order));
  } catch (error) {
    if (isPrismaError(error, 'P2025')) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Заказ не найден' });
      return;
    }
    throw error;
  }
});

ordersRouter.post('/:id/take', allowRoles('TECHNICIAN'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  const user = request.session.user;
  if (!parsedId.success) {
    response.status(400).json(validationError());
    return;
  }
  if (user?.role !== 'TECHNICIAN' || !user.id) {
    response.status(403).json({
      code: 'FORBIDDEN',
      message: 'Взять заказ может только технический специалист',
    });
    return;
  }

  const result = await prisma.order.updateMany({
    where: { id: parsedId.data, assignmentMode: 'FREE_QUEUE', technicianId: null },
    data: { assignmentMode: 'ASSIGNED', technicianId: user.id },
  });
  if (result.count === 0) {
    response.status(409).json({
      code: 'ORDER_ALREADY_ASSIGNED',
      message: 'Заказ уже назначен другому сотруднику или не найден',
    });
    return;
  }

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: parsedId.data },
    select: orderSelect,
  });
  response.json(mapOrder(order));
});

ordersRouter.patch('/:id/status', allowRoles('MANAGER', 'TECHNICIAN'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  const parsedBody = orderStatusInputSchema.safeParse(request.body);
  const user = request.session.user;
  if (!parsedId.success || !parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }
  if (!user) {
    response.status(401).json({ code: 'UNAUTHORIZED', message: 'Требуется авторизация' });
    return;
  }

  if (user.role === 'TECHNICIAN') {
    if (!user.id) {
      response.status(403).json({ code: 'FORBIDDEN', message: 'Не удалось определить сотрудника' });
      return;
    }
    const assignedOrder = await prisma.order.findFirst({
      where: {
        id: parsedId.data,
        assignmentMode: 'ASSIGNED',
        technicianId: user.id,
      },
      select: { id: true },
    });
    if (!assignedOrder) {
      response.status(403).json({
        code: 'FORBIDDEN',
        message: 'Можно менять статус только назначенного вам заказа',
      });
      return;
    }
  }

  try {
    const order = await prisma.order.update({
      where: { id: parsedId.data },
      data: {
        status: parsedBody.data.status,
        statusHistory: {
          create: buildStatusHistoryData(user, parsedBody.data.status, parsedBody.data.comment),
        },
      },
      select: orderSelect,
    });
    response.json(mapOrder(order));
  } catch (error) {
    if (isPrismaError(error, 'P2025')) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Заказ не найден' });
      return;
    }
    throw error;
  }
});

ordersRouter.delete('/:id', allowRoles('MANAGER'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  if (!parsedId.success) {
    response.status(400).json(validationError());
    return;
  }

  try {
    await prisma.order.delete({ where: { id: parsedId.data } });
    response.status(204).end();
  } catch (error) {
    if (isPrismaError(error, 'P2025')) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Заказ не найден' });
      return;
    }
    throw error;
  }
});
