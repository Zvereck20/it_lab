import type { Prisma } from '../generated/prisma/client.js';
import type { AuthUser, InventoryAllocationTarget } from '@itlab/contracts';
import {
  additionalCategoryInputSchema,
  inventoryAllocationInputSchema,
  inventoryAllocationTargetsQuerySchema,
  inventoryItemInputSchema,
  inventoryListQuerySchema,
  mainCategoryInputSchema,
  workItemComponentInputSchema,
  workItemComponentQuantityInputSchema,
} from '@itlab/contracts';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../db/prisma.js';
import { allowRoles } from '../middlewares/allowRoles.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import {
  formatOrderNumber,
  formatRepairNumber,
  parseWorkNumberSearch,
} from '../utils/workNumber.js';

const INVENTORY_PAGE_SIZE = 50;
const idSchema = z.string().uuid();
const workItemTypeSchema = z.enum(['order', 'repair']);
const workItemParamsSchema = z.object({
  type: workItemTypeSchema,
  id: z.string().uuid(),
});
const workItemComponentParamsSchema = workItemParamsSchema.extend({
  componentId: z.string().uuid(),
});

class InventoryAllocationError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

class InventoryComponentError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const workItemComponentSelect = {
  id: true,
  inventoryItemId: true,
  nameSnapshot: true,
  quantity: true,
  addedById: true,
  addedByName: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderComponentSelect;

const inventoryItemSelect = {
  id: true,
  name: true,
  description: true,
  count: true,
  mainCategoryId: true,
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
} satisfies Prisma.InventoryItemSelect;

const isPrismaError = (error: unknown, code: string) =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === code);

const validationError = (message = 'Проверьте введённые данные') => ({
  code: 'VALIDATION_ERROR',
  message,
});

const movementActor = (user: AuthUser) => ({
  performedById: user.id ?? 'ADMIN',
  performedByName: user.name,
});

const mapWorkItemComponent = (
  component: Prisma.OrderComponentGetPayload<{ select: typeof workItemComponentSelect }>,
) => {
  const { nameSnapshot, ...fields } = component;
  return { ...fields, name: nameSnapshot };
};

const assertWorkItemAccess = async (
  transaction: Prisma.TransactionClient,
  type: 'order' | 'repair',
  id: string,
  user: AuthUser,
) => {
  const item = type === 'order'
    ? await transaction.order.findUnique({
        where: { id },
        select: { status: true, assignmentMode: true, technicianId: true },
      })
    : await transaction.repair.findUnique({
        where: { id },
        select: { status: true, assignmentMode: true, technicianId: true },
      });

  if (!item) {
    throw new InventoryComponentError(
      404,
      'WORK_ITEM_NOT_FOUND',
      type === 'order' ? 'Заказ не найден' : 'Ремонт не найден',
    );
  }
  if (item.status === 'COMPLETED') {
    throw new InventoryComponentError(
      409,
      'WORK_ITEM_COMPLETED',
      'Нельзя изменить компоненты выполненной карточки',
    );
  }
  if (
    user.role === 'TECHNICIAN'
    && (item.assignmentMode !== 'ASSIGNED' || item.technicianId !== user.id)
  ) {
    throw new InventoryComponentError(
      403,
      'WORK_ITEM_FORBIDDEN',
      'Изменять компоненты может только назначенный на карточку специалист',
    );
  }
};

const findWorkItemComponent = (
  transaction: Prisma.TransactionClient,
  type: 'order' | 'repair',
  workItemId: string,
  componentId: string,
) => type === 'order'
  ? transaction.orderComponent.findFirst({
      where: { id: componentId, orderId: workItemId },
      select: workItemComponentSelect,
    })
  : transaction.repairComponent.findFirst({
      where: { id: componentId, repairId: workItemId },
      select: workItemComponentSelect,
    });

const categoryConflict = {
  code: 'CATEGORY_IN_USE',
  message: 'Категория используется. Сначала удалите или перенесите связанные позиции',
};

const mapInventoryItem = (item: {
  id: string;
  name: string;
  description: string | null;
  count: number;
  mainCategoryId: string;
  mainCategory: { id: string; name: string };
  additionalCategories: Array<{
    additionalCategory: { id: string; name: string };
  }>;
}) => {
  const additionalCategories = item.additionalCategories
    .map((link) => link.additionalCategory)
    .sort((left, right) => left.name.localeCompare(right.name, 'ru-RU'));

  return {
    ...item,
    description: item.description ?? '',
    additionalCategoryIds: additionalCategories.map((category) => category.id),
    additionalCategories,
  };
};

const validateCategoryLinks = async (
  mainCategoryId: string,
  additionalCategoryIds: string[],
) => {
  const mainCategory = await prisma.mainCategory.findUnique({
    where: { id: mainCategoryId },
    select: { id: true },
  });

  if (!mainCategory) {
    return 'Основная категория не найдена';
  }

  const categoryLinksCount = await prisma.mainCategoryAdditionalCategory.count({
    where: {
      mainCategoryId,
      additionalCategoryId: { in: additionalCategoryIds },
    },
  });

  return categoryLinksCount === additionalCategoryIds.length
    ? null
    : 'Одна из дополнительных категорий не связана с выбранной основной';
};

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth);

inventoryRouter.get('/categories', async (_request, response) => {
  const [mainCategories, additionalCategories] = await Promise.all([
    prisma.mainCategory.findMany({
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, name: true },
    }),
    prisma.additionalCategory.findMany({
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        mainCategories: {
          select: { mainCategoryId: true },
        },
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

inventoryRouter.post('/categories/main', allowRoles('ADMIN'), async (request, response) => {
  const parsedBody = mainCategoryInputSchema.safeParse(request.body);

  if (!parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }

  try {
    const category = await prisma.mainCategory.create({
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

inventoryRouter.patch('/categories/main/:id', allowRoles('ADMIN'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  const parsedBody = mainCategoryInputSchema.safeParse(request.body);

  if (!parsedId.success || !parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }

  try {
    const category = await prisma.mainCategory.update({
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

inventoryRouter.delete('/categories/main/:id', allowRoles('ADMIN'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);

  if (!parsedId.success) {
    response.status(400).json(validationError());
    return;
  }

  const usedItems = await prisma.inventoryItem.count({
    where: { mainCategoryId: parsedId.data },
  });

  if (usedItems > 0) {
    response.status(409).json(categoryConflict);
    return;
  }

  try {
    await prisma.mainCategory.delete({ where: { id: parsedId.data } });
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

inventoryRouter.post('/categories/additional', allowRoles('ADMIN'), async (request, response) => {
  const parsedBody = additionalCategoryInputSchema.safeParse(request.body);

  if (!parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }

  try {
    const category = await prisma.additionalCategory.create({
      data: {
        name: parsedBody.data.name,
        mainCategories: {
          create: parsedBody.data.mainCategoryIds.map((mainCategoryId) => ({
            mainCategoryId,
          })),
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

inventoryRouter.patch('/categories/additional/:id', allowRoles('ADMIN'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  const parsedBody = additionalCategoryInputSchema.safeParse(request.body);

  if (!parsedId.success || !parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }

  const incompatibleItem = await prisma.inventoryItemAdditionalCategory.findFirst({
    where: {
      additionalCategoryId: parsedId.data,
      inventoryItem: {
        mainCategoryId: { notIn: parsedBody.data.mainCategoryIds },
      },
    },
    select: { inventoryItemId: true },
  });

  if (incompatibleItem) {
    response.status(409).json({
      code: 'CATEGORY_LINK_IN_USE',
      message: 'Нельзя убрать связь: она используется складской позицией',
    });
    return;
  }

  try {
    const category = await prisma.$transaction(async (transaction) => {
      await transaction.mainCategoryAdditionalCategory.deleteMany({
        where: { additionalCategoryId: parsedId.data },
      });

      return transaction.additionalCategory.update({
        where: { id: parsedId.data },
        data: {
          name: parsedBody.data.name,
          mainCategories: {
            create: parsedBody.data.mainCategoryIds.map((mainCategoryId) => ({
              mainCategoryId,
            })),
          },
        },
        select: { id: true, name: true },
      });
    });

    response.json({
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
    if (isPrismaError(error, 'P2025')) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Категория не найдена' });
      return;
    }
    throw error;
  }
});

inventoryRouter.delete('/categories/additional/:id', allowRoles('ADMIN'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);

  if (!parsedId.success) {
    response.status(400).json(validationError());
    return;
  }

  const usedItems = await prisma.inventoryItemAdditionalCategory.count({
    where: { additionalCategoryId: parsedId.data },
  });

  if (usedItems > 0) {
    response.status(409).json(categoryConflict);
    return;
  }

  try {
    await prisma.additionalCategory.delete({ where: { id: parsedId.data } });
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

inventoryRouter.get(
  '/allocation-targets',
  allowRoles('TECHNICIAN'),
  async (request, response) => {
    const parsedQuery = inventoryAllocationTargetsQuerySchema.safeParse(request.query);
    const user = request.session.user;

    if (!parsedQuery.success) {
      response.status(400).json(validationError('Некорректные параметры поиска'));
      return;
    }
    if (!user) {
      response.status(401).json({ code: 'UNAUTHORIZED', message: 'Требуется авторизация' });
      return;
    }
    if (user.role === 'TECHNICIAN' && !user.id) {
      response.status(403).json({
        code: 'FORBIDDEN',
        message: 'Не удалось определить сотрудника',
      });
      return;
    }

    const parsedSearch = parseWorkNumberSearch(parsedQuery.data.search);
    if (!parsedSearch) {
      response.status(400).json(validationError('Введите номер заказа или ремонта'));
      return;
    }

    const technicianFilter = user.role === 'TECHNICIAN'
      ? { technicianId: user.id! }
      : {};
    const numberFilter = parsedSearch.number === undefined
      ? {}
      : { number: parsedSearch.number };
    const includeOrders = parsedSearch.type !== 'REPAIR';
    const includeRepairs = parsedSearch.type !== 'ORDER';

    const [orders, repairs] = await Promise.all([
      includeOrders
        ? prisma.order.findMany({
            where: { ...technicianFilter, ...numberFilter },
            orderBy: { number: 'desc' },
            take: parsedQuery.data.limit,
            select: { id: true, number: true, status: true },
          })
        : [],
      includeRepairs
        ? prisma.repair.findMany({
            where: { ...technicianFilter, ...numberFilter },
            orderBy: { number: 'desc' },
            take: parsedQuery.data.limit,
            select: { id: true, number: true, status: true },
          })
        : [],
    ]);

    const items = [
      ...orders.map((order) => ({
        id: order.id,
        type: 'ORDER' as const,
        number: formatOrderNumber(order.number),
        disabled: order.status === 'COMPLETED',
        sortNumber: order.number,
      })),
      ...repairs.map((repair) => ({
        id: repair.id,
        type: 'REPAIR' as const,
        number: formatRepairNumber(repair.number),
        disabled: repair.status === 'COMPLETED',
        sortNumber: repair.number,
      })),
    ]
      .sort((left, right) => right.sortNumber - left.sortNumber)
      .slice(0, parsedQuery.data.limit)
      .map(({ sortNumber: _sortNumber, ...item }) => item);

    response.json({ items });
  },
);

inventoryRouter.get('/items', async (request, response) => {
  const parsedQuery = inventoryListQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    response.status(400).json(validationError('Некорректные параметры поиска или фильтра'));
    return;
  }

  const { page, search, searchField, mainCategoryId, additionalCategoryId } = parsedQuery.data;

  if (additionalCategoryId && !mainCategoryId) {
    response.status(400).json(validationError('Сначала выберите основную категорию'));
    return;
  }

  const where: Prisma.InventoryItemWhereInput = {
    ...(search
      ? searchField === 'name'
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
            ],
          }
      : {}),
    ...(mainCategoryId ? { mainCategoryId } : {}),
    ...(additionalCategoryId
      ? {
          additionalCategories: {
            some: { additionalCategoryId },
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * INVENTORY_PAGE_SIZE,
      take: INVENTORY_PAGE_SIZE,
      select: inventoryItemSelect,
    }),
    prisma.inventoryItem.count({ where }),
  ]);

  response.json({
    items: items.map(mapInventoryItem),
    pagination: {
      page,
      limit: INVENTORY_PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / INVENTORY_PAGE_SIZE),
    },
  });
});

inventoryRouter.get('/items/:id', async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);

  if (!parsedId.success) {
    response.status(400).json(validationError());
    return;
  }

  const item = await prisma.inventoryItem.findUnique({
    where: { id: parsedId.data },
    select: inventoryItemSelect,
  });

  if (!item) {
    response.status(404).json({ code: 'NOT_FOUND', message: 'Позиция не найдена' });
    return;
  }

  response.json(mapInventoryItem(item));
});

inventoryRouter.post(
  '/items/:id/allocate',
  allowRoles('TECHNICIAN'),
  async (request, response) => {
    const parsedId = idSchema.safeParse(request.params.id);
    const parsedBody = inventoryAllocationInputSchema.safeParse(request.body);
    const user = request.session.user;

    if (!parsedId.success || !parsedBody.success) {
      response.status(400).json(validationError());
      return;
    }
    if (!user) {
      response.status(401).json({ code: 'UNAUTHORIZED', message: 'Требуется авторизация' });
      return;
    }
    if (user.role === 'TECHNICIAN' && !user.id) {
      response.status(403).json({
        code: 'FORBIDDEN',
        message: 'Не удалось определить сотрудника',
      });
      return;
    }

    const totalQuantity = parsedBody.data.quantity * parsedBody.data.targets.length;
    if (!Number.isSafeInteger(totalQuantity)) {
      response.status(400).json(validationError('Некорректное общее количество'));
      return;
    }

    try {
      const result = await prisma.$transaction(async (transaction) => {
        const item = await transaction.inventoryItem.findUnique({
          where: { id: parsedId.data },
          select: { id: true, name: true },
        });
        if (!item) {
          throw new InventoryAllocationError(404, 'NOT_FOUND', 'Позиция не найдена');
        }

        const orderTargets = parsedBody.data.targets.filter(
          (target): target is InventoryAllocationTarget & { type: 'ORDER' } =>
            target.type === 'ORDER',
        );
        const repairTargets = parsedBody.data.targets.filter(
          (target): target is InventoryAllocationTarget & { type: 'REPAIR' } =>
            target.type === 'REPAIR',
        );
        const technicianFilter = user.role === 'TECHNICIAN'
          ? { technicianId: user.id! }
          : {};

        const [orders, repairs] = await Promise.all([
          transaction.order.findMany({
            where: {
              id: { in: orderTargets.map((target) => target.id) },
              ...technicianFilter,
            },
            select: { id: true, status: true },
          }),
          transaction.repair.findMany({
            where: {
              id: { in: repairTargets.map((target) => target.id) },
              ...technicianFilter,
            },
            select: { id: true, status: true },
          }),
        ]);

        if (orders.length !== orderTargets.length || repairs.length !== repairTargets.length) {
          throw new InventoryAllocationError(
            403,
            'TARGET_FORBIDDEN',
            'Один из выбранных заказов или ремонтов недоступен',
          );
        }
        if (
          orders.some((order) => order.status === 'COMPLETED')
          || repairs.some((repair) => repair.status === 'COMPLETED')
        ) {
          throw new InventoryAllocationError(
            409,
            'TARGET_COMPLETED',
            'Нельзя изменить выполненный заказ или ремонт',
          );
        }

        const updatedStock = await transaction.inventoryItem.updateMany({
          where: { id: item.id, count: { gte: totalQuantity } },
          data: { count: { decrement: totalQuantity } },
        });
        if (updatedStock.count === 0) {
          throw new InventoryAllocationError(
            409,
            'INSUFFICIENT_STOCK',
            'На складе недостаточно компонентов',
          );
        }

        const actor = movementActor(user);
        for (const target of parsedBody.data.targets) {
          if (target.type === 'ORDER') {
            await transaction.orderComponent.upsert({
              where: {
                orderId_inventoryItemId: {
                  orderId: target.id,
                  inventoryItemId: item.id,
                },
              },
              create: {
                orderId: target.id,
                inventoryItemId: item.id,
                nameSnapshot: item.name,
                quantity: parsedBody.data.quantity,
                addedById: actor.performedById,
                addedByName: actor.performedByName,
              },
              update: { quantity: { increment: parsedBody.data.quantity } },
            });
            await transaction.inventoryMovement.create({
              data: {
                inventoryItemId: item.id,
                operationType: 'ORDER_ALLOCATION',
                quantityDelta: -parsedBody.data.quantity,
                orderId: target.id,
                ...actor,
              },
            });
          } else {
            await transaction.repairComponent.upsert({
              where: {
                repairId_inventoryItemId: {
                  repairId: target.id,
                  inventoryItemId: item.id,
                },
              },
              create: {
                repairId: target.id,
                inventoryItemId: item.id,
                nameSnapshot: item.name,
                quantity: parsedBody.data.quantity,
                addedById: actor.performedById,
                addedByName: actor.performedByName,
              },
              update: { quantity: { increment: parsedBody.data.quantity } },
            });
            await transaction.inventoryMovement.create({
              data: {
                inventoryItemId: item.id,
                operationType: 'REPAIR_ALLOCATION',
                quantityDelta: -parsedBody.data.quantity,
                repairId: target.id,
                ...actor,
              },
            });
          }
        }

        const updatedItem = await transaction.inventoryItem.findUniqueOrThrow({
          where: { id: item.id },
          select: { count: true },
        });

        return {
          inventoryItemId: item.id,
          remainingCount: updatedItem.count,
          allocatedTargets: parsedBody.data.targets.length,
        };
      });

      response.json(result);
    } catch (error) {
      if (error instanceof InventoryAllocationError) {
        response.status(error.status).json({ code: error.code, message: error.message });
        return;
      }
      throw error;
    }
  },
);

inventoryRouter.post(
  '/work-items/:type/:id/components',
  allowRoles('TECHNICIAN'),
  async (request, response) => {
    const parsedParams = workItemParamsSchema.safeParse(request.params);
    const parsedBody = workItemComponentInputSchema.safeParse(request.body);
    const user = request.session.user;

    if (!parsedParams.success || !parsedBody.success) {
      response.status(400).json(validationError());
      return;
    }
    if (!user) {
      response.status(401).json({ code: 'UNAUTHORIZED', message: 'Требуется авторизация' });
      return;
    }
    if (user.role === 'TECHNICIAN' && !user.id) {
      response.status(403).json({
        code: 'FORBIDDEN',
        message: 'Не удалось определить сотрудника',
      });
      return;
    }

    const { type, id } = parsedParams.data;
    const { inventoryItemId, quantity } = parsedBody.data;

    try {
      const component = await prisma.$transaction(async (transaction) => {
        await assertWorkItemAccess(transaction, type, id, user);

        const inventoryItem = await transaction.inventoryItem.findUnique({
          where: { id: inventoryItemId },
          select: { id: true, name: true },
        });
        if (!inventoryItem) {
          throw new InventoryComponentError(404, 'INVENTORY_ITEM_NOT_FOUND', 'Компонент не найден');
        }

        const existingComponent = type === 'order'
          ? await transaction.orderComponent.findUnique({
              where: { orderId_inventoryItemId: { orderId: id, inventoryItemId } },
              select: { id: true },
            })
          : await transaction.repairComponent.findUnique({
              where: { repairId_inventoryItemId: { repairId: id, inventoryItemId } },
              select: { id: true },
            });
        if (existingComponent) {
          throw new InventoryComponentError(
            409,
            'COMPONENT_EXISTS',
            'Компонент уже добавлен в карточку',
          );
        }

        const updatedStock = await transaction.inventoryItem.updateMany({
          where: { id: inventoryItemId, count: { gte: quantity } },
          data: { count: { decrement: quantity } },
        });
        if (updatedStock.count === 0) {
          throw new InventoryComponentError(
            409,
            'INSUFFICIENT_STOCK',
            'На складе недостаточно компонентов',
          );
        }

        const actor = movementActor(user);
        const createdComponent = type === 'order'
          ? await transaction.orderComponent.create({
              data: {
                orderId: id,
                inventoryItemId,
                nameSnapshot: inventoryItem.name,
                quantity,
                addedById: actor.performedById,
                addedByName: actor.performedByName,
              },
              select: workItemComponentSelect,
            })
          : await transaction.repairComponent.create({
              data: {
                repairId: id,
                inventoryItemId,
                nameSnapshot: inventoryItem.name,
                quantity,
                addedById: actor.performedById,
                addedByName: actor.performedByName,
              },
              select: workItemComponentSelect,
            });

        await transaction.inventoryMovement.create({
          data: {
            inventoryItemId,
            operationType: type === 'order' ? 'ORDER_ALLOCATION' : 'REPAIR_ALLOCATION',
            quantityDelta: -quantity,
            ...(type === 'order' ? { orderId: id } : { repairId: id }),
            ...actor,
          },
        });

        return createdComponent;
      });

      response.status(201).json(mapWorkItemComponent(component));
    } catch (error) {
      if (error instanceof InventoryComponentError) {
        response.status(error.status).json({ code: error.code, message: error.message });
        return;
      }
      if (isPrismaError(error, 'P2002')) {
        response.status(409).json({
          code: 'COMPONENT_EXISTS',
          message: 'Компонент уже добавлен в карточку',
        });
        return;
      }
      throw error;
    }
  },
);

inventoryRouter.patch(
  '/work-items/:type/:id/components/:componentId',
  allowRoles('ADMIN'),
  async (request, response) => {
    const parsedParams = workItemComponentParamsSchema.safeParse(request.params);
    const parsedBody = workItemComponentQuantityInputSchema.safeParse(request.body);
    const user = request.session.user;

    if (!parsedParams.success || !parsedBody.success) {
      response.status(400).json(validationError());
      return;
    }
    if (!user) {
      response.status(401).json({ code: 'UNAUTHORIZED', message: 'Требуется авторизация' });
      return;
    }
    if (user.role === 'TECHNICIAN' && !user.id) {
      response.status(403).json({
        code: 'FORBIDDEN',
        message: 'Не удалось определить сотрудника',
      });
      return;
    }

    const { type, id, componentId } = parsedParams.data;
    const { quantity } = parsedBody.data;

    try {
      const component = await prisma.$transaction(async (transaction) => {
        await assertWorkItemAccess(transaction, type, id, user);

        const currentComponent = await findWorkItemComponent(
          transaction,
          type,
          id,
          componentId,
        );
        if (!currentComponent) {
          throw new InventoryComponentError(404, 'COMPONENT_NOT_FOUND', 'Компонент не найден');
        }

        const quantityDelta = quantity - currentComponent.quantity;
        if (quantityDelta === 0) return currentComponent;

        if (quantityDelta > 0) {
          const updatedStock = await transaction.inventoryItem.updateMany({
            where: {
              id: currentComponent.inventoryItemId,
              count: { gte: quantityDelta },
            },
            data: { count: { decrement: quantityDelta } },
          });
          if (updatedStock.count === 0) {
            throw new InventoryComponentError(
              409,
              'INSUFFICIENT_STOCK',
              'На складе недостаточно компонентов',
            );
          }
        }

        const updatedComponent = type === 'order'
          ? await transaction.orderComponent.updateMany({
              where: { id: componentId, orderId: id, quantity: currentComponent.quantity },
              data: { quantity },
            })
          : await transaction.repairComponent.updateMany({
              where: { id: componentId, repairId: id, quantity: currentComponent.quantity },
              data: { quantity },
            });
        if (updatedComponent.count === 0) {
          throw new InventoryComponentError(
            409,
            'COMPONENT_CHANGED',
            'Количество компонента уже изменилось. Обновите карточку',
          );
        }

        if (quantityDelta < 0) {
          await transaction.inventoryItem.update({
            where: { id: currentComponent.inventoryItemId },
            data: { count: { increment: -quantityDelta } },
          });
        }

        await transaction.inventoryMovement.create({
          data: {
            inventoryItemId: currentComponent.inventoryItemId,
            operationType: quantityDelta > 0
              ? type === 'order' ? 'ORDER_ALLOCATION' : 'REPAIR_ALLOCATION'
              : type === 'order' ? 'ORDER_RETURN' : 'REPAIR_RETURN',
            quantityDelta: -quantityDelta,
            ...(type === 'order' ? { orderId: id } : { repairId: id }),
            ...movementActor(user),
          },
        });

        return findWorkItemComponent(transaction, type, id, componentId);
      });

      if (!component) {
        response.status(404).json({ code: 'COMPONENT_NOT_FOUND', message: 'Компонент не найден' });
        return;
      }
      response.json(mapWorkItemComponent(component));
    } catch (error) {
      if (error instanceof InventoryComponentError) {
        response.status(error.status).json({ code: error.code, message: error.message });
        return;
      }
      throw error;
    }
  },
);

inventoryRouter.delete(
  '/work-items/:type/:id/components/:componentId',
  allowRoles('ADMIN'),
  async (request, response) => {
    const parsedParams = workItemComponentParamsSchema.safeParse(request.params);
    const user = request.session.user;

    if (!parsedParams.success) {
      response.status(400).json(validationError());
      return;
    }
    if (!user) {
      response.status(401).json({ code: 'UNAUTHORIZED', message: 'Требуется авторизация' });
      return;
    }
    if (user.role === 'TECHNICIAN' && !user.id) {
      response.status(403).json({
        code: 'FORBIDDEN',
        message: 'Не удалось определить сотрудника',
      });
      return;
    }

    const { type, id, componentId } = parsedParams.data;

    try {
      await prisma.$transaction(async (transaction) => {
        await assertWorkItemAccess(transaction, type, id, user);

        const component = await findWorkItemComponent(transaction, type, id, componentId);
        if (!component) {
          throw new InventoryComponentError(404, 'COMPONENT_NOT_FOUND', 'Компонент не найден');
        }

        const deletedComponent = type === 'order'
          ? await transaction.orderComponent.deleteMany({ where: { id: componentId, orderId: id } })
          : await transaction.repairComponent.deleteMany({ where: { id: componentId, repairId: id } });
        if (deletedComponent.count === 0) {
          throw new InventoryComponentError(
            409,
            'COMPONENT_CHANGED',
            'Компонент уже изменён. Обновите карточку',
          );
        }

        await transaction.inventoryItem.update({
          where: { id: component.inventoryItemId },
          data: { count: { increment: component.quantity } },
        });
        await transaction.inventoryMovement.create({
          data: {
            inventoryItemId: component.inventoryItemId,
            operationType: type === 'order' ? 'ORDER_RETURN' : 'REPAIR_RETURN',
            quantityDelta: component.quantity,
            ...(type === 'order' ? { orderId: id } : { repairId: id }),
            ...movementActor(user),
          },
        });
      });

      response.status(204).end();
    } catch (error) {
      if (error instanceof InventoryComponentError) {
        response.status(error.status).json({ code: error.code, message: error.message });
        return;
      }
      throw error;
    }
  },
);

inventoryRouter.post('/items', allowRoles('MANAGER'), async (request, response) => {
  const parsedBody = inventoryItemInputSchema.safeParse(request.body);
  const user = request.session.user;

  if (!parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }
  if (!user) {
    response.status(401).json({ code: 'UNAUTHORIZED', message: 'Требуется авторизация' });
    return;
  }

  const pairError = await validateCategoryLinks(
    parsedBody.data.mainCategoryId,
    parsedBody.data.additionalCategoryIds,
  );

  if (pairError) {
    response.status(400).json(validationError(pairError));
    return;
  }

  const item = await prisma.$transaction(async (transaction) => {
    const createdItem = await transaction.inventoryItem.create({
      data: {
        name: parsedBody.data.name,
        description: parsedBody.data.description || null,
        count: parsedBody.data.count,
        mainCategoryId: parsedBody.data.mainCategoryId,
        additionalCategories: {
          create: parsedBody.data.additionalCategoryIds.map((additionalCategoryId) => ({
            additionalCategoryId,
          })),
        },
      },
      select: inventoryItemSelect,
    });

    if (parsedBody.data.count > 0) {
      await transaction.inventoryMovement.create({
        data: {
          inventoryItemId: createdItem.id,
          operationType: 'STOCK_RECEIPT',
          quantityDelta: parsedBody.data.count,
          ...movementActor(user),
        },
      });
    }

    return createdItem;
  });

  response.status(201).json(mapInventoryItem(item));
});

inventoryRouter.patch('/items/:id', allowRoles('MANAGER'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  const parsedBody = inventoryItemInputSchema.safeParse(request.body);
  const user = request.session.user;

  if (!parsedId.success || !parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }
  if (!user) {
    response.status(401).json({ code: 'UNAUTHORIZED', message: 'Требуется авторизация' });
    return;
  }

  const pairError = await validateCategoryLinks(
    parsedBody.data.mainCategoryId,
    parsedBody.data.additionalCategoryIds,
  );

  if (pairError) {
    response.status(400).json(validationError(pairError));
    return;
  }

  try {
    const item = await prisma.$transaction(async (transaction) => {
      const currentItem = await transaction.inventoryItem.findUniqueOrThrow({
        where: { id: parsedId.data },
        select: { count: true },
      });
      const updatedItem = await transaction.inventoryItem.update({
        where: { id: parsedId.data },
        data: {
          name: parsedBody.data.name,
          description: parsedBody.data.description || null,
          count: parsedBody.data.count,
          mainCategoryId: parsedBody.data.mainCategoryId,
          additionalCategories: {
            deleteMany: {},
            create: parsedBody.data.additionalCategoryIds.map((additionalCategoryId) => ({
              additionalCategoryId,
            })),
          },
        },
        select: inventoryItemSelect,
      });
      const quantityDelta = parsedBody.data.count - currentItem.count;

      if (quantityDelta !== 0) {
        await transaction.inventoryMovement.create({
          data: {
            inventoryItemId: parsedId.data,
            operationType: quantityDelta > 0 ? 'STOCK_RECEIPT' : 'MANUAL_DECREASE',
            quantityDelta,
            ...movementActor(user),
          },
        });
      }

      return updatedItem;
    });
    response.json(mapInventoryItem(item));
  } catch (error) {
    if (isPrismaError(error, 'P2025')) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Позиция не найдена' });
      return;
    }
    throw error;
  }
});

inventoryRouter.delete('/items/:id', allowRoles('MANAGER'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);

  if (!parsedId.success) {
    response.status(400).json(validationError());
    return;
  }

  try {
    await prisma.inventoryItem.delete({ where: { id: parsedId.data } });
    response.status(204).end();
  } catch (error) {
    if (isPrismaError(error, 'P2025')) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Позиция не найдена' });
      return;
    }
    if (isPrismaError(error, 'P2003')) {
      response.status(409).json({
        code: 'ITEM_IN_USE',
        message: 'Позиция добавлена в заказ или ремонт и не может быть удалена',
      });
      return;
    }
    throw error;
  }
});
