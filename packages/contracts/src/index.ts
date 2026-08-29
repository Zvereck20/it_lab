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
  additionalCategoryIds: z
    .array(z.string().uuid())
    .min(1, 'Выберите хотя бы одну дополнительную категорию')
    .refine(
      (items) => new Set(items).size === items.length,
      'Дополнительные категории не должны повторяться',
    ),
});

export type InventoryItemInput = z.infer<typeof inventoryItemInputSchema>;

export const inventoryItemSchema = inventoryItemInputSchema.extend({
  id: z.string().uuid(),
  mainCategory: mainCategorySchema,
  additionalCategories: z.array(mainCategorySchema),
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

export const employeeRoleSchema = z.enum(['MANAGER', 'TECHNICIAN']);

export type EmployeeRole = z.infer<typeof employeeRoleSchema>;

const employeeLoginSchema = z
  .string()
  .trim()
  .min(1, 'Введите логин')
  .max(50, 'Логин не должен превышать 50 символов')
  .regex(/^[A-Za-z0-9._-]+$/, 'Используйте латинские буквы, цифры, точку, дефис или _');

const employeeNameSchema = z
  .string()
  .trim()
  .min(1, 'Введите имя сотрудника')
  .max(100, 'Имя не должно превышать 100 символов');

const employeePasswordSchema = z
  .string()
  .min(8, 'Пароль должен содержать не менее 8 символов')
  .max(128, 'Пароль не должен превышать 128 символов');

export const employeeCreateInputSchema = z.object({
  login: employeeLoginSchema,
  name: employeeNameSchema,
  password: employeePasswordSchema,
  role: employeeRoleSchema,
});

export type EmployeeCreateInput = z.infer<typeof employeeCreateInputSchema>;

export const employeeUpdateInputSchema = z.object({
  login: employeeLoginSchema,
  name: employeeNameSchema,
  password: employeePasswordSchema.optional(),
  role: employeeRoleSchema,
});

export type EmployeeUpdateInput = z.infer<typeof employeeUpdateInputSchema>;

export const employeeSchema = z.object({
  id: z.string().uuid(),
  login: z.string(),
  name: z.string(),
  role: employeeRoleSchema,
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
});

export type Employee = z.infer<typeof employeeSchema>;

export const employeesResponseSchema = z.object({
  employees: z.array(employeeSchema),
});

export type EmployeesResponse = z.infer<typeof employeesResponseSchema>;

export const repairStatusSchema = z.enum([
  'CREATED',
  'DIAGNOSTICS',
  'APPROVAL',
  'IN_PROGRESS',
  'REVISION',
  'COMPLETED',
]);

export type RepairStatus = z.infer<typeof repairStatusSchema>;

export const customerTypeSchema = z.enum(['INDIVIDUAL', 'LEGAL_ENTITY']);

export type CustomerType = z.infer<typeof customerTypeSchema>;

export const repairAssignmentModeSchema = z.enum(['FREE_QUEUE', 'ASSIGNED']);

export type RepairAssignmentMode = z.infer<typeof repairAssignmentModeSchema>;

const customerNameSchema = z
  .string()
  .trim()
  .max(100, 'Значение не должно превышать 100 символов');

const repairBaseInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Введите наименование ремонта')
    .max(150, 'Наименование не должно превышать 150 символов'),
  description: z
    .string()
    .trim()
    .max(2_000, 'Описание не должно превышать 2000 символов'),
  customerType: customerTypeSchema,
  customerPhone: z
    .string()
    .trim()
    .min(5, 'Введите телефон заказчика')
    .max(30, 'Телефон не должен превышать 30 символов'),
  customerFirstName: customerNameSchema,
  customerLastName: customerNameSchema,
  customerMiddleName: customerNameSchema,
  companyName: z.string().trim().max(150, 'Название не должно превышать 150 символов'),
  inn: z.string().trim(),
  technicianId: z.string().uuid('Выберите сотрудника').nullable(),
});

export const repairInputSchema = repairBaseInputSchema.superRefine((value, context) => {
  if (!value.customerFirstName) {
    context.addIssue({
      code: 'custom',
      path: ['customerFirstName'],
      message: 'Введите имя',
    });
  }

  if (!value.customerLastName) {
    context.addIssue({
      code: 'custom',
      path: ['customerLastName'],
      message: 'Введите фамилию',
    });
  }

  if (value.customerType === 'LEGAL_ENTITY') {
    if (!value.companyName) {
      context.addIssue({
        code: 'custom',
        path: ['companyName'],
        message: 'Введите название компании',
      });
    }

    if (!/^\d{10}(\d{2})?$/.test(value.inn)) {
      context.addIssue({
        code: 'custom',
        path: ['inn'],
        message: 'ИНН должен содержать 10 или 12 цифр',
      });
    }
  }
});

export type RepairInput = z.infer<typeof repairInputSchema>;

const repairTechnicianSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  login: z.string(),
});

export const repairSchema = repairBaseInputSchema.extend({
  id: z.string().uuid(),
  status: repairStatusSchema,
  assignmentMode: repairAssignmentModeSchema,
  technician: repairTechnicianSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Repair = z.infer<typeof repairSchema>;

export const repairStatusInputSchema = z.object({
  status: repairStatusSchema,
});

export type RepairStatusInput = z.infer<typeof repairStatusInputSchema>;

export const repairListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().max(200).optional(),
  technicianId: z.union([z.string().uuid(), z.literal('free_queue')]).optional(),
  status: repairStatusSchema.optional(),
});

export type RepairListQuery = z.infer<typeof repairListQuerySchema>;

export const repairListResponseSchema = z.object({
  items: z.array(repairSchema),
  pagination: z.object({
    page: z.number().int(),
    limit: z.literal(50),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export type RepairListResponse = z.infer<typeof repairListResponseSchema>;
