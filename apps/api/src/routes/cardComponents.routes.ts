import type { AuthUser } from '@itlab/contracts';
import type { Prisma } from '../generated/prisma/client.js';
import { z } from 'zod';
import { Router } from 'express';

import { prisma } from '../db/prisma.js';
import { allowRoles } from '../middlewares/allowRoles.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const paramsSchema = z.object({ type: z.enum(['order', 'repair']), id: z.string().uuid() });
const componentParamsSchema = paramsSchema.extend({ componentId: z.string().uuid() });
const addSchema = z.object({ inventoryItemId: z.string().uuid(), quantity: z.number().int().positive() });
const quantitySchema = z.object({ quantity: z.number().int().positive() });
type Target = z.infer<typeof paramsSchema>;

class CardError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

const actor = (user: AuthUser) => ({ performedById: user.id ?? 'ADMIN', performedByName: user.name });
const targetRef = (target: Target) => target.type === 'order'
  ? { orderId: target.id } : { repairId: target.id };
const movementType = (target: Target, returning: boolean) => target.type === 'order'
  ? returning ? 'ORDER_RETURN' as const : 'ORDER_ALLOCATION' as const
  : returning ? 'REPAIR_RETURN' as const : 'REPAIR_ALLOCATION' as const;

const assertWritable = async (tx: Prisma.TransactionClient, target: Target, user: AuthUser) => {
  const record = target.type === 'order'
    ? await tx.order.findUnique({ where: { id: target.id }, select: { status: true, assignmentMode: true, technicianId: true } })
    : await tx.repair.findUnique({ where: { id: target.id }, select: { status: true, assignmentMode: true, technicianId: true } });
  if (!record) throw new CardError(404, 'NOT_FOUND', 'Карточка не найдена');
  if (record.status === 'COMPLETED') throw new CardError(409, 'COMPLETED', 'Выполненная карточка заблокирована');
  if (user.role !== 'ADMIN' && (record.assignmentMode !== 'ASSIGNED' || record.technicianId !== user.id)) {
    throw new CardError(403, 'FORBIDDEN', 'Работать с компонентами может только назначенный специалист');
  }
};

export const cardComponentsRouter = Router();
cardComponentsRouter.use(requireAuth);

cardComponentsRouter.get('/:type/:id', async (request, response) => {
  const parsed = paramsSchema.safeParse(request.params);
  if (!parsed.success) { response.status(400).json({ code: 'VALIDATION_ERROR', message: 'Некорректная карточка' }); return; }
  const target = parsed.data;
  const user = request.session.user!;
  const record = target.type === 'order'
    ? await prisma.order.findUnique({ where: { id: target.id }, select: { assignmentMode: true, technicianId: true } })
    : await prisma.repair.findUnique({ where: { id: target.id }, select: { assignmentMode: true, technicianId: true } });
  if (!record || (user.role === 'TECHNICIAN' && record.technicianId !== user.id && record.assignmentMode !== 'FREE_QUEUE')) {
    response.status(404).json({ code: 'NOT_FOUND', message: 'Карточка не найдена' }); return;
  }
  const components = target.type === 'order'
    ? await prisma.orderComponent.findMany({ where: { orderId: target.id }, orderBy: { createdAt: 'desc' } })
    : await prisma.repairComponent.findMany({ where: { repairId: target.id }, orderBy: { createdAt: 'desc' } });
  const movements = await prisma.inventoryMovement.findMany({
    where: { ...targetRef(target), inventoryItemId: { in: components.map(c => c.inventoryItemId) }, operationType: movementType(target, false) },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { inventoryItemId: true, performedById: true, performedByName: true, createdAt: true },
  });
  response.json({ items: components.map(c => ({
    id: c.id, inventoryItemId: c.inventoryItemId, name: c.nameSnapshot,
    quantity: c.quantity,
    addedById: movements.find(m => m.inventoryItemId === c.inventoryItemId && m.createdAt >= c.createdAt)?.performedById ?? null,
    addedByName: movements.find(m => m.inventoryItemId === c.inventoryItemId && m.createdAt >= c.createdAt)?.performedByName ?? 'Неизвестно',
    addedAt: c.createdAt,
  })) });
});

cardComponentsRouter.post('/:type/:id', allowRoles('TECHNICIAN'), async (request, response) => {
  const parsed = paramsSchema.safeParse(request.params);
  const body = addSchema.safeParse(request.body);
  if (!parsed.success || !body.success) { response.status(400).json({ code: 'VALIDATION_ERROR', message: 'Проверьте компонент и количество' }); return; }
  const target = parsed.data;
  try {
    await prisma.$transaction(async tx => {
      await assertWritable(tx, target, request.session.user!);
      const stock = await tx.inventoryItem.findUnique({ where: { id: body.data.inventoryItemId }, select: { name: true } });
      if (!stock) throw new CardError(404, 'NOT_FOUND', 'Компонент не найден');
      const existing = target.type === 'order'
        ? await tx.orderComponent.findUnique({ where: { orderId_inventoryItemId: { orderId: target.id, inventoryItemId: body.data.inventoryItemId } } })
        : await tx.repairComponent.findUnique({ where: { repairId_inventoryItemId: { repairId: target.id, inventoryItemId: body.data.inventoryItemId } } });
      if (existing) throw new CardError(409, 'COMPONENT_EXISTS', 'Компонент уже добавлен');
      const changed = await tx.inventoryItem.updateMany({ where: { id: body.data.inventoryItemId, count: { gte: body.data.quantity } }, data: { count: { decrement: body.data.quantity } } });
      if (!changed.count) throw new CardError(409, 'INSUFFICIENT_STOCK', 'Недостаточно компонентов на складе');
      const data = { inventoryItemId: body.data.inventoryItemId, nameSnapshot: stock.name, quantity: body.data.quantity };
      if (target.type === 'order') await tx.orderComponent.create({ data: { ...data, orderId: target.id } });
      else await tx.repairComponent.create({ data: { ...data, repairId: target.id } });
      await tx.inventoryMovement.create({ data: { inventoryItemId: body.data.inventoryItemId, operationType: movementType(target, false), quantityDelta: -body.data.quantity, ...targetRef(target), ...actor(request.session.user!) } });
    }, { isolationLevel: 'Serializable' });
    response.status(201).json({ ok: true });
  } catch (error) { handleError(error, response); }
});

cardComponentsRouter.patch('/:type/:id/:componentId', allowRoles('TECHNICIAN'), async (request, response) => {
  const parsed = componentParamsSchema.safeParse(request.params);
  const body = quantitySchema.safeParse(request.body);
  if (!parsed.success || !body.success) { response.status(400).json({ code: 'VALIDATION_ERROR', message: 'Некорректное количество' }); return; }
  const target = parsed.data;
  try {
    await prisma.$transaction(async tx => {
      await assertWritable(tx, target, request.session.user!);
      const component = target.type === 'order'
        ? await tx.orderComponent.findFirst({ where: { id: target.componentId, orderId: target.id } })
        : await tx.repairComponent.findFirst({ where: { id: target.componentId, repairId: target.id } });
      if (!component) throw new CardError(404, 'NOT_FOUND', 'Компонент не найден');
      const delta = body.data.quantity - component.quantity;
      if (!delta) return;
      if (delta > 0) {
        const changed = await tx.inventoryItem.updateMany({ where: { id: component.inventoryItemId, count: { gte: delta } }, data: { count: { decrement: delta } } });
        if (!changed.count) throw new CardError(409, 'INSUFFICIENT_STOCK', 'Недостаточно компонентов на складе');
      } else await tx.inventoryItem.update({ where: { id: component.inventoryItemId }, data: { count: { increment: -delta } } });
      if (target.type === 'order') await tx.orderComponent.update({ where: { id: component.id }, data: { quantity: body.data.quantity } });
      else await tx.repairComponent.update({ where: { id: component.id }, data: { quantity: body.data.quantity } });
      await tx.inventoryMovement.create({ data: { inventoryItemId: component.inventoryItemId, operationType: movementType(target, delta < 0), quantityDelta: -delta, ...targetRef(target), ...actor(request.session.user!) } });
    }, { isolationLevel: 'Serializable' });
    response.json({ ok: true });
  } catch (error) { handleError(error, response); }
});

cardComponentsRouter.delete('/:type/:id/:componentId', allowRoles('TECHNICIAN'), async (request, response) => {
  const parsed = componentParamsSchema.safeParse(request.params);
  if (!parsed.success) { response.status(400).json({ code: 'VALIDATION_ERROR', message: 'Некорректный компонент' }); return; }
  const target = parsed.data;
  try {
    await prisma.$transaction(async tx => {
      await assertWritable(tx, target, request.session.user!);
      const component = target.type === 'order'
        ? await tx.orderComponent.findFirst({ where: { id: target.componentId, orderId: target.id } })
        : await tx.repairComponent.findFirst({ where: { id: target.componentId, repairId: target.id } });
      if (!component) throw new CardError(404, 'NOT_FOUND', 'Компонент не найден');
      if (target.type === 'order') await tx.orderComponent.delete({ where: { id: component.id } });
      else await tx.repairComponent.delete({ where: { id: component.id } });
      await tx.inventoryItem.update({ where: { id: component.inventoryItemId }, data: { count: { increment: component.quantity } } });
      await tx.inventoryMovement.create({ data: { inventoryItemId: component.inventoryItemId, operationType: movementType(target, true), quantityDelta: component.quantity, ...targetRef(target), ...actor(request.session.user!) } });
    }, { isolationLevel: 'Serializable' });
    response.status(204).end();
  } catch (error) { handleError(error, response); }
});

function handleError(error: unknown, response: import('express').Response) {
  if (error instanceof CardError) { response.status(error.status).json({ code: error.code, message: error.message }); return; }
  if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
    response.status(409).json({ code: 'COMPONENT_EXISTS', message: 'Компонент уже добавлен' }); return;
  }
  if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') {
    response.status(409).json({ code: 'CONFLICT', message: 'Данные изменились, повторите действие' }); return;
  }
  throw error;
}
