import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { getApiErrorMessage } from '../features/inventory/getApiErrorMessage';
import {
  useCreateNoteCommentMutation,
  useDeleteNoteMutation,
  useGetNoteQuery,
} from '../features/notes/api/notesApi';

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const roleLabels = {
  ADMIN: 'ADMIN',
  MANAGER: 'Менеджер',
  TECHNICIAN: 'Технический специалист',
} as const;

const DetailField = ({ label, children }: { label: string; children: ReactNode }) => (
  <Box>
    <Typography component="dt" variant="body2" color="text.secondary">{label}</Typography>
    <Typography component="dd" sx={{ m: 0, mt: 0.5, whiteSpace: 'pre-wrap' }}>
      {children}
    </Typography>
  </Box>
);

export const NoteDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: note, isFetching, isError } = useGetNoteQuery(id ?? '', { skip: !id });
  const [deleteNote, deleteState] = useDeleteNoteMutation();
  const [createComment, commentState] = useCreateNoteCommentMutation();
  const [comment, setComment] = useState('');
  const [actionError, setActionError] = useState<string>();

  const handleDelete = async () => {
    if (!id || !note || !window.confirm(`Удалить задачу «${note.title}»?`)) return;
    setActionError(undefined);
    try {
      await deleteNote(id).unwrap();
      navigate('/', { replace: true });
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось удалить задачу'));
    }
  };

  const handleCommentSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!id || !comment.trim()) return;
    setActionError(undefined);
    try {
      await createComment({ id, body: { text: comment } }).unwrap();
      setComment('');
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось добавить комментарий'));
    }
  };

  if (isFetching && !note) {
    return (
      <Box sx={{ display: 'grid', minHeight: 360, placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (isError || !note) return <Alert severity="error">Не удалось загрузить задачу</Alert>;

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'center' } }}
      >
        <Typography component="h1" variant="h4" sx={{ flexGrow: 1 }}>
          Карточка задачи
        </Typography>
        {note.permissions.canEdit && (
          <>
            <Link to={`/notes/${note.id}/edit`} style={{ textDecoration: 'none' }}>
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

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 3,
          }}
        >
          <DetailField label="Кто создал">
            {note.creatorName} — {roleLabels[note.creatorRole]}
          </DetailField>
          <DetailField label="Дата создания">
            {dateTimeFormatter.format(new Date(note.createdAt))}
          </DetailField>
          <DetailField label="Последнее обновление">
            {dateTimeFormatter.format(new Date(note.updatedAt))}
          </DetailField>
          <Box sx={{ gridColumn: { md: '1 / -1' } }}>
            <DetailField label="Заголовок">{note.title}</DetailField>
          </Box>
          <Box sx={{ gridColumn: { md: '1 / -1' } }}>
            <DetailField label="Описание">{note.description}</DetailField>
          </Box>
          <Box sx={{ gridColumn: { md: '1 / -1' } }}>
            <Typography component="dt" variant="body2" color="text.secondary">
              Сотрудники
            </Typography>
            <Stack
              component="dd"
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ m: 0, mt: 1, flexWrap: 'wrap' }}
            >
              {note.participants.map((participant) => (
                <Chip
                  key={participant.key}
                  label={`${participant.name} — ${roleLabels[participant.role]}`}
                  variant="outlined"
                />
              ))}
            </Stack>
          </Box>
        </Box>
      </Paper>

      <Paper component="section" variant="outlined" sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Typography component="h2" variant="h5">Комментарии</Typography>

          {note.comments.length > 0 ? (
            <Stack spacing={2} divider={<Divider flexItem />}>
              {note.comments.map((item) => (
                <Box key={item.id}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 1 }}>
                    <Typography sx={{ fontWeight: 600 }}>{item.authorName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {roleLabels[item.authorRole]} · {dateTimeFormatter.format(new Date(item.createdAt))}
                    </Typography>
                  </Stack>
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>{item.text}</Typography>
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography color="text.secondary">Комментариев пока нет</Typography>
          )}

          {note.permissions.canComment && (
            <Stack component="form" spacing={2} onSubmit={handleCommentSubmit}>
              <TextField
                label="Комментарий"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 5_000 } }}
                multiline
                minRows={3}
                required
                fullWidth
              />
              <Button
                type="submit"
                variant="contained"
                disabled={!comment.trim() || commentState.isLoading}
                sx={{ alignSelf: 'flex-start' }}
              >
                {commentState.isLoading ? 'Добавление...' : 'Добавить комментарий'}
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
};
