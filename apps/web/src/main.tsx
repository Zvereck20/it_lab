import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

import { App } from './App';
import { store } from './app/store';

const popupBorder = '1px solid rgba(38, 50, 56, 0.45)';

const theme = createTheme({
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(38, 50, 56, 0.5)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(38, 50, 56, 0.8)',
          },
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          border: popupBorder,
          boxShadow: '0 8px 24px rgba(38, 50, 56, 0.18)',
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          border: popupBorder,
          boxShadow: '0 8px 24px rgba(38, 50, 56, 0.18)',
        },
      },
    },
  },
});
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element was not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <App />
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);
