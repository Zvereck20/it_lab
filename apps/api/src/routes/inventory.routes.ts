import type { Prisma } from '../generated/prisma/client.js';
import {
  additionalCategoryInputSchema,
  inventoryItemInputSchema,
  inventoryListQuerySchema,
  mainCategoryInputSchema,
} from '@itlab/contracts';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../db/prisma.js';
import { allowRoles } from '../middlewares/allowRoles.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const INVENTORY_PAGE_SIZE = 50;
const idSchema = z.string().uuid();

const inventoryItemSelect = {
  id: true,
  name: true,
  description: true,
  count: true,
  mainCategoryId: true,
  additionalCategoryId: true,
  mainCategory: {
    select: { id: true, name: true },
  },
  additionalCategory: {
    select: { id: true, name: true },
  },
} satisfies Prisma.InventoryItemSelect;

const isPrismaError = (error: unknown, code: string) =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === code);

const validationError = (message = 'Проверьте введённые данные') => ({
  code: 'VALIDATION_ERROR',
  message,
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
  additionalCategoryId: string | null;
  mainCategory: { id: string; name: string };
  additionalCategory: { id: string; name: string } | null;
}) => ({
  ...item,
  description: item.description ?? '',
});

const validateCategoryPair = async (
  mainCategoryId: string,
  additionalCategoryId: string | null,
) => {
  const mainCategory = await prisma.mainCategory.findUnique({
    where: { id: mainCategoryId },
    select: { id: true },
  });

  if (!mainCategory) {
    return 'Основная категория не найдена';
  }

  if (!additionalCategoryId) {
    return null;
  }

  const categoryLink = await prisma.mainCategoryAdditionalCategory.findUnique({
    where: {
      mainCategoryId_additionalCategoryId: {
        mainCategoryId,
        additionalCategoryId,
      },
    },
    select: { mainCategoryId: true },
  });

  return categoryLink ? null : 'Дополнительная категория не связана с выбранной основной';
};

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth);

inventoryRouter.get('/categories', async (_request, response) => {
  const [mainCategories, additionalCategories] = await Promise.all([
    prisma.mainCategory.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.additionalCategory.findMany({
      orderBy: { name: 'asc' },
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

  const incompatibleItem = await prisma.inventoryItem.findFirst({
    where: {
      additionalCategoryId: parsedId.data,
      mainCategoryId: { notIn: parsedBody.data.mainCategoryIds },
    },
    select: { id: true },
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

  const usedItems = await prisma.inventoryItem.count({
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

inventoryRouter.get('/items', async (request, response) => {
  const parsedQuery = inventoryListQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    response.status(400).json(validationError('Некорректные параметры поиска или фильтра'));
    return;
  }

  const { page, search, mainCategoryId, additionalCategoryId } = parsedQuery.data;

  if (additionalCategoryId && !mainCategoryId) {
    response.status(400).json(validationError('Сначала выберите основную категорию'));
    return;
  }

  const where: Prisma.InventoryItemWhereInput = {
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(mainCategoryId ? { mainCategoryId } : {}),
    ...(additionalCategoryId ? { additionalCategoryId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
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

inventoryRouter.post('/items', allowRoles('MANAGER'), async (request, response) => {
  const parsedBody = inventoryItemInputSchema.safeParse(request.body);

  if (!parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }

  const pairError = await validateCategoryPair(
    parsedBody.data.mainCategoryId,
    parsedBody.data.additionalCategoryId,
  );

  if (pairError) {
    response.status(400).json(validationError(pairError));
    return;
  }

  const item = await prisma.inventoryItem.create({
    data: {
      ...parsedBody.data,
      description: parsedBody.data.description || null,
    },
    select: inventoryItemSelect,
  });

  response.status(201).json(mapInventoryItem(item));
});

inventoryRouter.patch('/items/:id', allowRoles('MANAGER'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  const parsedBody = inventoryItemInputSchema.safeParse(request.body);

  if (!parsedId.success || !parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }

  const pairError = await validateCategoryPair(
    parsedBody.data.mainCategoryId,
    parsedBody.data.additionalCategoryId,
  );

  if (pairError) {
    response.status(400).json(validationError(pairError));
    return;
  }

  try {
    const item = await prisma.inventoryItem.update({
      where: { id: parsedId.data },
      data: {
        ...parsedBody.data,
        description: parsedBody.data.description || null,
      },
      select: inventoryItemSelect,
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
    throw error;
  }
});
