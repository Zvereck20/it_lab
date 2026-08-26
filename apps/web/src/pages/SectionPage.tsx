import { Paper, Stack, Typography } from '@mui/material';

interface SectionPageProps {
  title: string;
}

export const SectionPage = ({ title }: SectionPageProps) => (
  <Paper component="section" variant="outlined" sx={{ minHeight: 360, p: 4 }}>
    <Stack spacing={2}>
      <Typography component="h1" variant="h4">
        {title}
      </Typography>
      <Typography color="text.secondary">Раздел находится в разработке</Typography>
    </Stack>
  </Paper>
);
