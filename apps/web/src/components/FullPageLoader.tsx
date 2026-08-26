import { Box, CircularProgress } from '@mui/material';

export const FullPageLoader = () => (
  <Box
    role="status"
    aria-label="Загрузка"
    sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}
  >
    <CircularProgress />
  </Box>
);
