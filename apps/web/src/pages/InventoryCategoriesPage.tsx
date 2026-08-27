import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  InputLabel,
  ListItemText,
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
  useCreateAdditionalCategoryMutation,
  useCreateMainCategoryMutation,
  useDeleteAdditionalCategoryMutation,
  useDeleteMainCategoryMutation,
  useGetInventoryCategoriesQuery,
  useUpdateAdditionalCategoryMutation,
  useUpdateMainCategoryMutation,
} from '../features/inventory/api/inventoryApi';
import { getApiErrorMessage } from '../features/inventory/getApiErrorMessage';

export const InventoryCategoriesPage = () => {
  const { data, isLoading, isError } = useGetInventoryCategoriesQuery();
  const [mainName, setMainName] = useState('');
  const [editingMainId, setEditingMainId] = useState<string>();
  const [additionalName, setAdditionalName] = useState('');
  const [additionalMainIds, setAdditionalMainIds] = useState<string[]>([]);
  const [editingAdditionalId, setEditingAdditionalId] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [createMain, createMainState] = useCreateMainCategoryMutation();
  const [updateMain, updateMainState] = useUpdateMainCategoryMutation();
  const [deleteMain, deleteMainState] = useDeleteMainCategoryMutation();
  const [createAdditional, createAdditionalState] = useCreateAdditionalCategoryMutation();
  const [updateAdditional, updateAdditionalState] = useUpdateAdditionalCategoryMutation();
  const [deleteAdditional, deleteAdditionalState] = useDeleteAdditionalCategoryMutation();

  const isWorking = [
    createMainState,
    updateMainState,
    deleteMainState,
    createAdditionalState,
    updateAdditionalState,
    deleteAdditionalState,
  ].some((state) => state.isLoading);

  const resetMainForm = () => {
    setMainName('');
    setEditingMainId(undefined);
  };

  const resetAdditionalForm = () => {
    setAdditionalName('');
    setAdditionalMainIds([]);
    setEditingAdditionalId(undefined);
  };

  const handleMainSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setActionError(undefined);

    try {
      if (editingMainId) {
        await updateMain({ id: editingMainId, body: { name: mainName } }).unwrap();
      } else {
        await createMain({ name: mainName }).unwrap();
      }
      resetMainForm();
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось сохранить категорию'));
    }
  };

  const handleAdditionalSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setActionError(undefined);

    const body = { name: additionalName, mainCategoryIds: additionalMainIds };

    try {
      if (editingAdditionalId) {
        await updateAdditional({ id: editingAdditionalId, body }).unwrap();
      } else {
        await createAdditional(body).unwrap();
      }
      resetAdditionalForm();
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось сохранить категорию'));
    }
  };

  const handleDeleteMain = async (id: string, name: string) => {
    if (!window.confirm(`Удалить основную категорию «${name}»?`)) {
      return;
    }

    setActionError(undefined);
    try {
      await deleteMain(id).unwrap();
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось удалить категорию'));
    }
  };

  const handleDeleteAdditional = async (id: string, name: string) => {
    if (!window.confirm(`Удалить дополнительную категорию «${name}»?`)) {
      return;
    }

    setActionError(undefined);
    try {
      await deleteAdditional(id).unwrap();
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось удалить категорию'));
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 360 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={4}>
      <Typography component="h1" variant="h4">
        Категории склада
      </Typography>

      {isError && <Alert severity="error">Не удалось загрузить категории</Alert>}
      {actionError && <Alert severity="error">{actionError}</Alert>}

      <Paper component="section" variant="outlined" sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Typography component="h2" variant="h5">
            Основные категории
          </Typography>

          <Stack
            component="form"
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            onSubmit={handleMainSubmit}
          >
            <TextField
              label="Название основной категории"
              value={mainName}
              onChange={(event) => setMainName(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 100 } }}
              required
              fullWidth
            />
            <Button type="submit" variant="contained" disabled={isWorking || !mainName.trim()}>
              {editingMainId ? 'Сохранить' : 'Добавить'}
            </Button>
            {editingMainId && (
              <Button variant="outlined" onClick={resetMainForm} disabled={isWorking}>
                Отмена
              </Button>
            )}
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Название</TableCell>
                  <TableCell align="right">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.mainCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>{category.name}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() => {
                          setEditingMainId(category.id);
                          setMainName(category.name);
                        }}
                      >
                        Изменить
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        disabled={isWorking}
                        onClick={() => handleDeleteMain(category.id, category.name)}
                      >
                        Удалить
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </Paper>

      <Paper component="section" variant="outlined" sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Typography component="h2" variant="h5">
            Дополнительные категории
          </Typography>

          <Stack component="form" spacing={2} onSubmit={handleAdditionalSubmit}>
            <TextField
              label="Название дополнительной категории"
              value={additionalName}
              onChange={(event) => setAdditionalName(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 100 } }}
              required
            />

            <FormControl required>
              <InputLabel id="additional-main-categories-label">Основные категории</InputLabel>
              <Select
                labelId="additional-main-categories-label"
                label="Основные категории"
                multiple
                value={additionalMainIds}
                onChange={(event) => {
                  const value = event.target.value;
                  setAdditionalMainIds(typeof value === 'string' ? value.split(',') : value);
                }}
                renderValue={(selected) => selected
                  .map((id) => data?.mainCategories.find((category) => category.id === id)?.name)
                  .filter(Boolean)
                  .join(', ')}
              >
                {data?.mainCategories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    <Checkbox checked={additionalMainIds.includes(category.id)} />
                    <ListItemText primary={category.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction="row" spacing={2}>
              <Button
                type="submit"
                variant="contained"
                disabled={isWorking || !additionalName.trim() || additionalMainIds.length === 0}
              >
                {editingAdditionalId ? 'Сохранить' : 'Добавить'}
              </Button>
              {editingAdditionalId && (
                <Button variant="outlined" onClick={resetAdditionalForm} disabled={isWorking}>
                  Отмена
                </Button>
              )}
            </Stack>
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Название</TableCell>
                  <TableCell>Основные категории</TableCell>
                  <TableCell align="right">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.additionalCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>{category.name}</TableCell>
                    <TableCell>
                      {category.mainCategoryIds
                        .map((id) => data.mainCategories.find((main) => main.id === id)?.name)
                        .filter(Boolean)
                        .join(', ')}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() => {
                          setEditingAdditionalId(category.id);
                          setAdditionalName(category.name);
                          setAdditionalMainIds(category.mainCategoryIds);
                        }}
                      >
                        Изменить
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        disabled={isWorking}
                        onClick={() => handleDeleteAdditional(category.id, category.name)}
                      >
                        Удалить
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </Paper>
    </Stack>
  );
};
