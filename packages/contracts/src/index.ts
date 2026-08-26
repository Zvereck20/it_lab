import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const authRoleSchema = z.enum(['ADMIN', 'MANAGER', 'TECHNICIAN']);

export type AuthRole = z.infer<typeof authRoleSchema>;

export const authUserSchema = z.object({
  id: z.string().uuid().nullable(),
  login: z.string(),
  name: z.string(),
  role: authRoleSchema,
});

export type AuthUser = z.infer<typeof authUserSchema>;

export const loginRequestSchema = z.object({
  login: z
    .string()
    .min(1, 'Введите логин')
    .max(50, 'Логин не должен превышать 50 символов'),
  password: z
    .string()
    .min(1, 'Введите пароль')
    .max(128, 'Пароль не должен превышать 128 символов'),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const authResponseSchema = z.object({
  user: authUserSchema,
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
