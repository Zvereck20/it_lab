import type { Prisma } from '../generated/prisma/client.js';
import { repairInputSchema, repairListQuerySchema } from '@itlab/contracts';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../db/prisma.js';
import { allowRoles } from '../middlewares/allowRoles.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const REPAIR_PAGE_SIZE = 50;
const idSchema = z.string().uuid();

const repairSelect = {
  id: true,
  name: true,
  description: true,
  technicianId: true,
  dueDate: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  technician: {
    select: { id: true, name: true, login: true },
  },
} satisfies Prisma.RepairSelect;

const isPrismaError = (error: unknown, code: string) =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === code);

const validationError = (message = 'Проверьте введённые данные') => ({
  code: 'VALIDATION_ERROR',
  message,
});

const mapRepair = (repair: {
  id: string;
  name: string;
  description: string | null;
  technicianId: string | null;
  dueDate: Date;
  status: 'CREATED' | 'IN_PROGRESS' | 'REVIEW' | 'REVISION' | 'COMPLETED';
  createdAt: Date;
  updatedAt: Date;
  technician: { id: string; name: string; login: string } | null;
}) => ({
  ...repair,
  description: repair.description ?? '',
  dueDate: repair.dueDate.toISOString().slice(0, 10),
});

const validateTechnician = async (technicianId: string | null) => {
  if (!technicianId) {
    return null;
  }

  const technician = await prisma.user.findFirst({
    where: {
      id: technicianId,
      role: 'TECHNICIAN',
      isActive: true,
    },
    select: { id: true },
  });

  return technician ? null : 'Ответственный сотрудник не найден или не является техническим специалистом';
};

export const repairsRouter = Router();

repairsRouter.use(requireAuth);

repairsRouter.get('/', async (request, response) => {
  const parsedQuery = repairListQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    response.status(400).json(validationError('Некорректные параметры поиска или фильтра'));
    return;
  }

  const { page, search, technicianId, status } = parsedQuery.data;
  const where: Prisma.RepairWhereInput = {
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(technicianId
      ? { technicianId: technicianId === 'unassigned' ? null : technicianId }
      : {}),
    ...(status ? { status } : {}),
  };

  const [repairs, total] = await Promise.all([
    prisma.repair.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * REPAIR_PAGE_SIZE,
      take: REPAIR_PAGE_SIZE,
      select: repairSelect,
    }),
    prisma.repair.count({ where }),
  ]);

  response.json({
    items: repairs.map(mapRepair),
    pagination: {
      page,
      limit: REPAIR_PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / REPAIR_PAGE_SIZE),
    },
  });
});

repairsRouter.get('/:id', async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);

  if (!parsedId.success) {
    response.status(400).json(validationError());
    return;
  }

  const repair = await prisma.repair.findUnique({
    where: { id: parsedId.data },
    select: repairSelect,
  });

  if (!repair) {
    response.status(404).json({ code: 'NOT_FOUND', message: 'Ремонт не найден' });
    return;
  }

  response.json(mapRepair(repair));
});

repairsRouter.post('/', allowRoles('MANAGER'), async (request, response) => {
  const parsedBody = repairInputSchema.safeParse(request.body);

  if (!parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }

  const technicianError = await validateTechnician(parsedBody.data.technicianId);
  if (technicianError) {
    response.status(400).json(validationError(technicianError));
    return;
  }

  const repair = await prisma.repair.create({
    data: {
      name: parsedBody.data.name,
      description: parsedBody.data.description || null,
      technicianId: parsedBody.data.technicianId,
      dueDate: new Date(`${parsedBody.data.dueDate}T00:00:00.000Z`),
    },
    select: repairSelect,
  });

  response.status(201).json(mapRepair(repair));
});

repairsRouter.patch('/:id', allowRoles('MANAGER'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  const parsedBody = repairInputSchema.safeParse(request.body);

  if (!parsedId.success || !parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }

  const technicianError = await validateTechnician(parsedBody.data.technicianId);
  if (technicianError) {
    response.status(400).json(validationError(technicianError));
    return;
  }

  try {
    const repair = await prisma.repair.update({
      where: { id: parsedId.data },
      data: {
        name: parsedBody.data.name,
        description: parsedBody.data.description || null,
        technicianId: parsedBody.data.technicianId,
        dueDate: new Date(`${parsedBody.data.dueDate}T00:00:00.000Z`),
      },
      select: repairSelect,
    });

    response.json(mapRepair(repair));
  } catch (error) {
    if (isPrismaError(error, 'P2025')) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Ремонт не найден' });
      return;
    }
    throw error;
  }
});

repairsRouter.delete('/:id', allowRoles('MANAGER'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);

  if (!parsedId.success) {
    response.status(400).json(validationError());
    return;
  }

  try {
    await prisma.repair.delete({ where: { id: parsedId.data } });
    response.status(204).end();
  } catch (error) {
    if (isPrismaError(error, 'P2025')) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Ремонт не найден' });
      return;
    }
    throw error;
  }
});
