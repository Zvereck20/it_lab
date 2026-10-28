import type { InventoryAllocationTargetOption, InventoryItem } from '@itlab/contracts';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import {
  useAllocateInventoryItemMutation,
  useGetInventoryAllocationTargetsQuery,
} from '../features/inventory/api/inventoryApi';
import { getApiErrorMessage } from '../features/inventory/getApiErrorMessage';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface InventoryAllocationDialogProps {
  item: InventoryItem | null;
  open: boolean;
  onClose: () => void;
  onAllocated: (message: string) => void;
}

const targetKey = (target: InventoryAllocationTargetOption) =>
  `${target.type}:${target.id}`;

const formatOrdersCount = (count: number) => {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${count} заказов`;
  if (lastDigit === 1) return `${count} заказ`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} заказа`;
  return `${count} заказов`;
};

export const InventoryAllocationDialog = ({
  item,
  open,
  onClose,
  onAllocated,
}: InventoryAllocationDialogProps) => {
  const [search, setSearch] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<InventoryAllocationTargetOption[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string>();
  const debouncedSearch = useDebouncedValue(search);
  const { data, isFetching, isError } = useGetInventoryAllocationTargetsQuery(
    { search: debouncedSearch.trim() || undefined, limit: 20 },
    { skip: !open },
  );
  const [allocateItem, allocationState] = useAllocateInventoryItemMutation();

  const availableOptions = useMemo(() => {
    const selectedKeys = new Set(selectedTargets.map(targetKey));
    return data?.items.filter((target) => !selectedKeys.has(targetKey(target))) ?? [];
  }, [data, selectedTargets]);
  const maximumQuantity = selectedTargets.length > 0 && item
    ? Math.floor(item.count / selectedTargets.length)
    : item?.count ?? 0;
  const totalQuantity = quantity * selectedTargets.length;
  const quantityIsValid = quantity >= 1 && quantity <= maximumQuantity;

  useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedTargets([]);
      setQuantity(1);
      setError(undefined);
    }
  }, [open, item?.id]);

  useEffect(() => {
    if (maximumQuantity > 0 && quantity > maximumQuantity) {
      setQuantity(maximumQuantity);
    }
  }, [maximumQuantity, quantity]);

  const handleSubmit = async () => {
    if (!item || selectedTargets.length === 0 || !quantityIsValid) return;

    setError(undefined);
    try {
      const result = await allocateItem({
        id: item.id,
        body: {
          quantity,
          targets: selectedTargets.map(({ id, type }) => ({ id, type })),
        },
      }).unwrap();
      onAllocated(
        `«${item.name}» добавлен в ${formatOrdersCount(result.allocatedTargets)}. Остаток: ${result.remainingCount}.`,
      );
      onClose();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Не удалось добавить компонент'));
    }
  };

  return (
    <Dialog open={open} onClose={allocationState.isLoading ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{item?.name ?? 'Добавление компонента'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Typography color="text.secondary">
            На складе: {item?.count ?? 0} шт.
          </Typography>

          <Autocomplete<InventoryAllocationTargetOption>
            sx={{ '& .MuiAutocomplete-clearIndicator': { display: 'none' } }}
            options={availableOptions}
            value={null}
            inputValue={search}
            loading={isFetching}
            selectOnFocus
            filterOptions={(options) => options}
            getOptionLabel={(option) => option.number}
            getOptionDisabled={(option) => option.disabled}
            isOptionEqualToValue={(option, value) => targetKey(option) === targetKey(value)}
            onInputChange={(_event, inputValue, reason) => {
              if (
                (reason === 'input' || reason === 'clear')
                && /^[ЗРзр0-9\s-]*$/u.test(inputValue)
              ) {
                setSearch(inputValue);
              }
            }}
            onChange={(_event, target) => {
              if (target && !target.disabled) {
                setSelectedTargets((current) => [...current, target]);
                setSearch('');
              }
            }}
            noOptionsText="Заказы и ремонты не найдены"
            loadingText="Загрузка..."
            slotProps={{ listbox: { sx: { maxHeight: 240 } } }}
            renderOption={(props, option) => (
              <li {...props} key={targetKey(option)}>
                <Tooltip
                  title={option.disabled ? 'Выполненный заказ или ремонт нельзя изменить' : ''}
                  placement="right"
                >
                  <span>{option.number}</span>
                </Tooltip>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Номер заказа или ремонта"
                placeholder="Например, 125 или З-000125"
                error={isError}
                helperText={isError ? 'Не удалось загрузить список' : 'Поиск выполняется только по номеру'}
              />
            )}
          />

          <Box
            sx={{
              height: 126,
              overflowY: 'auto',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              px: 1.5,
              py: 0.5,
            }}
          >
            {selectedTargets.length > 0 ? (
              <FormGroup>
                {selectedTargets.map((target) => (
                  <FormControlLabel
                    key={targetKey(target)}
                    label={target.number}
                    sx={{ m: 0, minHeight: 38 }}
                    control={(
                      <Checkbox
                        size="small"
                        checked
                        onChange={() => setSelectedTargets((current) =>
                          current.filter((item) => targetKey(item) !== targetKey(target)))}
                      />
                    )}
                  />
                ))}
              </FormGroup>
            ) : (
              <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                <Typography color="text.secondary">Заказы не выбраны</Typography>
              </Box>
            )}
          </Box>

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
              label="Количество на каждый заказ"
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              error={selectedTargets.length > 0 && !quantityIsValid}
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

          {selectedTargets.length > 0 && (
            <Typography>
              Будет списано: {totalQuantity} шт. Остаток: {(item?.count ?? 0) - totalQuantity} шт.
            </Typography>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={allocationState.isLoading}>Отмена</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={
            allocationState.isLoading
            || selectedTargets.length === 0
            || !quantityIsValid
            || totalQuantity > (item?.count ?? 0)
          }
        >
          {allocationState.isLoading ? 'Добавление...' : 'Добавить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
