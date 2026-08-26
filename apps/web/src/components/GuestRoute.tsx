import { Navigate, Outlet } from 'react-router';

import { useGetSessionQuery } from '../app/api';
import { FullPageLoader } from './FullPageLoader';

export const GuestRoute = () => {
  const { data, isLoading } = useGetSessionQuery();

  if (isLoading) {
    return <FullPageLoader />;
  }

  return data?.user ? <Navigate to="/" replace /> : <Outlet />;
};
