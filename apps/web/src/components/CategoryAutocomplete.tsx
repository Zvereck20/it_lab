import {
  Autocomplete,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Stack,
  TextField,
} from '@mui/material';
import { useState } from 'react';

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
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const selectedOption = options.find((option) => option.id === value) ?? null;

  return (
    <Autocomplete
      options={options}
      value={selectedOption}
      disabled={disabled}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      filterOptions={(availableOptions) => filterBySearch(availableOptions, debouncedSearch)}
      onInputChange={(_event, inputValue, reason) => {
        setSearch(reason === 'input' ? inputValue : '');
      }}
      onChange={(_event, option) => onChange(option?.id ?? '')}
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

  return (
    <Stack spacing={1}>
      <Autocomplete
        multiple
        filterSelectedOptions
        options={options}
        value={selectedOptions}
        disabled={disabled}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, selected) => option.id === selected.id}
        filterOptions={(availableOptions) => filterBySearch(availableOptions, debouncedSearch)}
        onInputChange={(_event, inputValue, reason) => {
          setSearch(reason === 'input' ? inputValue : '');
        }}
        onChange={(_event, selected) => onChange(selected.map((option) => option.id))}
        renderValue={() => null}
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
