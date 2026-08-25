import { Box, Chip, Container, Paper, Stack, Typography } from '@mui/material';

import { useGetHealthQuery } from './app/api';

export const App = () => {
  const { data, isError, isLoading } = useGetHealthQuery();

  const statusLabel = isLoading
    ? 'Проверка API'
    : isError
      ? 'API недоступен'
      : data?.status === 'ok'
        ? 'API работает'
        : 'Нет данных';

  const statusColor = data?.status === 'ok' ? 'success' : isError ? 'error' : 'default';

  return (
    <Container maxWidth="sm">
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', py: 4 }}>
        <Paper elevation={3} sx={{ width: '100%', p: 4 }}>
          <Stack spacing={2} alignItems="flex-start">
            <Typography component="h1" variant="h3">
              Айтилаб
            </Typography>
            <Typography color="text.secondary">
              Фундамент CRM для сервисного центра готов к разработке.
            </Typography>
            <Chip label={statusLabel} color={statusColor} variant="outlined" />
          </Stack>
        </Paper>
      </Box>
    </Container>
  );
};
