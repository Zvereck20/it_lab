import {
  Autocomplete,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Stack,
  TextField,
} from '@mui/material';
import { useEffect, useState } from 'react';

import { useDebouncedValue } from '../hooks/useDebouncedValue';

export interface CategoryOption {
  id: string;
  name: string;
}

interface CategoryAutocompleteProps {
  label: string;
  options: CategoryOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
}

interface MultipleCategoryAutocompleteProps {
  label: string;
  options: CategoryOption[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
}

const filterBySearch = (options: CategoryOption[], search: string) => {
  const normalizedSearch = search.trim().toLocaleLowerCase('ru-RU');

  if (!normalizedSearch) {
    return options;
  }

  return options.filter((option) =>
    option.name.toLocaleLowerCase('ru-RU').includes(normalizedSearch));
};

const listboxSlotProps = {
  sx: {
    maxHeight: 240,
  },
};

export const CategoryAutocomplete = ({
  label,
  options,
  value,
  onChange,
  disabled,
  error,
  helperText,
}: CategoryAutocompleteProps) => {
  const selectedOption = options.find((option) => option.id === value) ?? null;
  const [inputValue, setInputValue] = useState(selectedOption?.name ?? '');
  const debouncedSearch = useDebouncedValue(inputValue);

  useEffect(() => {
    setInputValue(selectedOption?.name ?? '');
  }, [selectedOption?.id, selectedOption?.name]);

  return (
    <Autocomplete
      sx={{ '& .MuiAutocomplete-clearIndicator': { display: 'none' } }}
      options={options}
      value={selectedOption}
      inputValue={inputValue}
      disabled={disabled}
      selectOnFocus
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      filterOptions={(availableOptions) => filterBySearch(availableOptions, debouncedSearch)}
      onInputChange={(_event, inputValue, reason) => {
        if (reason === 'input' || reason === 'clear') {
          setInputValue(inputValue);
        }
      }}
      onChange={(_event, option) => {
        onChange(option?.id ?? '');
        setInputValue(option?.name ?? '');
      }}
      noOptionsText="Категории не найдены"
      slotProps={{ listbox: listboxSlotProps }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={error}
          helperText={helperText}
        />
      )}
    />
  );
};

export const MultipleCategoryAutocomplete = ({
  label,
  options,
  value,
  onChange,
  disabled,
  error,
  helperText,
}: MultipleCategoryAutocompleteProps) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const selectedOptions = options.filter((option) => value.includes(option.id));
  const availableOptions = options.filter((option) => !value.includes(option.id));

  return (
    <Stack spacing={1}>
      <Autocomplete
        sx={{ '& .MuiAutocomplete-clearIndicator': { display: 'none' } }}
        options={availableOptions}
        value={null}
        inputValue={search}
        disabled={disabled}
        selectOnFocus
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, selected) => option.id === selected.id}
        filterOptions={(availableOptions) => filterBySearch(availableOptions, debouncedSearch)}
        onInputChange={(_event, inputValue, reason) => {
          if (reason === 'input' || reason === 'clear') {
            setSearch(inputValue);
          }
        }}
        onChange={(_event, selected) => {
          if (selected) {
            onChange([...value, selected.id]);
            setSearch('');
          }
        }}
        noOptionsText="Категории не найдены"
        slotProps={{ listbox: listboxSlotProps }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            error={error}
            helperText={helperText}
          />
        )}
      />

      {selectedOptions.length > 0 && (
        <FormGroup>
          {selectedOptions.map((option) => (
            <FormControlLabel
              key={option.id}
              label={option.name}
              control={(
                <Checkbox
                  checked
                  onChange={() => onChange(value.filter((id) => id !== option.id))}
                />
              )}
            />
          ))}
        </FormGroup>
      )}
    </Stack>
  );
};
