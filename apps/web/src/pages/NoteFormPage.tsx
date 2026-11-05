import type { NoteParticipant } from '@itlab/contracts';
import { noteInputSchema } from '@itlab/contracts';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { useGetSessionQuery } from '../app/api';
import { getApiErrorMessage } from '../features/inventory/getApiErrorMessage';
import {
  useCreateNoteMutation,
  useGetNoteParticipantsQuery,
  useGetNoteQuery,
  useUpdateNoteMutation,
} from '../features/notes/api/notesApi';

const roleLabels = {
  ADMIN: 'ADMIN',
  MANAGER: 'Менеджер',
  TECHNICIAN: 'Технический специалист',
} as const;

export const NoteFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const { data: session } = useGetSessionQuery();
  const { data: participantsData, isFetching: participantsAreFetching } =
    useGetNoteParticipantsQuery();
  const { data: note, isFetching: noteIsFetching, isError: noteIsError } = useGetNoteQuery(
    id ?? '',
    { skip: !id },
  );
  const [createNote, createState] = useCreateNoteMutation();
  const [updateNote, updateState] = useUpdateNoteMutation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [participantKeys, setParticipantKeys] = useState<string[]>([]);
  const [formError, setFormError] = useState<string>();
  const currentUserKey = session?.user.id ?? 'ADMIN';
  const participantOptions = useMemo(
    () => participantsData?.participants.filter((participant) =>
      participant.key !== currentUserKey) ?? [],
    [currentUserKey, participantsData?.participants],
  );
  const selectedParticipants = useMemo(
    () => participantOptions.filter((participant) => participantKeys.includes(participant.key)),
    [participantKeys, participantOptions],
  );
  const isSaving = createState.isLoading || updateState.isLoading;

  useEffect(() => {
    if (!note) return;
    setTitle(note.title);
    setDescription(note.description);
    setParticipantKeys(note.participants.map((participant) => participant.key));
  }, [note]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(undefined);

    const parsed = noteInputSchema.safeParse({ title, description, participantKeys });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Проверьте введённые данные');
      return;
    }

    try {
      const savedNote = isEditing
        ? await updateNote({ id: id!, body: parsed.data }).unwrap()
        : await createNote(parsed.data).unwrap();
      navigate(`/notes/${savedNote.id}`, { replace: true });
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Не удалось сохранить задачу'));
    }
  };

  if (isEditing && noteIsFetching && !note) {
    return (
      <Box sx={{ display: 'grid', minHeight: 360, placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (isEditing && (noteIsError || !note)) {
    return <Alert severity="error">Не удалось загрузить задачу</Alert>;
  }
  if (isEditing && note && !note.permissions.canEdit) {
    return <Alert severity="error">Изменять задачу может только её создатель</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Typography component="h1" variant="h4">
        {isEditing ? 'Редактирование задачи' : 'Создание задачи'}
      </Typography>

      <Paper component="form" variant="outlined" sx={{ p: 3 }} onSubmit={handleSubmit} noValidate>
        <Stack spacing={3}>
          {formError && <Alert severity="error">{formError}</Alert>}

          <TextField
            label="Заголовок"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 150 } }}
            required
            fullWidth
          />
          <TextField
            label="Описание"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 10_000 } }}
            required
            multiline
            minRows={6}
            fullWidth
          />
          <Autocomplete<NoteParticipant, true, false, false>
            multiple
            disableCloseOnSelect
            options={participantOptions}
            value={selectedParticipants}
            loading={participantsAreFetching}
            getOptionLabel={(option) => `${option.name} — ${roleLabels[option.role]}`}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            onChange={(_event, value) => setParticipantKeys(value.map((participant) => participant.key))}
            noOptionsText="Сотрудники не найдены"
            loadingText="Загрузка..."
            renderOption={(props, option, { selected }) => (
              <li {...props}>
                <Checkbox checked={selected} sx={{ mr: 1 }} />
                {option.name} — {roleLabels[option.role]}
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Сотрудники"
                required
                helperText="Выберите минимум одного сотрудника"
              />
            )}
          />

          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isSaving}>
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </Button>
            <Button variant="outlined" onClick={() => navigate(-1)} disabled={isSaving}>
              Отмена
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
};
