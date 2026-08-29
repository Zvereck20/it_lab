import { pathToFileURL } from 'node:url';

import { env } from '../config/env.js';
import { prisma } from './prisma.js';

const MOCK_ITEMS_COUNT = 100;
const MOCK_ITEM_PREFIX = 'Тестовая складская позиция';

const formatItemNumber = (index: number) => String(index + 1).padStart(3, '0');

export const seedInventory = async () => {
  if (env.NODE_ENV === 'production') {
    throw new Error('Создание тестовых складских позиций запрещено в production');
  }

  const categoryLinks = await prisma.mainCategoryAdditionalCategory.findMany({
    orderBy: [
      { mainCategoryId: 'asc' },
      { additionalCategoryId: 'asc' },
    ],
    select: {
      mainCategoryId: true,
      additionalCategoryId: true,
      mainCategory: {
        select: { name: true },
      },
      additionalCategory: {
        select: { name: true },
      },
    },
  });

  if (categoryLinks.length === 0) {
    throw new Error(
      'Не найдены связанные основные и дополнительные категории. Сначала создайте категории в CRM',
    );
  }

  const mockItemNames = Array.from(
    { length: MOCK_ITEMS_COUNT },
    (_value, index) => `${MOCK_ITEM_PREFIX} ${formatItemNumber(index)}`,
  );
  const existingItems = await prisma.inventoryItem.findMany({
    where: { name: { in: mockItemNames } },
    select: { name: true },
  });
  const existingNames = new Set(existingItems.map((item) => item.name));
  const itemsToCreate = mockItemNames.flatMap((name, index) => {
    if (existingNames.has(name)) {
      return [];
    }

    const categoryLink = categoryLinks[index % categoryLinks.length];
    if (!categoryLink) {
      return [];
    }

    return [{
      name,
      description: [
        'Тестовая позиция для разработки.',
        `Основная категория: ${categoryLink.mainCategory.name}.`,
        `Дополнительная категория: ${categoryLink.additionalCategory.name}.`,
      ].join(' '),
      count: (index * 7) % 51,
      mainCategoryId: categoryLink.mainCategoryId,
      additionalCategoryIds: [categoryLink.additionalCategoryId],
    }];
  });

  if (itemsToCreate.length > 0) {
    await prisma.$transaction(
      itemsToCreate.map(({ additionalCategoryIds, ...item }) =>
        prisma.inventoryItem.create({
          data: {
            ...item,
            additionalCategories: {
              create: additionalCategoryIds.map((additionalCategoryId) => ({
                additionalCategoryId,
              })),
            },
          },
        })),
    );
  }

  console.info(
    `Складские мок-данные готовы: добавлено ${itemsToCreate.length}, уже существовало ${existingItems.length}`,
  );
};

const scriptPath = process.argv[1];

if (scriptPath && import.meta.url === pathToFileURL(scriptPath).href) {
  seedInventory()
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
