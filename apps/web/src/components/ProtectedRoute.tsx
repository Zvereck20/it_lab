import { Navigate, Outlet, useLocation } from 'react-router';

import { useGetSessionQuery } from '../app/api';
import { FullPageLoader } from './FullPageLoader';

export const ProtectedRoute = () => {
  const location = useLocation();
  const { data, isLoading } = useGetSessionQuery();

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!data?.user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};
