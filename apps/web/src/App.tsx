import { Navigate, Route, Routes } from 'react-router';

import { AppLayout } from './components/AppLayout';
import { GuestRoute } from './components/GuestRoute';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleRoute } from './components/RoleRoute';
import { EmployeesPage } from './pages/EmployeesPage';
import { HomePage } from './pages/HomePage';
import { InventoryCategoriesPage } from './pages/InventoryCategoriesPage';
import { InventoryItemFormPage } from './pages/InventoryItemFormPage';
import { LoginPage } from './pages/LoginPage';
import { RepairFormPage } from './pages/RepairFormPage';
import { RepairDetailsPage } from './pages/RepairDetailsPage';
import { RepairsPage } from './pages/RepairsPage';
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
          <Route path="/employees" element={<EmployeesPage />} />
        </Route>
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'MANAGER']} />}>
          <Route path="/warehouse/new" element={<InventoryItemFormPage />} />
          <Route path="/warehouse/:id/edit" element={<InventoryItemFormPage />} />
          <Route path="/repairs/new" element={<RepairFormPage />} />
          <Route path="/repairs/:id/edit" element={<RepairFormPage />} />
        </Route>
        <Route path="/repairs" element={<RepairsPage />} />
        <Route path="/repairs/:id" element={<RepairDetailsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Route>
  </Routes>
);
