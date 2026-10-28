import type { InventoryItem, WorkItemComponent } from '@itlab/contracts';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { useEffect, useMemo, useState } from 'react';

import {
  type WorkItemType,
  useAddWorkItemComponentMutation,
  useDeleteWorkItemComponentMutation,
  useGetInventoryItemQuery,
  useGetInventoryItemsQuery,
  useUpdateWorkItemComponentMutation,
} from '../features/inventory/api/inventoryApi';
import { getApiErrorMessage } from '../features/inventory/getApiErrorMessage';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

interface WorkItemComponentsSectionProps {
  type: WorkItemType;
  workItemId: string;
  components: WorkItemComponent[];
  canManage: boolean;
  isCompleted: boolean;
}

export const WorkItemComponentsSection = ({
  type,
  workItemId,
  components,
  canManage,
  isCompleted,
}: WorkItemComponentsSectionProps) => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<WorkItemComponent | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [search, setSearch] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [actionError, setActionError] = useState<string>();
  const [actionSuccess, setActionSuccess] = useState<string>();
  const debouncedSearch = useDebouncedValue(search);
  const [addComponent, addState] = useAddWorkItemComponentMutation();
  const [updateComponent, updateState] = useUpdateWorkItemComponentMutation();
  const [deleteComponent, deleteState] = useDeleteWorkItemComponentMutation();
  const { data: inventoryData, isFetching: inventoryIsFetching } = useGetInventoryItemsQuery(
    { page: 1, search: debouncedSearch.trim() || undefined },
    { skip: !addDialogOpen },
  );
  const { data: editingInventoryItem } = useGetInventoryItemQuery(
    editingComponent?.inventoryItemId ?? '',
    { skip: !editingComponent },
  );

  const componentItemIds = useMemo(
    () => new Set(components.map((component) => component.inventoryItemId)),
    [components],
  );
  const availableItems = useMemo(
    () => inventoryData?.items.filter((item) => !componentItemIds.has(item.id)) ?? [],
    [componentItemIds, inventoryData?.items],
  );
  const maximumQuantity = editingComponent
    ? editingComponent.quantity + (editingInventoryItem?.count ?? 0)
    : selectedItem?.count ?? 0;
  const quantityIsValid = Number.isInteger(quantity)
    && quantity >= 1
    && quantity <= maximumQuantity;
  const isSaving = addState.isLoading || updateState.isLoading;

  useEffect(() => {
    if (!addDialogOpen) return;
    setSelectedItem(null);
    setSearch('');
    setQuantity(1);
  }, [addDialogOpen]);

  useEffect(() => {
    if (!editingComponent) return;
    setQuantity(editingComponent.quantity);
  }, [editingComponent]);

  const handleAdd = async () => {
    if (!selectedItem || !quantityIsValid) return;
    setActionError(undefined);
    setActionSuccess(undefined);
    try {
      await addComponent({
        type,
        workItemId,
        body: { inventoryItemId: selectedItem.id, quantity },
      }).unwrap();
      setActionSuccess(`Компонент «${selectedItem.name}» добавлен.`);
      setAddDialogOpen(false);
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось добавить компонент'));
    }
  };

  const handleUpdate = async () => {
    if (!editingComponent || !quantityIsValid || quantity === editingComponent.quantity) return;
    setActionError(undefined);
    setActionSuccess(undefined);
    try {
      await updateComponent({
        type,
        workItemId,
        componentId: editingComponent.id,
        body: { quantity },
      }).unwrap();
      setActionSuccess(`Количество компонента «${editingComponent.name}» изменено.`);
      setEditingComponent(null);
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось изменить количество'));
    }
  };

  const handleDelete = async (component: WorkItemComponent) => {
    if (!window.confirm(`Удалить компонент «${component.name}» и вернуть его на склад?`)) return;
    setActionError(undefined);
    setActionSuccess(undefined);
    try {
      await deleteComponent({ type, workItemId, componentId: component.id }).unwrap();
      setActionSuccess(`Компонент «${component.name}» возвращён на склад.`);
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось удалить компонент'));
    }
  };

  const renderQuantityControl = () => (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Button
        variant="outlined"
        aria-label="Уменьшить количество"
        onClick={() => setQuantity((current) => Math.max(1, current - 1))}
        disabled={quantity <= 1}
        sx={{ height: 56, minWidth: 48 }}
      >
        −
      </Button>
      <TextField
        label="Количество"
        type="number"
        value={quantity}
        onChange={(event) => setQuantity(Number(event.target.value))}
        error={maximumQuantity > 0 && !quantityIsValid}
        fullWidth
        slotProps={{ htmlInput: { min: 1, max: Math.max(1, maximumQuantity), step: 1 } }}
      />
      <Button
        variant="outlined"
        aria-label="Увеличить количество"
        onClick={() => setQuantity((current) => Math.min(maximumQuantity, current + 1))}
        disabled={maximumQuantity < 1 || quantity >= maximumQuantity}
        sx={{ height: 56, minWidth: 48 }}
      >
        +
      </Button>
    </Stack>
  );

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { sm: 'center' } }}
        >
          <Typography component="h2" variant="h5" sx={{ flexGrow: 1 }}>
            Компоненты склада
          </Typography>
          {canManage && !isCompleted && (
            <Button variant="contained" onClick={() => setAddDialogOpen(true)}>
              + Добавить компонент
            </Button>
          )}
        </Stack>

        {isCompleted && canManage && (
          <Alert severity="info">Компоненты выполненной карточки недоступны для изменений.</Alert>
        )}
        {actionError && <Alert severity="error">{actionError}</Alert>}
        {actionSuccess && <Alert severity="success">{actionSuccess}</Alert>}

        <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Наименование</TableCell>
                <TableCell align="right">Количество</TableCell>
                <TableCell>Добавил</TableCell>
                <TableCell>Дата добавления</TableCell>
                {canManage && !isCompleted && <TableCell align="center">Действия</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {components.length > 0 ? components.map((component) => (
                <TableRow key={component.id}>
                  <TableCell>{component.name}</TableCell>
                  <TableCell align="right">{component.quantity}</TableCell>
                  <TableCell>{component.addedByName}</TableCell>
                  <TableCell>{dateTimeFormatter.format(new Date(component.createdAt))}</TableCell>
                  {canManage && !isCompleted && (
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} sx={{ justifyContent: 'center' }}>
                        <Button size="small" onClick={() => setEditingComponent(component)}>
                          Изменить
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          disabled={deleteState.isLoading}
                          onClick={() => handleDelete(component)}
                        >
                          Удалить
                        </Button>
                      </Stack>
                    </TableCell>
                  )}
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell
                    colSpan={canManage && !isCompleted ? 5 : 4}
                    align="center"
                    sx={{ py: 4 }}
                  >
                    Компоненты не добавлены
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>

      <Dialog open={addDialogOpen} onClose={() => !isSaving && setAddDialogOpen(false)} fullWidth>
        <DialogTitle>Добавить компонент</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Autocomplete
              options={availableItems}
              value={selectedItem}
              inputValue={search}
              loading={inventoryIsFetching}
              filterOptions={(options) => options}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              getOptionDisabled={(option) => option.count < 1}
              onInputChange={(_event, value, reason) => {
                if (reason === 'input' || reason === 'clear') setSearch(value);
              }}
              onChange={(_event, value) => {
                setSelectedItem(value);
                setSearch(value?.name ?? '');
                setQuantity(1);
              }}
              noOptionsText="Компоненты не найдены"
              loadingText="Загрузка..."
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box>
                    <Typography>{option.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      На складе: {option.count}
                    </Typography>
                  </Box>
                </Box>
              )}
              renderInput={(params) => <TextField {...params} label="Компонент склада" />}
            />
            {selectedItem && (
              <Typography variant="body2" color="text.secondary">
                Доступно на складе: {selectedItem.count}
              </Typography>
            )}
            {renderQuantityControl()}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)} disabled={isSaving}>Отмена</Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!selectedItem || !quantityIsValid || isSaving}
          >
            Добавить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(editingComponent)}
        onClose={() => !isSaving && setEditingComponent(null)}
        fullWidth
      >
        <DialogTitle>Изменить количество</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Компонент склада" value={editingComponent?.name ?? ''} disabled />
            <Typography variant="body2" color="text.secondary">
              Можно установить до {maximumQuantity} шт. с учётом остатка на складе.
            </Typography>
            {renderQuantityControl()}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingComponent(null)} disabled={isSaving}>Отмена</Button>
          <Button
            variant="contained"
            onClick={handleUpdate}
            disabled={
              !editingComponent
              || !quantityIsValid
              || quantity === editingComponent.quantity
              || isSaving
            }
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
