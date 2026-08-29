import type {
  Employee,
  EmployeeCreateInput,
  EmployeeRole,
  EmployeeUpdateInput,
} from '@itlab/contracts';
import {
  employeeCreateInputSchema,
  employeeUpdateInputSchema,
} from '@itlab/contracts';
import {
  Alert,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { FormEvent } from 'react';
import { useState } from 'react';

import {
  useCreateEmployeeMutation,
  useDeleteEmployeeMutation,
  useGetEmployeesQuery,
  useUpdateEmployeeMutation,
} from '../features/employees/api/employeesApi';
import { getApiErrorMessage } from '../features/inventory/getApiErrorMessage';

interface EmployeeFormState {
  name: string;
  login: string;
  password: string;
  role: EmployeeRole;
}

const emptyForm: EmployeeFormState = {
  name: '',
  login: '',
  password: '',
  role: 'TECHNICIAN',
};

const roleLabels: Record<EmployeeRole, string> = {
  MANAGER: 'Менеджер',
  TECHNICIAN: 'Технический специалист',
};

export const EmployeesPage = () => {
  const { data, isLoading, isError } = useGetEmployeesQuery();
  const [form, setForm] = useState<EmployeeFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [createEmployee, createState] = useCreateEmployeeMutation();
  const [updateEmployee, updateState] = useUpdateEmployeeMutation();
  const [deleteEmployee, deleteState] = useDeleteEmployeeMutation();
  const isWorking = createState.isLoading || updateState.isLoading || deleteState.isLoading;

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(undefined);
    setFormError(undefined);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(undefined);
    setActionError(undefined);

    const base = {
      login: form.login,
      name: form.name,
      role: form.role,
    };

    const candidate = editingId
      ? { ...base, ...(form.password ? { password: form.password } : {}) }
      : { ...base, password: form.password };
    const parsed = editingId
      ? employeeUpdateInputSchema.safeParse(candidate)
      : employeeCreateInputSchema.safeParse(candidate);

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Проверьте введённые данные');
      return;
    }

    try {
      if (editingId) {
        await updateEmployee({
          id: editingId,
          body: parsed.data as EmployeeUpdateInput,
        }).unwrap();
      } else {
        await createEmployee(parsed.data as EmployeeCreateInput).unwrap();
      }
      resetForm();
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Не удалось сохранить сотрудника'));
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingId(employee.id);
    setForm({
      name: employee.name,
      login: employee.login,
      password: '',
      role: employee.role,
    });
    setFormError(undefined);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (employee: Employee) => {
    if (!window.confirm(`Удалить сотрудника «${employee.name}»?`)) {
      return;
    }

    setActionError(undefined);
    try {
      await deleteEmployee(employee.id).unwrap();
      if (editingId === employee.id) {
        resetForm();
      }
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось удалить сотрудника'));
    }
  };

  return (
    <Stack spacing={3}>
      <Typography component="h1" variant="h4">
        Сотрудники
      </Typography>

      <Paper component="section" variant="outlined" sx={{ p: 3 }}>
        <Stack component="form" spacing={2} onSubmit={handleSubmit} noValidate>
          <Typography component="h2" variant="h5">
            {editingId ? 'Редактирование сотрудника' : 'Новый сотрудник'}
          </Typography>

          {formError && <Alert severity="error">{formError}</Alert>}

          <TextField
            label="Имя"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            slotProps={{ htmlInput: { maxLength: 100 } }}
            required
          />
          <TextField
            label="Логин"
            value={form.login}
            onChange={(event) => setForm((current) => ({ ...current, login: event.target.value }))}
            slotProps={{ htmlInput: { maxLength: 50, autoComplete: 'username' } }}
            required
          />
          <TextField
            label={editingId ? 'Новый пароль (необязательно)' : 'Пароль'}
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            slotProps={{ htmlInput: { maxLength: 128, autoComplete: 'new-password' } }}
            required={!editingId}
          />
          <FormControl required>
            <InputLabel id="employee-role-label">Роль</InputLabel>
            <Select
              labelId="employee-role-label"
              label="Роль"
              value={form.role}
              onChange={(event) => setForm((current) => ({
                ...current,
                role: event.target.value as EmployeeRole,
              }))}
            >
              <MenuItem value="MANAGER">Менеджер</MenuItem>
              <MenuItem value="TECHNICIAN">Технический специалист</MenuItem>
            </Select>
          </FormControl>

          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isWorking}>
              {isWorking ? 'Сохранение...' : 'Сохранить'}
            </Button>
            {editingId && (
              <Button variant="outlined" onClick={resetForm} disabled={isWorking}>
                Отмена
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {actionError && <Alert severity="error">{actionError}</Alert>}
      {isError && <Alert severity="error">Не удалось загрузить сотрудников</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Имя</TableCell>
              <TableCell>Логин</TableCell>
              <TableCell>Роль</TableCell>
              <TableCell align="right">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : data?.employees.length ? (
              data.employees.map((employee) => (
                <TableRow key={employee.id} hover>
                  <TableCell>{employee.name}</TableCell>
                  <TableCell>{employee.login}</TableCell>
                  <TableCell>{roleLabels[employee.role]}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => handleEdit(employee)}>
                      Изменить
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      disabled={isWorking}
                      onClick={() => handleDelete(employee)}
                    >
                      Удалить
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                  Сотрудники не найдены
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
};
