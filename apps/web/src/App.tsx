import { Navigate, Route, Routes } from 'react-router';

import { AppLayout } from './components/AppLayout';
import { GuestRoute } from './components/GuestRoute';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { SectionPage } from './pages/SectionPage';

export const App = () => (
  <Routes>
    <Route element={<GuestRoute />}>
      <Route path="/login" element={<LoginPage />} />
    </Route>

    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/warehouse"
          element={<SectionPage title="Склад" />}
        />
        <Route
          path="/orders"
          element={<SectionPage title="Заказы" />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Route>
  </Routes>
);
