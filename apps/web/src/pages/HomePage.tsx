import { Box, Button, Chip, Container, Paper, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router';

import { api, useGetSessionQuery, useLogoutMutation } from '../app/api';
import { useAppDispatch } from '../app/store';

export const HomePage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { data } = useGetSessionQuery();
  const [logout, { isLoading }] = useLogoutMutation();

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } finally {
      dispatch(api.util.resetApiState());
      navigate('/login', { replace: true });
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', py: 4 }}>
        <Paper component="main" elevation={3} sx={{ width: '100%', p: 4 }}>
          <Stack spacing={3}>
            <Box>
              <Typography component="h1" variant="h3" gutterBottom>
                Айтилаб
              </Typography>
              <Typography color="text.secondary">
                Начальная страница CRM. Рабочие разделы будут добавлены позже.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <Typography>Пользователь: {data?.user.login}</Typography>
              <Chip label={data?.user.role} color="primary" variant="outlined" />
            </Stack>

            <Box>
              <Button variant="outlined" onClick={handleLogout} disabled={isLoading}>
                {isLoading ? 'Выход...' : 'Выйти'}
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Box>
    </Container>
  );
};
