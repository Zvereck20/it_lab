import type { ApiError, LoginRequest } from '@itlab/contracts';
import { loginRequestSchema } from '@itlab/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';

import { api, useLoginMutation } from '../app/api';
import { useAppDispatch } from '../app/store';

interface LocationState {
  from?: string;
}

const getErrorMessage = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return 'Не удалось выполнить вход. Попробуйте позже';
  }

  const apiError = error as { status?: number | string; data?: Partial<ApiError> };

  if (apiError.status === 'FETCH_ERROR') {
    return 'Не удалось связаться с сервером';
  }

  return apiError.data?.message ?? 'Не удалось выполнить вход. Попробуйте позже';
};

export const LoginPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [login, { isLoading }] = useLoginMutation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: {
      login: '',
      password: '',
    },
  });

  const onSubmit = handleSubmit(async (credentials) => {
    try {
      const authData = await login(credentials).unwrap();
      dispatch(api.util.upsertQueryData('getSession', undefined, authData));

      const state = location.state as LocationState | null;
      navigate(state?.from ?? '/', { replace: true });
    } catch (error) {
      setError('root', { message: getErrorMessage(error) });
    }
  });

  return (
    <Container maxWidth="xs">
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', py: 4 }}>
        <Paper component="main" elevation={4} sx={{ width: '100%', p: 4 }}>
          <Stack component="form" spacing={3} onSubmit={onSubmit} noValidate>
            <Box>
              <Typography component="h1" variant="h4" gutterBottom>
                Айтилаб
              </Typography>
              <Typography color="text.secondary">
                Войдите в CRM сервисного центра
              </Typography>
            </Box>

            {errors.root?.message && (
              <Alert severity="error">{errors.root.message}</Alert>
            )}

            <TextField
              label="Логин"
              autoComplete="username"
              autoFocus
              error={Boolean(errors.login)}
              helperText={errors.login?.message}
              {...register('login')}
            />

            <TextField
              label="Пароль"
              type="password"
              autoComplete="current-password"
              error={Boolean(errors.password)}
              helperText={errors.password?.message}
              {...register('password')}
            />

            <Button type="submit" variant="contained" size="large" disabled={isLoading}>
              {isLoading ? 'Вход...' : 'Войти'}
            </Button>
          </Stack>
        </Paper>
      </Box>
    </Container>
  );
};
