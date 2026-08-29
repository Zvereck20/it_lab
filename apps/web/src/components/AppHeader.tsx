import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router';

import { api, useGetSessionQuery, useLogoutMutation } from '../app/api';
import { useAppDispatch } from '../app/store';

const navigationItems = [
  { label: 'Задачи', path: '/', end: true },
  { label: 'Склад', path: '/warehouse' },
  { label: 'Ремонт', path: '/repairs' },
];

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export const AppHeader = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { data } = useGetSessionQuery();
  const [logout, { isLoading }] = useLogoutMutation();
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentDate(new Date()), 1_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } finally {
      dispatch(api.util.resetApiState());
      navigate('/login', { replace: true });
    }
  };

  const displayName = data?.user.name
    ?? (data?.user.role === 'ADMIN' ? 'Администратор' : data?.user.login);

  return (
    <AppBar component="header" position="sticky" color="inherit" elevation={1}>
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ minHeight: 72, py: 1 }}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={2}
            sx={{
              width: '100%',
              alignItems: { xs: 'stretch', lg: 'center' },
            }}
          >
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <IconButton
                aria-label="Вернуться назад"
                onClick={() => navigate(-1)}
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
              >
                <Typography component="span" aria-hidden sx={{ fontSize: 24, lineHeight: 1 }}>
                  ←
                </Typography>
              </IconButton>

              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                {dateTimeFormatter.format(currentDate)}
              </Typography>
            </Stack>

            <Stack
              component="nav"
              aria-label="Основная навигация"
              direction="row"
              spacing={1}
              sx={{ flexGrow: 1, flexWrap: 'wrap' }}
            >
              {navigationItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  style={{ textDecoration: 'none' }}
                >
                  {({ isActive }) => (
                    <Button variant={isActive ? 'contained' : 'text'}>
                      {item.label}
                    </Button>
                  )}
                </NavLink>
              ))}
              {data?.user.role === 'ADMIN' && (
                <NavLink to="/employees" style={{ textDecoration: 'none' }}>
                  {({ isActive }) => (
                    <Button variant={isActive ? 'contained' : 'text'}>
                      Сотрудники
                    </Button>
                  )}
                </NavLink>
              )}
            </Stack>

            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {displayName}
                </Typography>
                <Chip
                  label={data?.user.role}
                  color="primary"
                  variant="outlined"
                  size="small"
                />
              </Box>

              <Button variant="outlined" onClick={handleLogout} disabled={isLoading}>
                {isLoading ? 'Выход...' : 'Выйти'}
              </Button>
            </Stack>
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  );
};
