import type { AuthResponse, LoginRequest } from '@itlab/contracts';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

interface HealthResponse {
  status: 'ok';
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    credentials: 'include',
  }),
  tagTypes: ['Session', 'InventoryItems', 'InventoryCategories'],
  endpoints: (builder) => ({
    getHealth: builder.query<HealthResponse, void>({
      query: () => '/health',
    }),
    getSession: builder.query<AuthResponse, void>({
      query: () => '/auth/session',
      providesTags: ['Session'],
    }),
    login: builder.mutation<AuthResponse, LoginRequest>({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Session'],
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: ['Session'],
    }),
  }),
});

export const {
  useGetHealthQuery,
  useGetSessionQuery,
  useLoginMutation,
  useLogoutMutation,
} = api;
