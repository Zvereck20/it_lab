import type { ReactNode } from 'react';
import type { RepairStatus } from '@itlab/contracts';
import {
  Alert,
  Box,
  Button,
  Chip,
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
import { Link, useNavigate, useParams } from 'react-router';

import { useGetSessionQuery } from '../app/api';
import { formatRussianPhone } from '../components/PhoneField';
import { getApiErrorMessage } from '../features/inventory/getApiErrorMessage';
import {
  useDeleteRepairMutation,
  useGetRepairQuery,
  useTakeRepairMutation,
  useUpdateRepairStatusMutation,
} from '../features/repairs/api/repairsApi';
import { repairStatuses, repairStatusLabels } from '../features/repairs/repairStatus';

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const DetailField = ({ label, children }: { label: string; children: ReactNode }) => (
  <Box>
    <Typography component="dt" variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography component="dd" sx={{ m: 0, mt: 0.5, whiteSpace: 'pre-wrap' }}>
      {children || '—'}
    </Typography>
  </Box>
);

export const RepairDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: session } = useGetSessionQuery();
  const { data: repair, isFetching, isError } = useGetRepairQuery(id ?? '', { skip: !id });
  const [takeRepair, takeState] = useTakeRepairMutation();
  const [updateStatus, statusState] = useUpdateRepairStatusMutation();
  const [deleteRepair, deleteState] = useDeleteRepairMutation();
  const [selectedStatus, setSelectedStatus] = useState<RepairStatus>('CREATED');
  const [statusComment, setStatusComment] = useState('');
  const [actionError, setActionError] = useState<string>();
  const role = session?.user.role;
  const canManage = role === 'ADMIN' || role === 'MANAGER';
  const canTake = role === 'TECHNICIAN' && repair?.assignmentMode === 'FREE_QUEUE';
  const canChangeStatus = Boolean(
    canManage
    || (
      role === 'TECHNICIAN'
      && repair?.assignmentMode === 'ASSIGNED'
      && repair.technicianId === session?.user.id
    ),
  );

  useEffect(() => {
    if (repair) {
      setSelectedStatus(repair.status);
    }
  }, [repair]);

  const handleTake = async () => {
    if (!id) return;
    setActionError(undefined);
    try {
      await takeRepair(id).unwrap();
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось взять ремонт в работу'));
    }
  };

  const handleStatusUpdate = async () => {
    if (!id) return;
    setActionError(undefined);
    try {
      await updateStatus({
        id,
        body: { status: selectedStatus, comment: statusComment },
      }).unwrap();
      setStatusComment('');
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось изменить статус'));
    }
  };

  const handleDelete = async () => {
    if (!id || !repair || !window.confirm(`Удалить ремонт «${repair.name}»?`)) {
      return;
    }

    setActionError(undefined);
    try {
      await deleteRepair(id).unwrap();
      navigate('/repairs');
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось удалить ремонт'));
    }
  };

  if (isFetching && !repair) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 360 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !repair) {
    return <Alert severity="error">Не удалось загрузить карточку ремонта</Alert>;
  }

  const customerFullName = [
    repair.customerLastName,
    repair.customerFirstName,
    repair.customerMiddleName,
  ].filter(Boolean).join(' ');

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ alignItems: { md: 'center' } }}
      >
        <Typography component="h1" variant="h4" sx={{ flexGrow: 1 }}>
          Карточка ремонта
        </Typography>

        {canManage && (
          <>
            <Link to={`/repairs/${repair.id}/edit`} style={{ textDecoration: 'none' }}>
              <Button variant="contained">Изменить</Button>
            </Link>
            <Button
              variant="outlined"
              color="error"
              onClick={handleDelete}
              disabled={deleteState.isLoading}
            >
              Удалить
            </Button>
          </>
        )}
      </Stack>

      {actionError && <Alert severity="error">{actionError}</Alert>}

      {canTake && (
        <Alert
          severity="info"
          action={(
            <Button color="inherit" onClick={handleTake} disabled={takeState.isLoading}>
              Взять себе
            </Button>
          )}
        >
          Ремонт находится в свободной кассе.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Box
            component="dl"
            sx={{
              m: 0,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 3,
            }}
          >
            <DetailField label="Наименование">{repair.name}</DetailField>
            <DetailField label="Ответственный">
              {repair.assignmentMode === 'FREE_QUEUE'
                ? 'Свободная касса'
                : repair.technician?.name ?? '—'}
            </DetailField>
            <Box sx={{ gridColumn: { md: '1 / -1' } }}>
              <DetailField label="Описание">{repair.description}</DetailField>
            </Box>
            <DetailField label="Дата создания">
              {dateTimeFormatter.format(new Date(repair.createdAt))}
            </DetailField>
            <DetailField label="Последнее изменение">
              {dateTimeFormatter.format(new Date(repair.updatedAt))}
            </DetailField>
          </Box>

          <Typography component="h2" variant="h5">Заказчик</Typography>
          <Box
            component="dl"
            sx={{
              m: 0,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 3,
            }}
          >
            <DetailField label="Тип">
              {repair.customerType === 'INDIVIDUAL' ? 'Физ. лицо' : 'Юр. лицо'}
            </DetailField>
            <DetailField label="Телефон">{formatRussianPhone(repair.customerPhone)}</DetailField>
            {repair.customerType === 'LEGAL_ENTITY' && (
              <>
                <DetailField label="Название компании">{repair.companyName}</DetailField>
                <DetailField label="ИНН">{repair.inn}</DetailField>
              </>
            )}
            <DetailField label={repair.customerType === 'LEGAL_ENTITY' ? 'Контактное лицо' : 'ФИО'}>
              {customerFullName}
            </DetailField>
          </Box>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography component="h2" variant="h5">Статус</Typography>
          {canChangeStatus ? (
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl sx={{ minWidth: 240 }}>
                  <InputLabel id="repair-card-status-label">Статус</InputLabel>
                  <Select
                    labelId="repair-card-status-label"
                    label="Статус"
                    value={selectedStatus}
                    onChange={(event) => setSelectedStatus(event.target.value as RepairStatus)}
                  >
                    {repairStatuses.map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  onClick={handleStatusUpdate}
                  disabled={statusState.isLoading || selectedStatus === repair.status}
                >
                  Сохранить статус
                </Button>
              </Stack>
              <TextField
                label="Комментарий к статусу (необязательно)"
                value={statusComment}
                onChange={(event) => setStatusComment(event.target.value)}
                multiline
                minRows={3}
                slotProps={{ htmlInput: { maxLength: 1_000 } }}
                helperText={`${statusComment.length}/1000`}
              />
            </Stack>
          ) : (
            <Chip label={repairStatusLabels[repair.status]} sx={{ alignSelf: 'flex-start' }} />
          )}

          <Typography component="h3" variant="h6" sx={{ pt: 1 }}>
            История статусов
          </Typography>
          <Stack spacing={0}>
            {repair.statusHistory.map((entry) => (
              <Box
                key={entry.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: 'minmax(140px, 0.7fr) minmax(150px, 0.8fr) minmax(160px, 1fr) 2fr',
                  },
                  gap: 2,
                  py: 2,
                  borderTop: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography>{repairStatusLabels[entry.status]}</Typography>
                <Typography color="text.secondary">
                  {dateTimeFormatter.format(new Date(entry.changedAt))}
                </Typography>
                <Typography>{entry.changedByName}</Typography>
                <Typography color={entry.comment ? 'text.primary' : 'text.secondary'}>
                  {entry.comment || 'Нет комментария'}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Stack>
      </Paper>

      <Button variant="outlined" onClick={() => navigate('/repairs')} sx={{ alignSelf: 'flex-start' }}>
        К списку ремонтов
      </Button>
    </Stack>
  );
};
