import type { OrderInput } from '@itlab/contracts';
import { orderInputSchema } from '@itlab/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';

import {
  CategoryAutocomplete,
  MultipleCategoryAutocomplete,
} from '../components/CategoryAutocomplete';
import { PhoneField } from '../components/PhoneField';
import { useGetTechniciansQuery } from '../features/employees/api/employeesApi';
import { getApiErrorMessage } from '../features/inventory/getApiErrorMessage';
import {
  useCreateOrderMutation,
  useGetOrderCategoriesQuery,
  useGetOrderQuery,
  useUpdateOrderMutation,
} from '../features/orders/api/ordersApi';

const emptyOrder: OrderInput = {
  name: '',
  description: '',
  companyName: '',
  inn: '',
  customerPhone: '',
  contactFirstName: '',
  contactLastName: '',
  contactMiddleName: '',
  mainCategoryId: '',
  additionalCategoryIds: [],
  technicianId: null,
};

const sanitizePersonName = (value: string) =>
  value.replace(/[^\p{L} '\-]/gu, '').slice(0, 100);

export const OrderFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { data: technicians, isLoading: areTechniciansLoading } = useGetTechniciansQuery();
  const { data: categories, isLoading: areCategoriesLoading } = useGetOrderCategoriesQuery();
  const {
    data: order,
    isFetching: isOrderLoading,
    isError: isOrderError,
  } = useGetOrderQuery(id ?? '', { skip: !isEditing });
  const [createOrder, createState] = useCreateOrderMutation();
  const [updateOrder, updateState] = useUpdateOrderMutation();
  const [apiError, setApiError] = useState<string>();
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OrderInput>({
    resolver: zodResolver(orderInputSchema),
    defaultValues: emptyOrder,
  });
  const mainCategoryId = watch('mainCategoryId');
  const additionalCategoryIds = watch('additionalCategoryIds');
  const availableAdditionalCategories = useMemo(
    () => categories?.additionalCategories.filter((category) =>
      category.mainCategoryIds.includes(mainCategoryId)) ?? [],
    [categories, mainCategoryId],
  );

  useEffect(() => {
    if (order) {
      reset({
        name: order.name,
        description: order.description,
        companyName: order.companyName,
        inn: order.inn,
        customerPhone: order.customerPhone,
        contactFirstName: order.contactFirstName,
        contactLastName: order.contactLastName,
        contactMiddleName: order.contactMiddleName,
        mainCategoryId: order.mainCategoryId,
        additionalCategoryIds: order.additionalCategoryIds,
        technicianId: order.technicianId,
      });
    }
  }, [order, reset]);

  useEffect(() => {
    if (
      categories
      && additionalCategoryIds.some((categoryId) =>
        !availableAdditionalCategories.some((category) => category.id === categoryId))
    ) {
      setValue(
        'additionalCategoryIds',
        additionalCategoryIds.filter((categoryId) =>
          availableAdditionalCategories.some((category) => category.id === categoryId)),
      );
    }
  }, [additionalCategoryIds, availableAdditionalCategories, categories, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setApiError(undefined);
    try {
      if (id) {
        await updateOrder({ id, body: values }).unwrap();
        navigate(`/orders/${id}`);
      } else {
        const createdOrder = await createOrder(values).unwrap();
        navigate(`/orders/${createdOrder.id}`);
      }
    } catch (error) {
      setApiError(getApiErrorMessage(error, 'Не удалось сохранить заказ'));
    }
  });

  if (areTechniciansLoading || areCategoriesLoading || (isEditing && isOrderLoading)) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 360 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isOrderError) return <Alert severity="error">Не удалось загрузить заказ</Alert>;

  return (
    <Paper component="main" variant="outlined" sx={{ maxWidth: 820, mx: 'auto', p: 4 }}>
      <Stack component="form" spacing={3} onSubmit={onSubmit} noValidate>
        <Typography component="h1" variant="h4">
          {isEditing ? 'Редактирование заказа' : 'Новый заказ'}
        </Typography>
        {apiError && <Alert severity="error">{apiError}</Alert>}

        <TextField
          label="Наименование"
          error={Boolean(errors.name)}
          helperText={errors.name?.message}
          slotProps={{ htmlInput: { maxLength: 150 } }}
          {...register('name')}
        />
        <TextField
          label="Описание"
          multiline
          minRows={4}
          error={Boolean(errors.description)}
          helperText={errors.description?.message}
          slotProps={{ htmlInput: { maxLength: 2_000 } }}
          {...register('description')}
        />

        <Typography component="h2" variant="h5">Категории</Typography>
        <Controller
          name="mainCategoryId"
          control={control}
          render={({ field }) => (
            <CategoryAutocomplete
              label="Основная категория"
              options={categories?.mainCategories ?? []}
              value={field.value}
              onChange={field.onChange}
              error={Boolean(errors.mainCategoryId)}
              helperText={errors.mainCategoryId?.message}
            />
          )}
        />
        <Controller
          name="additionalCategoryIds"
          control={control}
          render={({ field }) => (
            <MultipleCategoryAutocomplete
              label="Дополнительные категории"
              options={availableAdditionalCategories}
              value={field.value}
              onChange={field.onChange}
              disabled={!mainCategoryId}
              error={Boolean(errors.additionalCategoryIds)}
              helperText={errors.additionalCategoryIds?.message}
            />
          )}
        />

        <Typography component="h2" variant="h5">Заказчик</Typography>
        <TextField
          label="Название компании"
          error={Boolean(errors.companyName)}
          helperText={errors.companyName?.message}
          slotProps={{ htmlInput: { maxLength: 150 } }}
          {...register('companyName')}
        />
        <Controller
          name="inn"
          control={control}
          render={({ field }) => (
            <TextField
              label="ИНН"
              value={field.value}
              onChange={(event) => field.onChange(
                event.target.value.replace(/\D/g, '').slice(0, 12),
              )}
              onBlur={field.onBlur}
              name={field.name}
              error={Boolean(errors.inn)}
              helperText={errors.inn?.message}
              slotProps={{ htmlInput: { maxLength: 12, inputMode: 'numeric' } }}
            />
          )}
        />

        <Typography component="h3" variant="h6">Контактное лицо</Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          {([
            ['contactLastName', 'Фамилия'],
            ['contactFirstName', 'Имя'],
            ['contactMiddleName', 'Отчество (необязательно)'],
          ] as const).map(([fieldName, label]) => (
            <Controller
              key={fieldName}
              name={fieldName}
              control={control}
              render={({ field }) => (
                <TextField
                  label={label}
                  value={field.value}
                  onChange={(event) => field.onChange(sanitizePersonName(event.target.value))}
                  onBlur={field.onBlur}
                  name={field.name}
                  error={Boolean(errors[fieldName])}
                  helperText={errors[fieldName]?.message}
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                />
              )}
            />
          ))}
        </Box>

        <Controller
          name="customerPhone"
          control={control}
          render={({ field }) => (
            <PhoneField
              label="Телефон заказчика"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              error={Boolean(errors.customerPhone)}
              helperText={errors.customerPhone?.message}
            />
          )}
        />

        <Controller
          name="technicianId"
          control={control}
          render={({ field }) => (
            <FormControl error={Boolean(errors.technicianId)}>
              <InputLabel id="order-technician-label">Ответственный сотрудник</InputLabel>
              <Select
                labelId="order-technician-label"
                label="Ответственный сотрудник"
                value={field.value ?? 'FREE_QUEUE'}
                onChange={(event) => field.onChange(
                  event.target.value === 'FREE_QUEUE' ? null : event.target.value,
                )}
              >
                <MenuItem value="FREE_QUEUE">Свободная касса</MenuItem>
                {technicians?.employees.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>{employee.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />

        {!categories?.mainCategories.length && (
          <Alert severity="warning">Сначала ADMIN должен создать категории заказов.</Alert>
        )}
        {!isEditing && <Alert severity="info">Новый заказ будет создан со статусом «Создан».</Alert>}

        <Stack direction="row" spacing={2}>
          <Button
            type="submit"
            variant="contained"
            disabled={
              createState.isLoading
              || updateState.isLoading
              || !categories?.mainCategories.length
            }
          >
            {createState.isLoading || updateState.isLoading ? 'Сохранение...' : 'Сохранить'}
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate(isEditing && id ? `/orders/${id}` : '/orders')}
          >
            Отмена
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
};
