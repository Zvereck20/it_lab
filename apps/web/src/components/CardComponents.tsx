import type { InventoryItem } from '@itlab/contracts';
import { Alert, Autocomplete, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';

import { useGetInventoryItemsQuery } from '../features/inventory/api/inventoryApi';
import {
  type CardComponent, type CardTarget,
  useAddCardComponentMutation, useDeleteCardComponentMutation,
  useGetCardComponentsQuery, useUpdateCardComponentMutation,
} from '../features/inventory/api/cardComponentsApi';
import { getApiErrorMessage } from '../features/inventory/getApiErrorMessage';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const formatDate = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' });

export const CardComponents = ({ target, editable }: { target: CardTarget; editable: boolean }) => {
  const { data, isLoading, isError } = useGetCardComponentsQuery(target);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [editing, setEditing] = useState<CardComponent | null>(null);
  const [error, setError] = useState<string>();
  const [add, addState] = useAddCardComponentMutation();
  const [update, updateState] = useUpdateCardComponentMutation();
  const [remove, removeState] = useDeleteCardComponentMutation();
  const { data: inventory, isFetching } = useGetInventoryItemsQuery(
    { page: 1, search: useDebouncedValue(search).trim() || undefined }, { skip: !adding },
  );
  const options = inventory?.items.filter(item => item.count > 0 && !data?.items.some(c => c.inventoryItemId === item.id)) ?? [];
  const busy = addState.isLoading || updateState.isLoading || removeState.isLoading;

  const submit = async () => {
    if (!selected || !Number.isInteger(quantity) || quantity < 1 || quantity > selected.count) return;
    setError(undefined);
    try {
      await add({ ...target, inventoryItemId: selected.id, quantity }).unwrap();
      setAdding(false); setSearch(''); setSelected(null); setQuantity(1);
    } catch (e) { setError(getApiErrorMessage(e, 'Не удалось добавить компонент')); }
  };
  const save = async () => {
    if (!editing || !Number.isInteger(quantity) || quantity < 1) return;
    setError(undefined);
    try {
      await update({ ...target, componentId: editing.id, quantity }).unwrap();
      setEditing(null); setQuantity(1);
    } catch (e) { setError(getApiErrorMessage(e, 'Не удалось изменить количество')); }
  };
  const deleteOne = async (component: CardComponent) => {
    if (!window.confirm(`Вернуть «${component.name}» на склад?`)) return;
    setError(undefined);
    try { await remove({ ...target, componentId: component.id }).unwrap(); }
    catch (e) { setError(getApiErrorMessage(e, 'Не удалось удалить компонент')); }
  };

  return <Paper variant="outlined" sx={{ p: 3 }}>
    <Stack spacing={2}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography component="h2" variant="h5">Компоненты склада</Typography>
        {editable && !adding && <Button variant="contained" onClick={() => { setAdding(true); setError(undefined); }}>+ Добавить компонент</Button>}
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {isError && <Alert severity="error">Не удалось загрузить компоненты</Alert>}
      {isLoading && <CircularProgress size={24} />}
      {adding && editable && <Stack spacing={2}>
        <Autocomplete
          options={options} value={selected} inputValue={search} loading={isFetching}
          filterOptions={items => items} getOptionLabel={item => item.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          onInputChange={(_event, value, reason) => { if (reason === 'input') { setSearch(value); setSelected(null); } }}
          onChange={(_event, item) => { setSelected(item); setSearch(item?.name ?? ''); }}
          noOptionsText="Компоненты не найдены"
          renderOption={(props, item) => <Box component="li" {...props}>{item.name} — на складе {item.count}</Box>}
          renderInput={params => <TextField {...params} label="Найти компонент" />}
        />
        <TextField label="Количество" type="number" value={quantity} onChange={event => setQuantity(Number(event.target.value))}
          slotProps={{ htmlInput: { min: 1, max: selected?.count, step: 1 } }} />
        <Stack direction="row" spacing={1}>
          <Button variant="contained" disabled={!selected || busy || !Number.isInteger(quantity) || quantity < 1 || quantity > selected.count} onClick={submit}>Добавить</Button>
          <Button onClick={() => { setAdding(false); setSelected(null); setSearch(''); setError(undefined); }}>Отмена</Button>
        </Stack>
      </Stack>}
      {data?.items.length === 0 && <Typography color="text.secondary">Компоненты не добавлены</Typography>}
      {data?.items.map(component => <Box key={component.id} sx={{ borderTop: 1, borderColor: 'divider', py: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' } }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography>{component.name} · {component.quantity} шт.</Typography>
            <Typography variant="body2" color="text.secondary">Добавил: {component.addedByName} · {formatDate.format(new Date(component.addedAt))}</Typography>
          </Box>
          {editable && <Stack direction="row" spacing={1}>
            <Button size="small" disabled={busy} onClick={() => { setEditing(component); setQuantity(component.quantity); setError(undefined); }}>Изменить</Button>
            <Button size="small" color="error" disabled={busy} onClick={() => deleteOne(component)}>Удалить</Button>
          </Stack>}
        </Stack>
        {editing?.id === component.id && <Stack direction="row" sx={{ gap: 1, mt: 2, alignItems: 'center' }}>
          <TextField size="small" label="Новое количество" type="number" value={quantity}
            onChange={event => setQuantity(Number(event.target.value))} slotProps={{ htmlInput: { min: 1, step: 1 } }} />
          <Button disabled={busy || !Number.isInteger(quantity) || quantity < 1 || quantity === component.quantity} onClick={save}>Сохранить</Button>
          <Button onClick={() => setEditing(null)}>Отмена</Button>
        </Stack>}
      </Box>)}
    </Stack>
  </Paper>;
};
