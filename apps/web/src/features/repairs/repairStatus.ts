import type { RepairStatus } from '@itlab/contracts';

export const repairStatusLabels: Record<RepairStatus, string> = {
  CREATED: 'Создан',
  DIAGNOSTICS: 'Диагностика',
  APPROVAL: 'Согласование',
  IN_PROGRESS: 'В работе',
  REVISION: 'Доработка',
  COMPLETED: 'Выполнен',
};

export const repairStatuses = Object.entries(repairStatusLabels) as [
  RepairStatus,
  string,
][];
