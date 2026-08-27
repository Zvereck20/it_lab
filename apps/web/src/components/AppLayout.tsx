import { Box, Container } from '@mui/material';
import { Outlet } from 'react-router';

import { AppHeader } from './AppHeader';

export const AppLayout = () => (
  <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
    <AppHeader />
    <Container component="main" maxWidth="xl" sx={{ py: 4 }}>
      <Outlet />
    </Container>
  </Box>
);
