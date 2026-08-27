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

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, 'Введите название категории')
  .max(100, 'Название не должно превышать 100 символов');

export const mainCategoryInputSchema = z.object({
  name: categoryNameSchema,
});

export type MainCategoryInput = z.infer<typeof mainCategoryInputSchema>;

export const additionalCategoryInputSchema = z.object({
  name: categoryNameSchema,
  mainCategoryIds: z
    .array(z.string().uuid())
    .min(1, 'Выберите хотя бы одну основную категорию'),
});

export type AdditionalCategoryInput = z.infer<typeof additionalCategoryInputSchema>;

export const mainCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

export type MainCategory = z.infer<typeof mainCategorySchema>;

export const additionalCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  mainCategoryIds: z.array(z.string().uuid()),
});

export type AdditionalCategory = z.infer<typeof additionalCategorySchema>;

export const inventoryCategoriesResponseSchema = z.object({
  mainCategories: z.array(mainCategorySchema),
  additionalCategories: z.array(additionalCategorySchema),
});

export type InventoryCategoriesResponse = z.infer<typeof inventoryCategoriesResponseSchema>;

export const inventoryItemInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Введите наименование')
    .max(150, 'Наименование не должно превышать 150 символов'),
  description: z
    .string()
    .trim()
    .max(2_000, 'Описание не должно превышать 2000 символов'),
  count: z
    .number({ error: 'Укажите количество' })
    .int('Количество должно быть целым числом')
    .min(0, 'Количество не может быть отрицательным'),
  mainCategoryId: z.string().uuid('Выберите основную категорию'),
  additionalCategoryId: z.string().uuid().nullable(),
});

export type InventoryItemInput = z.infer<typeof inventoryItemInputSchema>;

export const inventoryItemSchema = inventoryItemInputSchema.extend({
  id: z.string().uuid(),
  mainCategory: mainCategorySchema,
  additionalCategory: mainCategorySchema.nullable(),
});

export type InventoryItem = z.infer<typeof inventoryItemSchema>;

export const inventoryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().max(200).optional(),
  mainCategoryId: z.string().uuid().optional(),
  additionalCategoryId: z.string().uuid().optional(),
});

export type InventoryListQuery = z.infer<typeof inventoryListQuerySchema>;

export const inventoryListResponseSchema = z.object({
  items: z.array(inventoryItemSchema),
  pagination: z.object({
    page: z.number().int(),
    limit: z.literal(50),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export type InventoryListResponse = z.infer<typeof inventoryListResponseSchema>;
