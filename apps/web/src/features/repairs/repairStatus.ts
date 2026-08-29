import type { RepairStatus } from '@itlab/contracts';

export const repairStatusLabels: Record<RepairStatus, string> = {
  CREATED: 'Создан',
  IN_PROGRESS: 'В работе',
  REVIEW: 'Проверка',
  REVISION: 'Доработка',
  COMPLETED: 'Выполнен',
};

export const repairStatuses = Object.entries(repairStatusLabels) as [
  RepairStatus,
  string,
][];
