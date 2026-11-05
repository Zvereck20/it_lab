import {
  Alert,
  Button,
  CircularProgress,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { KeyboardEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useGetNotesQuery } from '../features/notes/api/notesApi';

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const HomePage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isFetching, isError } = useGetNotesQuery({ page });

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigate(`/notes/${id}`);
    }
  };

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'center' } }}
      >
        <Typography component="h1" variant="h4" sx={{ flexGrow: 1 }}>
          Задачи
        </Typography>
        <Link to="/notes/new" style={{ textDecoration: 'none' }}>
          <Button variant="contained">+ Создать</Button>
        </Link>
      </Stack>

      {isError && <Alert severity="error">Не удалось загрузить задачи</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Заголовок</TableCell>
              <TableCell>Создал</TableCell>
              <TableCell>Сотрудники</TableCell>
              <TableCell>Дата создания</TableCell>
              <TableCell>Последнее обновление</TableCell>
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
              data.items.map((note) => (
                <TableRow
                  key={note.id}
                  hover
                  tabIndex={0}
                  role="link"
                  onClick={() => navigate(`/notes/${note.id}`)}
                  onKeyDown={(event) => handleRowKeyDown(event, note.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{note.title}</TableCell>
                  <TableCell>{note.creatorName}</TableCell>
                  <TableCell>
                    {note.participants.map((participant) => participant.name).join(', ')}
                  </TableCell>
                  <TableCell>{dateTimeFormatter.format(new Date(note.createdAt))}</TableCell>
                  <TableCell>{dateTimeFormatter.format(new Date(note.updatedAt))}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  Задачи не найдены
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {(data?.pagination.totalPages ?? 0) > 1 && (
        <Pagination
          page={page}
          count={data?.pagination.totalPages ?? 1}
          onChange={(_event, value) => setPage(value)}
          disabled={isFetching}
          sx={{ alignSelf: 'center' }}
        />
      )}
    </Stack>
  );
};
