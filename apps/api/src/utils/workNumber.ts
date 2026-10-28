export type WorkNumberType = 'ORDER' | 'REPAIR';

const formatNumber = (prefix: string, number: number) =>
  `${prefix}-${number.toString().padStart(6, '0')}`;

export const formatOrderNumber = (number: number) => formatNumber('З', number);

export const formatRepairNumber = (number: number) => formatNumber('Р', number);

export const parseWorkNumberSearch = (search: string | undefined) => {
  const normalized = search?.trim().toLocaleUpperCase('ru-RU');

  if (!normalized) {
    return { number: undefined, type: undefined };
  }

  const match = normalized.match(/^([ЗР])?\s*-?\s*0*(\d+)$/u);
  if (!match) {
    return null;
  }

  const number = Number(match[2]);
  if (!Number.isSafeInteger(number) || number < 1) {
    return null;
  }

  const type: WorkNumberType | undefined = match[1] === 'З'
    ? 'ORDER'
    : match[1] === 'Р'
      ? 'REPAIR'
      : undefined;

  return { number, type };
};
