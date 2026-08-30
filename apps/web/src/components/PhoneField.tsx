import { TextField } from '@mui/material';

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
}: PhoneFieldProps) => (
  <TextField
    label={label}
    name={name}
    value={formatRussianPhone(value)}
    onChange={(event) => {
      const subscriberDigits = getSubscriberDigits(event.target.value);
      onChange(subscriberDigits ? `+7${subscriberDigits}` : '');
    }}
    onBlur={onBlur}
    error={error}
    helperText={helperText ?? 'Формат: +7 (___) ___-__-__'}
    slotProps={{
      htmlInput: {
        inputMode: 'numeric',
        maxLength: 18,
        autoComplete: 'tel',
      },
      inputLabel: { shrink: true },
    }}
  />
);
