import { Navigate, Route, Routes } from 'react-router';

import { AppLayout } from './components/AppLayout';
import { GuestRoute } from './components/GuestRoute';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleRoute } from './components/RoleRoute';
import { HomePage } from './pages/HomePage';
import { InventoryCategoriesPage } from './pages/InventoryCategoriesPage';
import { InventoryItemFormPage } from './pages/InventoryItemFormPage';
import { LoginPage } from './pages/LoginPage';
import { SectionPage } from './pages/SectionPage';
import { WarehousePage } from './pages/WarehousePage';

export const App = () => (
  <Routes>
    <Route element={<GuestRoute />}>
      <Route path="/login" element={<LoginPage />} />
    </Route>

    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/warehouse" element={<WarehousePage />} />
        <Route element={<RoleRoute allowedRoles={['ADMIN']} />}>
          <Route path="/warehouse/categories" element={<InventoryCategoriesPage />} />
        </Route>
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'MANAGER']} />}>
          <Route path="/warehouse/new" element={<InventoryItemFormPage />} />
          <Route path="/warehouse/:id/edit" element={<InventoryItemFormPage />} />
        </Route>
        <Route
          path="/orders"
          element={<SectionPage title="Заказы" />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Route>
  </Routes>
);
