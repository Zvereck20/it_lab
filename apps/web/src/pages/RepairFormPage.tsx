import type { RepairInput } from '@itlab/contracts';
import { repairInputSchema } from '@itlab/contracts';
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
  technicianId: null,
  dueDate: '',
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
    formState: { errors },
  } = useForm<RepairInput>({
    resolver: zodResolver(repairInputSchema),
    defaultValues: emptyRepair,
  });

  useEffect(() => {
    if (repair) {
      reset({
        name: repair.name,
        description: repair.description,
        technicianId: repair.technicianId,
        dueDate: repair.dueDate,
      });
    }
  }, [repair, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setApiError(undefined);

    try {
      if (id) {
        await updateRepair({ id, body: values }).unwrap();
      } else {
        await createRepair(values).unwrap();
      }
      navigate('/repairs');
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
    <Paper component="main" variant="outlined" sx={{ maxWidth: 760, mx: 'auto', p: 4 }}>
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
                <MenuItem value="">Сотрудник не выбран</MenuItem>
                {technicians?.employees.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />

        <TextField
          label="Плановый срок ремонта"
          type="date"
          error={Boolean(errors.dueDate)}
          helperText={errors.dueDate?.message}
          slotProps={{ inputLabel: { shrink: true } }}
          {...register('dueDate')}
        />

        <Alert severity="info">
          Новый ремонт будет создан со статусом «Создан».
        </Alert>

        <Stack direction="row" spacing={2}>
          <Button
            type="submit"
            variant="contained"
            disabled={createState.isLoading || updateState.isLoading}
          >
            {createState.isLoading || updateState.isLoading ? 'Сохранение...' : 'Сохранить'}
          </Button>
          <Button variant="outlined" onClick={() => navigate('/repairs')}>
            Отмена
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
};
