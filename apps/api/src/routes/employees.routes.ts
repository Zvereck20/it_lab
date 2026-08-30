import {
  employeeCreateInputSchema,
  employeeUpdateInputSchema,
} from '@itlab/contracts';
import argon2 from 'argon2';
import { Router } from 'express';
import { z } from 'zod';

import { ADMIN_LOGIN } from '../config/auth.js';
import { prisma } from '../db/prisma.js';
import { allowRoles } from '../middlewares/allowRoles.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const idSchema = z.string().uuid();

const employeeSelect = {
  id: true,
  login: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

const isPrismaError = (error: unknown, code: string) =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === code);

const validationError = (message = 'Проверьте введённые данные') => ({
  code: 'VALIDATION_ERROR',
  message,
});

const loginConflict = {
  code: 'LOGIN_EXISTS',
  message: 'Сотрудник с таким логином уже существует',
};

const employeeInUse = {
  code: 'EMPLOYEE_IN_USE',
  message: 'Сотрудник назначен на ремонт. Сначала переназначьте связанные ремонты',
};

export const employeesRouter = Router();

employeesRouter.use(requireAuth);

employeesRouter.get('/technicians', async (_request, response) => {
  const employees = await prisma.user.findMany({
    where: { role: 'TECHNICIAN', isActive: true },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: employeeSelect,
  });

  response.json({ employees });
});

employeesRouter.get('/', allowRoles('ADMIN'), async (_request, response) => {
  const employees = await prisma.user.findMany({
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: employeeSelect,
  });

  response.json({ employees });
});

employeesRouter.post('/', allowRoles('ADMIN'), async (request, response) => {
  const parsedBody = employeeCreateInputSchema.safeParse(request.body);

  if (!parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }

  if (parsedBody.data.login === ADMIN_LOGIN) {
    response.status(409).json(loginConflict);
    return;
  }

  try {
    const employee = await prisma.user.create({
      data: {
        login: parsedBody.data.login,
        name: parsedBody.data.name,
        role: parsedBody.data.role,
        passwordHash: await argon2.hash(parsedBody.data.password),
      },
      select: employeeSelect,
    });

    response.status(201).json(employee);
  } catch (error) {
    if (isPrismaError(error, 'P2002')) {
      response.status(409).json(loginConflict);
      return;
    }
    throw error;
  }
});

employeesRouter.patch('/:id', allowRoles('ADMIN'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  const parsedBody = employeeUpdateInputSchema.safeParse(request.body);

  if (!parsedId.success || !parsedBody.success) {
    response.status(400).json(validationError());
    return;
  }

  if (parsedBody.data.login === ADMIN_LOGIN) {
    response.status(409).json(loginConflict);
    return;
  }

  if (parsedBody.data.role !== 'TECHNICIAN') {
    const assignedRepairs = await prisma.repair.count({
      where: { technicianId: parsedId.data },
    });

    if (assignedRepairs > 0) {
      response.status(409).json(employeeInUse);
      return;
    }
  }

  try {
    const employee = await prisma.user.update({
      where: { id: parsedId.data },
      data: {
        login: parsedBody.data.login,
        name: parsedBody.data.name,
        role: parsedBody.data.role,
        ...(parsedBody.data.password
          ? { passwordHash: await argon2.hash(parsedBody.data.password) }
          : {}),
      },
      select: employeeSelect,
    });

    response.json(employee);
  } catch (error) {
    if (isPrismaError(error, 'P2002')) {
      response.status(409).json(loginConflict);
      return;
    }
    if (isPrismaError(error, 'P2025')) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Сотрудник не найден' });
      return;
    }
    throw error;
  }
});

employeesRouter.delete('/:id', allowRoles('ADMIN'), async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);

  if (!parsedId.success) {
    response.status(400).json(validationError());
    return;
  }

  const assignedRepairs = await prisma.repair.count({
    where: { technicianId: parsedId.data },
  });

  if (assignedRepairs > 0) {
    response.status(409).json(employeeInUse);
    return;
  }

  try {
    await prisma.user.delete({ where: { id: parsedId.data } });
    response.status(204).end();
  } catch (error) {
    if (isPrismaError(error, 'P2025')) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Сотрудник не найден' });
      return;
    }
    if (isPrismaError(error, 'P2003')) {
      response.status(409).json(employeeInUse);
      return;
    }
    throw error;
  }
});
