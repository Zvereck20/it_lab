import type { CustomerType, RepairInput } from '@itlab/contracts';
import { repairInputSchema } from '@itlab/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';

import { useGetTechniciansQuery } from '../features/employees/api/employeesApi';
import { getApiErrorMessage } from '../features/inventory/getApiErrorMessage';
import {
  useCreateRepairMutation,
  useGetRepairQuery,
  useUpdateRepairMutation,
} from '../features/repairs/api/repairsApi';

const emptyRepair: RepairInput = {
  name: '',
  description: '',
  customerType: 'INDIVIDUAL',
  customerPhone: '',
  customerFirstName: '',
  customerLastName: '',
  customerMiddleName: '',
  companyName: '',
  inn: '',
  technicianId: null,
};

export const RepairFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { data: technicians, isLoading: areTechniciansLoading } = useGetTechniciansQuery();
  const {
    data: repair,
    isFetching: isRepairLoading,
    isError: isRepairError,
  } = useGetRepairQuery(id ?? '', { skip: !isEditing });
  const [createRepair, createState] = useCreateRepairMutation();
  const [updateRepair, updateState] = useUpdateRepairMutation();
  const [apiError, setApiError] = useState<string>();
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<RepairInput>({
    resolver: zodResolver(repairInputSchema),
    defaultValues: emptyRepair,
  });
  const customerType = watch('customerType');

  useEffect(() => {
    if (repair) {
      reset({
        name: repair.name,
        description: repair.description,
        customerType: repair.customerType,
        customerPhone: repair.customerPhone,
        customerFirstName: repair.customerFirstName,
        customerLastName: repair.customerLastName,
        customerMiddleName: repair.customerMiddleName,
        companyName: repair.companyName,
        inn: repair.inn,
        technicianId: repair.technicianId,
      });
    }
  }, [repair, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setApiError(undefined);

    try {
      if (id) {
        await updateRepair({ id, body: values }).unwrap();
        navigate(`/repairs/${id}`);
      } else {
        const createdRepair = await createRepair(values).unwrap();
        navigate(`/repairs/${createdRepair.id}`);
      }
    } catch (error) {
      setApiError(getApiErrorMessage(error, 'Не удалось сохранить ремонт'));
    }
  });

  if (areTechniciansLoading || (isEditing && isRepairLoading)) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 360 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isRepairError) {
    return <Alert severity="error">Не удалось загрузить ремонт</Alert>;
  }

  return (
    <Paper component="main" variant="outlined" sx={{ maxWidth: 820, mx: 'auto', p: 4 }}>
      <Stack component="form" spacing={3} onSubmit={onSubmit} noValidate>
        <Typography component="h1" variant="h4">
          {isEditing ? 'Редактирование ремонта' : 'Новый ремонт'}
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

        <Typography component="h2" variant="h5">
          Заказчик
        </Typography>

        <Controller
          name="customerType"
          control={control}
          render={({ field }) => (
            <FormControl>
              <FormLabel id="customer-type-label">Тип заказчика</FormLabel>
              <RadioGroup
                row
                aria-labelledby="customer-type-label"
                value={field.value}
                onChange={(_event, value) => field.onChange(value as CustomerType)}
              >
                <FormControlLabel value="INDIVIDUAL" control={<Radio />} label="Физ. лицо" />
                <FormControlLabel value="LEGAL_ENTITY" control={<Radio />} label="Юр. лицо" />
              </RadioGroup>
            </FormControl>
          )}
        />

        <TextField
          label="Телефон"
          error={Boolean(errors.customerPhone)}
          helperText={errors.customerPhone?.message}
          slotProps={{ htmlInput: { maxLength: 30, inputMode: 'tel' } }}
          {...register('customerPhone')}
        />

        {customerType === 'LEGAL_ENTITY' && (
          <>
            <TextField
              label="Название компании"
              error={Boolean(errors.companyName)}
              helperText={errors.companyName?.message}
              {...register('companyName')}
            />
            <TextField
              label="ИНН"
              error={Boolean(errors.inn)}
              helperText={errors.inn?.message}
              slotProps={{ htmlInput: { maxLength: 12, inputMode: 'numeric' } }}
              {...register('inn')}
            />
            <Typography component="h3" variant="h6">
              Контактное лицо
            </Typography>
          </>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          <TextField
            label="Фамилия"
            error={Boolean(errors.customerLastName)}
            helperText={errors.customerLastName?.message}
            {...register('customerLastName')}
          />
          <TextField
            label="Имя"
            error={Boolean(errors.customerFirstName)}
            helperText={errors.customerFirstName?.message}
            {...register('customerFirstName')}
          />
          <TextField
            label="Отчество (необязательно)"
            error={Boolean(errors.customerMiddleName)}
            helperText={errors.customerMiddleName?.message}
            {...register('customerMiddleName')}
          />
        </Box>

        <Controller
          name="technicianId"
          control={control}
          render={({ field }) => (
            <FormControl error={Boolean(errors.technicianId)}>
              <InputLabel id="repair-technician-label">Ответственный сотрудник</InputLabel>
              <Select
                labelId="repair-technician-label"
                label="Ответственный сотрудник"
                value={field.value ?? ''}
                onChange={(event) => field.onChange(event.target.value || null)}
              >
                <MenuItem value="">Свободная касса</MenuItem>
                {technicians?.employees.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />

        {!isEditing && (
          <Alert severity="info">
            Новый ремонт будет создан со статусом «Создан».
          </Alert>
        )}

        <Stack direction="row" spacing={2}>
          <Button
            type="submit"
            variant="contained"
            disabled={createState.isLoading || updateState.isLoading}
          >
            {createState.isLoading || updateState.isLoading ? 'Сохранение...' : 'Сохранить'}
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate(isEditing && id ? `/repairs/${id}` : '/repairs')}
          >
            Отмена
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
};
