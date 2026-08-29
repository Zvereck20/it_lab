import type { RepairListQuery, RepairStatus } from '@itlab/contracts';
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
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useGetSessionQuery } from '../app/api';
import { useGetTechniciansQuery } from '../features/employees/api/employeesApi';
import { useGetRepairsQuery } from '../features/repairs/api/repairsApi';
import { repairStatuses } from '../features/repairs/repairStatus';

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const RepairsPage = () => {
  const navigate = useNavigate();
  const { data: session } = useGetSessionQuery();
  const { data: technicians } = useGetTechniciansQuery();
  const [query, setQuery] = useState<RepairListQuery>({ page: 1 });
  const [search, setSearch] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [status, setStatus] = useState('');
  const { data, isFetching, isError } = useGetRepairsQuery(query);
  const role = session?.user.role;
  const canManageRepairs = role === 'ADMIN' || role === 'MANAGER';

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
      technicianId: technicianId || undefined,
      status: (status || undefined) as RepairStatus | undefined,
    }));
  };

  const handleReset = () => {
    setSearch('');
    setTechnicianId('');
    setStatus('');
    setQuery({ page: 1 });
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigate(`/repairs/${id}`);
    }
  };

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ alignItems: { xs: 'stretch', md: 'center' } }}
      >
        <Typography component="h1" variant="h4" sx={{ flexGrow: 1 }}>
          Ремонт
        </Typography>

        {canManageRepairs && (
          <Link to="/repairs/new" style={{ textDecoration: 'none' }}>
            <Button variant="contained">+ Новый ремонт</Button>
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
              label="Поиск по наименованию или описанию"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              fullWidth
              size="small"
            />
            <Button type="submit" variant="contained" disabled={isFetching}>
              Поиск
            </Button>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                md: 'repeat(2, minmax(0, 1fr))',
                lg: 'minmax(220px, 1fr) minmax(220px, 1fr) auto auto',
              },
              gap: 2,
            }}
          >
            <FormControl size="small">
              <InputLabel id="repair-technician-filter-label">Сотрудник</InputLabel>
              <Select
                labelId="repair-technician-filter-label"
                label="Сотрудник"
                value={technicianId}
                onChange={(event) => setTechnicianId(event.target.value)}
              >
                <MenuItem value="">Все сотрудники</MenuItem>
                <MenuItem value="free_queue">Свободная касса</MenuItem>
                {technicians?.employees.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small">
              <InputLabel id="repair-status-filter-label">Статус</InputLabel>
              <Select
                labelId="repair-status-filter-label"
                label="Статус"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <MenuItem value="">Все статусы</MenuItem>
                {repairStatuses.map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button variant="contained" onClick={handleFilter} disabled={isFetching}>
              Фильтр
            </Button>
            <Button variant="outlined" onClick={handleReset} disabled={isFetching}>
              Сбросить
            </Button>
          </Box>
        </Stack>
      </Paper>

      {isError && <Alert severity="error">Не удалось загрузить ремонты</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Наименование</TableCell>
              <TableCell>Описание</TableCell>
              <TableCell>Ответственный</TableCell>
              <TableCell>Дата создания</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isFetching && !data ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : data?.items.length ? (
              data.items.map((repair) => (
                <TableRow
                  key={repair.id}
                  hover
                  tabIndex={0}
                  role="link"
                  onClick={() => navigate(`/repairs/${repair.id}`)}
                  onKeyDown={(event) => handleRowKeyDown(event, repair.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{repair.name}</TableCell>
                  <TableCell
                    title={repair.description}
                    sx={{
                      maxWidth: 380,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {repair.description || '—'}
                  </TableCell>
                  <TableCell>
                    {repair.assignmentMode === 'FREE_QUEUE'
                      ? 'Свободная касса'
                      : repair.technician?.name ?? '—'}
                  </TableCell>
                  <TableCell>{dateTimeFormatter.format(new Date(repair.createdAt))}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                  Ремонты не найдены
                </TableCell>
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
        Найдено ремонтов: {data?.pagination.total ?? 0}. На странице — до 50.
      </Typography>
    </Stack>
  );
};
