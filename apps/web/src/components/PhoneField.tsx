import { TextField } from '@mui/material';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { useRef } from 'react';

interface PhoneFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  error?: boolean;
  helperText?: string;
}

const getSubscriberDigits = (value: string) => {
  const digits = value.replace(/\D/g, '');
  const withoutCountryCode = digits.startsWith('7') || digits.startsWith('8')
    ? digits.slice(1)
    : digits;

  return withoutCountryCode.slice(0, 10);
};

const getSubscriberPositions = (formattedValue: string) => {
  const positions: number[] = [];

  for (let index = 4; index < formattedValue.length; index += 1) {
    if (/\d/.test(formattedValue[index])) {
      positions.push(index);
    }
  }

  return positions;
};

const getCaretAfterDigitCount = (formattedValue: string, digitCount: number) => {
  const positions = getSubscriberPositions(formattedValue);

  if (digitCount <= 0) {
    return Math.min(4, formattedValue.length);
  }

  return positions[digitCount - 1] === undefined
    ? formattedValue.length
    : positions[digitCount - 1] + 1;
};

const getCaretBeforeDigit = (formattedValue: string, digitIndex: number) =>
  getSubscriberPositions(formattedValue)[digitIndex] ?? formattedValue.length;

const findPreviousDigitIndex = (positions: number[], caretPosition: number) => {
  for (let index = positions.length - 1; index >= 0; index -= 1) {
    if (positions[index] < caretPosition) return index;
  }

  return -1;
};

export const formatRussianPhone = (value: string) => {
  if (value && !/\d/.test(value)) {
    return value;
  }

  const digits = getSubscriberDigits(value);
  const areaCode = digits.slice(0, 3);
  const firstPart = digits.slice(3, 6);
  const secondPart = digits.slice(6, 8);
  const thirdPart = digits.slice(8, 10);

  let formatted = '+7 (';
  formatted += areaCode;

  if (areaCode.length === 3) {
    formatted += ')';
  }
  if (firstPart) {
    formatted += ` ${firstPart}`;
  }
  if (secondPart) {
    formatted += `-${secondPart}`;
  }
  if (thirdPart) {
    formatted += `-${thirdPart}`;
  }

  return formatted;
};

export const PhoneField = ({
  label = 'Телефон',
  value,
  onChange,
  onBlur,
  name,
  error,
  helperText,
}: PhoneFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const restoreCaret = (position: number) => {
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(position, position));
  };

  const changeDigits = (subscriberDigits: string, caretDigitIndex: number) => {
    const normalizedValue = subscriberDigits ? `+7${subscriberDigits}` : '';
    const formattedValue = formatRussianPhone(normalizedValue);

    onChange(normalizedValue);
    restoreCaret(getCaretBeforeDigit(formattedValue, caretDigitIndex));
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const rawValue = event.target.value;
    const caretPosition = event.target.selectionStart ?? rawValue.length;
    const subscriberDigits = getSubscriberDigits(rawValue);
    const digitsBeforeCaret = getSubscriberDigits(rawValue.slice(0, caretPosition)).length;
    const normalizedValue = subscriberDigits ? `+7${subscriberDigits}` : '';
    const formattedValue = formatRussianPhone(normalizedValue);

    onChange(normalizedValue);
    restoreCaret(getCaretAfterDigitCount(formattedValue, digitsBeforeCaret));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key.length === 1 && !/\d/.test(event.key) && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      return;
    }

    if (event.key !== 'Backspace' && event.key !== 'Delete') {
      return;
    }

    const formattedValue = formatRussianPhone(value);
    const positions = getSubscriberPositions(formattedValue);
    const selectionStart = event.currentTarget.selectionStart ?? formattedValue.length;
    const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart;
    const subscriberDigits = getSubscriberDigits(value).split('');
    let indexesToDelete = positions
      .map((position, index) => ({ position, index }))
      .filter(({ position }) => position >= selectionStart && position < selectionEnd)
      .map(({ index }) => index);

    if (indexesToDelete.length === 0 && selectionStart === selectionEnd) {
      if (event.key === 'Backspace') {
        const previousIndex = findPreviousDigitIndex(positions, selectionStart);
        if (previousIndex >= 0) indexesToDelete = [previousIndex];
      } else {
        const nextIndex = positions.findIndex((position) => position >= selectionStart);
        if (nextIndex >= 0) indexesToDelete = [nextIndex];
      }
    }

    if (indexesToDelete.length === 0) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    const firstDeletedIndex = indexesToDelete[0];
    const indexesSet = new Set(indexesToDelete);
    changeDigits(
      subscriberDigits.filter((_digit, index) => !indexesSet.has(index)).join(''),
      firstDeletedIndex,
    );
  };

  return (
    <TextField
      label={label}
      name={name}
      value={formatRussianPhone(value)}
      inputRef={inputRef}
      onChange={handleChange}
      onBlur={onBlur}
      error={error}
      helperText={helperText ?? 'Формат: +7 (___) ___-__-__'}
      slotProps={{
        htmlInput: {
          inputMode: 'numeric',
          maxLength: 18,
          autoComplete: 'tel',
          onKeyDown: handleKeyDown,
        },
        inputLabel: { shrink: true },
      }}
    />
  );
};
