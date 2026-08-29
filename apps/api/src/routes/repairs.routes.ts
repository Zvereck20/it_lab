import type { Prisma } from '../generated/prisma/client.js';
import type { RepairInput } from '@itlab/contracts';
import {
  repairInputSchema,
  repairListQuerySchema,
  repairStatusInputSchema,
} from '@itlab/contracts';
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
  customerType: true,
  customerPhone: true,
  customerFirstName: true,
  customerLastName: true,
  customerMiddleName: true,
  companyName: true,
  inn: true,
  assignmentMode: true,
  technicianId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  technician: {
    select: { id: true, name: true, login: true },
  },
} satisfies Prisma.RepairSelect;

type SelectedRepair = {
  id: string;
  name: string;
  description: string | null;
  customerType: 'INDIVIDUAL' | 'LEGAL_ENTITY';
  customerPhone: string;
  customerFirstName: string;
  customerLastName: string;
  customerMiddleName: string | null;
  companyName: string | null;
  inn: string | null;
  assignmentMode: 'FREE_QUEUE' | 'ASSIGNED';
  technicianId: string | null;
  status: 'CREATED' | 'DIAGNOSTICS' | 'APPROVAL' | 'IN_PROGRESS' | 'REVISION' | 'COMPLETED';
  createdAt: Date;
  updatedAt: Date;
  technician: { id: string; name: string; login: string } | null;
};

const isPrismaError = (error: unknown, code: string) =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === code);

const validationError = (message = 'Проверьте введённые данные') => ({
  code: 'VALIDATION_ERROR',
  message,
});

const mapRepair = (repair: SelectedRepair) => ({
  ...repair,
  description: repair.description ?? '',
  customerMiddleName: repair.customerMiddleName ?? '',
  companyName: repair.companyName ?? '',
  inn: repair.inn ?? '',
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

  return technician
    ? null
    : 'Ответственный сотрудник не найден или не является техническим специалистом';
};

const buildRepairData = (input: RepairInput) => ({
  name: input.name,
  description: input.description || null,
  customerType: input.customerType,
  customerPhone: input.customerPhone,
  customerFirstName: input.customerFirstName,
  customerLastName: input.customerLastName,
  customerMiddleName: input.customerMiddleName || null,
  companyName: input.customerType === 'LEGAL_ENTITY' ? input.companyName : null,
  inn: input.customerType === 'LEGAL_ENTITY' ? input.inn : null,
  assignmentMode: input.technicianId ? 'ASSIGNED' as const : 'FREE_QUEUE' as const,
  technicianId: input.technicianId,
});

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
      ? technicianId === 'free_queue'
        ? { assignmentMode: 'FREE_QUEUE' }
        : { technicianId }
      : {}),
    ...(status ? { status } : {}),
  };

  const [repairs, total] = await Promise.all([
    prisma.repair.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
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
    data: buildRepairData(parsedBody.data),
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
      data: buildRepairData(parsedBody.data),
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

repairsRouter.post('/:id/take', allowRoles('TECHNICIAN'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  const user = request.session.user;

  if (!parsedId.success) {
    response.status(400).json(validationError());
    return;
  }

  if (user?.role !== 'TECHNICIAN' || !user.id) {
    response.status(403).json({
      code: 'FORBIDDEN',
      message: 'Взять ремонт может только технический специалист',
    });
    return;
  }

  const result = await prisma.repair.updateMany({
    where: {
      id: parsedId.data,
      assignmentMode: 'FREE_QUEUE',
      technicianId: null,
    },
    data: {
      assignmentMode: 'ASSIGNED',
      technicianId: user.id,
    },
  });

  if (result.count === 0) {
    response.status(409).json({
      code: 'REPAIR_ALREADY_ASSIGNED',
      message: 'Ремонт уже назначен другому сотруднику или не найден',
    });
    return;
  }

  const repair = await prisma.repair.findUniqueOrThrow({
    where: { id: parsedId.data },
    select: repairSelect,
  });
  response.json(mapRepair(repair));
});

repairsRouter.patch('/:id/status', allowRoles('MANAGER', 'TECHNICIAN'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  const parsedBody = repairStatusInputSchema.safeParse(request.body);
  const user = request.session.user;

  if (!parsedId.success || !parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }

  if (user?.role === 'TECHNICIAN') {
    if (!user.id) {
      response.status(403).json({
        code: 'FORBIDDEN',
        message: 'Не удалось определить сотрудника',
      });
      return;
    }

    const assignedRepair = await prisma.repair.findFirst({
      where: {
        id: parsedId.data,
        assignmentMode: 'ASSIGNED',
        technicianId: user.id,
      },
      select: { id: true },
    });

    if (!assignedRepair) {
      response.status(403).json({
        code: 'FORBIDDEN',
        message: 'Можно менять статус только назначенного вам ремонта',
      });
      return;
    }
  }

  try {
    const repair = await prisma.repair.update({
      where: { id: parsedId.data },
      data: { status: parsedBody.data.status },
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
