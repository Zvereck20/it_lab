import type { OrderStatus } from '@itlab/contracts';

export const orderStatusLabels: Record<OrderStatus, string> = {
  CREATED: 'Создан',
  DIAGNOSTICS: 'Диагностика',
  APPROVAL: 'Согласование',
  IN_PROGRESS: 'В работе',
  REVISION: 'Доработка',
  COMPLETED: 'Выполнен',
};

export const orderStatuses = Object.entries(orderStatusLabels) as Array<
  [OrderStatus, string]
>;
