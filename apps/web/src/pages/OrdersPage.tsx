import type { OrderListQuery, OrderStatus } from '@itlab/contracts';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
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
import type { FormEvent, KeyboardEvent } from 'react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useGetSessionQuery } from '../app/api';
import { CategoryAutocomplete } from '../components/CategoryAutocomplete';
import { useGetTechniciansQuery } from '../features/employees/api/employeesApi';
import {
  useGetOrderCategoriesQuery,
  useGetOrdersQuery,
} from '../features/orders/api/ordersApi';
import { orderStatuses } from '../features/orders/orderStatus';

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const OrdersPage = () => {
  const navigate = useNavigate();
  const { data: session } = useGetSessionQuery();
  const { data: technicians } = useGetTechniciansQuery();
  const { data: categories } = useGetOrderCategoriesQuery();
  const [query, setQuery] = useState<OrderListQuery>({ page: 1 });
  const [search, setSearch] = useState('');
  const [mainCategoryId, setMainCategoryId] = useState('');
  const [additionalCategoryId, setAdditionalCategoryId] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [status, setStatus] = useState('');
  const { data, isFetching, isError } = useGetOrdersQuery(query);
  const role = session?.user.role;
  const canManage = role === 'ADMIN' || role === 'MANAGER';
  const availableAdditionalCategories = useMemo(
    () => categories?.additionalCategories.filter((category) =>
      category.mainCategoryIds.includes(mainCategoryId)) ?? [],
    [categories, mainCategoryId],
  );

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery((current) => ({
      ...current,
      page: 1,
      search: search.trim() || undefined,
    }));
  };

  const handleFilter = () => {
    setQuery((current) => ({
      ...current,
      page: 1,
      mainCategoryId: mainCategoryId || undefined,
      additionalCategoryId: additionalCategoryId || undefined,
      technicianId: technicianId || undefined,
      status: (status || undefined) as OrderStatus | undefined,
    }));
  };

  const handleReset = () => {
    setSearch('');
    setMainCategoryId('');
    setAdditionalCategoryId('');
    setTechnicianId('');
    setStatus('');
    setQuery({ page: 1 });
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigate(`/orders/${id}`);
    }
  };

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ alignItems: { xs: 'stretch', md: 'center' } }}
      >
        <Typography component="h1" variant="h4" sx={{ flexGrow: 1 }}>Заказы</Typography>
        {role === 'ADMIN' && (
          <Link to="/orders/categories" style={{ textDecoration: 'none' }}>
            <Button variant="outlined">Категории</Button>
          </Link>
        )}
        {canManage && (
          <Link to="/orders/new" style={{ textDecoration: 'none' }}>
            <Button variant="contained">+ Новый заказ</Button>
          </Link>
        )}
      </Stack>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack
            component="form"
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            onSubmit={handleSearch}
          >
            <TextField
              label="Поиск по заказу, описанию, компании или ИНН"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              fullWidth
              size="small"
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
            <Button type="submit" variant="contained" disabled={isFetching}>Поиск</Button>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                md: 'repeat(2, minmax(0, 1fr))',
                xl: 'repeat(4, minmax(180px, 1fr))',
              },
              gap: 2,
            }}
          >
            <CategoryAutocomplete
              label="Основная категория"
              options={categories?.mainCategories ?? []}
              value={mainCategoryId}
              onChange={(value) => {
                setMainCategoryId(value);
                setAdditionalCategoryId('');
              }}
            />
            <CategoryAutocomplete
              label="Дополнительная категория"
              options={availableAdditionalCategories}
              value={additionalCategoryId}
              onChange={setAdditionalCategoryId}
              disabled={!mainCategoryId}
            />
            <FormControl size="small">
              <InputLabel id="order-technician-filter-label">Сотрудник</InputLabel>
              <Select
                labelId="order-technician-filter-label"
                label="Сотрудник"
                value={technicianId}
                onChange={(event) => setTechnicianId(event.target.value)}
              >
                <MenuItem value="">Все сотрудники</MenuItem>
                <MenuItem value="free_queue">Свободная касса</MenuItem>
                {technicians?.employees.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>{employee.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small">
              <InputLabel id="order-status-filter-label">Статус</InputLabel>
              <Select
                labelId="order-status-filter-label"
                label="Статус"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <MenuItem value="">Все статусы</MenuItem>
                {orderStatuses.map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={handleFilter} disabled={isFetching}>Фильтр</Button>
            <Button variant="outlined" onClick={handleReset} disabled={isFetching}>Сбросить</Button>
          </Stack>
        </Stack>
      </Paper>

      {isError && <Alert severity="error">Не удалось загрузить заказы</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Наименование</TableCell>
              <TableCell>Компания</TableCell>
              <TableCell>Основная категория</TableCell>
              <TableCell>Ответственный</TableCell>
              <TableCell>Дата создания</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isFetching && !data ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : data?.items.length ? (
              data.items.map((order) => (
                <TableRow
                  key={order.id}
                  hover
                  tabIndex={0}
                  role="link"
                  onClick={() => navigate(`/orders/${order.id}`)}
                  onKeyDown={(event) => handleRowKeyDown(event, order.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{order.name}</TableCell>
                  <TableCell>{order.companyName}</TableCell>
                  <TableCell>{order.mainCategory.name}</TableCell>
                  <TableCell>
                    {order.assignmentMode === 'FREE_QUEUE'
                      ? 'Свободная касса'
                      : order.technician?.name ?? '—'}
                  </TableCell>
                  <TableCell>{dateTimeFormatter.format(new Date(order.createdAt))}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>Заказы не найдены</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {Boolean(data?.pagination.totalPages) && data!.pagination.totalPages > 1 && (
        <Pagination
          page={data!.pagination.page}
          count={data!.pagination.totalPages}
          onChange={(_event, page) => setQuery((current) => ({ ...current, page }))}
          color="primary"
          disabled={isFetching}
          sx={{ alignSelf: 'center' }}
        />
      )}
      <Typography variant="body2" color="text.secondary">
        Найдено заказов: {data?.pagination.total ?? 0}. На странице — до 50.
      </Typography>
    </Stack>
  );
};
