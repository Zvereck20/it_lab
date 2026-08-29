import type { AuthRole } from '@itlab/contracts';
import { Navigate, Outlet } from 'react-router';

import { useGetSessionQuery } from '../app/api';

interface RoleRouteProps {
  allowedRoles: AuthRole[];
}

export const RoleRoute = ({ allowedRoles }: RoleRouteProps) => {
  const { data } = useGetSessionQuery();
  const role = data?.user.role;

  if (!role || (role !== 'ADMIN' && !allowedRoles.includes(role))) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
