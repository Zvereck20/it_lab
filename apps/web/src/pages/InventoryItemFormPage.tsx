import type { InventoryItemInput } from '@itlab/contracts';
import { inventoryItemInputSchema } from '@itlab/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';

import { CategoryAutocomplete } from '../components/CategoryAutocomplete';
import {
  useCreateInventoryItemMutation,
  useGetInventoryCategoriesQuery,
  useGetInventoryItemQuery,
  useUpdateInventoryItemMutation,
} from '../features/inventory/api/inventoryApi';
import { getApiErrorMessage } from '../features/inventory/getApiErrorMessage';

const emptyItem: InventoryItemInput = {
  name: '',
  description: '',
  count: 0,
  mainCategoryId: '',
  additionalCategoryId: '',
};

export const InventoryItemFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { data: categories, isLoading: areCategoriesLoading } =
    useGetInventoryCategoriesQuery();
  const {
    data: item,
    isFetching: isItemLoading,
    isError: isItemError,
  } = useGetInventoryItemQuery(id ?? '', { skip: !isEditing });
  const [createItem, createState] = useCreateInventoryItemMutation();
  const [updateItem, updateState] = useUpdateInventoryItemMutation();
  const [apiError, setApiError] = useState<string>();
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InventoryItemInput>({
    resolver: zodResolver(inventoryItemInputSchema),
    defaultValues: emptyItem,
  });

  const mainCategoryId = watch('mainCategoryId');
  const additionalCategoryId = watch('additionalCategoryId');
  const availableAdditionalCategories = useMemo(
    () => categories?.additionalCategories.filter((category) =>
      category.mainCategoryIds.includes(mainCategoryId)) ?? [],
    [categories, mainCategoryId],
  );

  useEffect(() => {
    if (item) {
      reset({
        name: item.name,
        description: item.description,
        count: item.count,
        mainCategoryId: item.mainCategoryId,
        additionalCategoryId: item.additionalCategoryId,
      });
    }
  }, [item, reset]);

  useEffect(() => {
    if (
      categories
      && additionalCategoryId
      && !availableAdditionalCategories.some((category) => category.id === additionalCategoryId)
    ) {
      setValue('additionalCategoryId', '');
    }
  }, [
    additionalCategoryId,
    availableAdditionalCategories,
    categories,
    setValue,
  ]);

  const onSubmit = handleSubmit(async (values) => {
    setApiError(undefined);

    try {
      if (id) {
        await updateItem({ id, body: values }).unwrap();
      } else {
        await createItem(values).unwrap();
      }
      navigate('/warehouse');
    } catch (error) {
      setApiError(getApiErrorMessage(error, 'Не удалось сохранить складскую позицию'));
    }
  });

  if (areCategoriesLoading || (isEditing && isItemLoading)) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 360 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isItemError) {
    return <Alert severity="error">Не удалось загрузить складскую позицию</Alert>;
  }

  return (
    <Paper component="main" variant="outlined" sx={{ maxWidth: 760, mx: 'auto', p: 4 }}>
      <Stack component="form" spacing={3} onSubmit={onSubmit} noValidate>
        <Typography component="h1" variant="h4">
          {isEditing ? 'Редактирование позиции' : 'Новая позиция'}
        </Typography>

        {apiError && <Alert severity="error">{apiError}</Alert>}

        <TextField
          label="Наименование"
          error={Boolean(errors.name)}
          helperText={errors.name?.message}
          {...register('name')}
        />

        <TextField
          label="Описание"
          multiline
          minRows={4}
          error={Boolean(errors.description)}
          helperText={errors.description?.message}
          {...register('description')}
        />

        <TextField
          label="Количество"
          type="number"
          error={Boolean(errors.count)}
          helperText={errors.count?.message}
          slotProps={{ htmlInput: { min: 0, step: 1 } }}
          {...register('count', { valueAsNumber: true })}
        />

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
          name="additionalCategoryId"
          control={control}
          render={({ field }) => (
            <CategoryAutocomplete
              label="Доп. категория"
              options={availableAdditionalCategories}
              value={field.value}
              onChange={field.onChange}
              disabled={!mainCategoryId}
              error={Boolean(errors.additionalCategoryId)}
              helperText={errors.additionalCategoryId?.message}
            />
          )}
        />

        {!categories?.mainCategories.length && (
          <Alert severity="warning">
            Сначала ADMIN должен создать хотя бы одну основную категорию.
          </Alert>
        )}

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
          <Button variant="outlined" onClick={() => navigate('/warehouse')}>
            Отмена
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
};
