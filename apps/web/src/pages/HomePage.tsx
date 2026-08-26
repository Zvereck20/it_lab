import { Box, Paper, Typography } from '@mui/material';

export const HomePage = () => (
  <Paper component="section" variant="outlined" sx={{ minHeight: 360, p: 4 }}>
    <Typography component="h1" variant="h4">
      Задачи
    </Typography>

    <Box
      sx={{
        minHeight: 260,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Typography color="text.secondary">Задач не найдено</Typography>
    </Box>
  </Paper>
);
