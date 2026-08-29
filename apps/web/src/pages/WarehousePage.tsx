import type { InventoryListQuery } from '@itlab/contracts';
import {
  Alert,
  Box,
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
  TextField,
  Typography,
} from '@mui/material';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { useGetSessionQuery } from '../app/api';
import { CategoryAutocomplete } from '../components/CategoryAutocomplete';
import {
  useDeleteInventoryItemMutation,
  useGetInventoryCategoriesQuery,
  useGetInventoryItemsQuery,
} from '../features/inventory/api/inventoryApi';
import { getApiErrorMessage } from '../features/inventory/getApiErrorMessage';

export const WarehousePage = () => {
  const { data: session } = useGetSessionQuery();
  const { data: categories } = useGetInventoryCategoriesQuery();
  const [query, setQuery] = useState<InventoryListQuery>({ page: 1 });
  const [search, setSearch] = useState('');
  const [mainCategoryId, setMainCategoryId] = useState('');
  const [additionalCategoryId, setAdditionalCategoryId] = useState('');
  const [actionError, setActionError] = useState<string>();
  const { data, isFetching, isError } = useGetInventoryItemsQuery(query);
  const [deleteItem, { isLoading: isDeleting }] = useDeleteInventoryItemMutation();

  const role = session?.user.role;
  const canManageItems = role === 'ADMIN' || role === 'MANAGER';
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
    }));
  };

  const handleReset = () => {
    setSearch('');
    setMainCategoryId('');
    setAdditionalCategoryId('');
    setQuery({ page: 1 });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Удалить складскую позицию «${name}»?`)) {
      return;
    }

    setActionError(undefined);
    try {
      await deleteItem(id).unwrap();
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось удалить позицию'));
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
          Склад
        </Typography>

        {role === 'ADMIN' && (
          <Link to="/warehouse/categories" style={{ textDecoration: 'none' }}>
            <Button variant="outlined">Категории</Button>
          </Link>
        )}

        {canManageItems && (
          <Link to="/warehouse/new" style={{ textDecoration: 'none' }}>
            <Button variant="contained">+ Новая позиция</Button>
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
              label="Доп. категория"
              options={availableAdditionalCategories}
              value={additionalCategoryId}
              onChange={setAdditionalCategoryId}
              disabled={!mainCategoryId}
            />

            <Button
              variant="contained"
              onClick={handleFilter}
              disabled={isFetching}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Фильтр
            </Button>
            <Button
              variant="outlined"
              onClick={handleReset}
              disabled={isFetching}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Сбросить
            </Button>
          </Box>
        </Stack>
      </Paper>

      {actionError && <Alert severity="error">{actionError}</Alert>}
      {isError && <Alert severity="error">Не удалось загрузить склад</Alert>}

      <TableContainer
        component={Paper}
        sx={{ border: 1, borderColor: 'divider', boxShadow: 'none' }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Наименование</TableCell>
              <TableCell>Описание</TableCell>
              <TableCell align="right">Количество</TableCell>
              <TableCell>Основная категория</TableCell>
              <TableCell>Доп. категория</TableCell>
              {canManageItems && <TableCell align="right">Действия</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {isFetching && !data ? (
              <TableRow>
                <TableCell colSpan={canManageItems ? 6 : 5}>
                  <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
                    <CircularProgress size={32} />
                  </Box>
                </TableCell>
              </TableRow>
            ) : data?.items.length ? (
              data.items.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.name}</TableCell>
                  <TableCell sx={{ maxWidth: 360, whiteSpace: 'normal' }}>
                    {item.description || '—'}
                  </TableCell>
                  <TableCell align="right">{item.count}</TableCell>
                  <TableCell>{item.mainCategory.name}</TableCell>
                  <TableCell>
                    {item.additionalCategories.map((category) => category.name).join(', ') || '—'}
                  </TableCell>
                  {canManageItems && (
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                        <Link
                          to={`/warehouse/${item.id}/edit`}
                          style={{ textDecoration: 'none' }}
                        >
                          <Button size="small">Изменить</Button>
                        </Link>
                        <Button
                          size="small"
                          color="error"
                          disabled={isDeleting}
                          onClick={() => handleDelete(item.id, item.name)}
                        >
                          Удалить
                        </Button>
                      </Stack>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={canManageItems ? 6 : 5} align="center" sx={{ py: 6 }}>
                  Позиции не найдены
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
        Найдено позиций: {data?.pagination.total ?? 0}. На странице — до 50.
      </Typography>
    </Stack>
  );
};
