import type { ApiError } from '@itlab/contracts';

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const apiError = error as { data?: Partial<ApiError> };
  return apiError.data?.message ?? fallback;
};
