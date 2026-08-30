import type {
  Repair,
  RepairDetails,
  RepairInput,
  RepairListQuery,
  RepairListResponse,
  RepairStatusInput,
} from '@itlab/contracts';

import { api } from '../../../app/api';

interface UpdateRepairRequest {
  id: string;
  body: RepairInput;
}

export const repairsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getRepairs: builder.query<RepairListResponse, RepairListQuery>({
      query: (params) => ({ url: '/repairs', params }),
      providesTags: ['Repairs'],
    }),
    getRepair: builder.query<RepairDetails, string>({
      query: (id) => `/repairs/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Repairs', id }],
    }),
    createRepair: builder.mutation<Repair, RepairInput>({
      query: (body) => ({ url: '/repairs', method: 'POST', body }),
      invalidatesTags: ['Repairs'],
    }),
    updateRepair: builder.mutation<Repair, UpdateRepairRequest>({
      query: ({ id, body }) => ({ url: `/repairs/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, { id }) => [
        'Repairs',
        { type: 'Repairs', id },
      ],
    }),
    takeRepair: builder.mutation<Repair, string>({
      query: (id) => ({ url: `/repairs/${id}/take`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [
        'Repairs',
        { type: 'Repairs', id },
      ],
    }),
    updateRepairStatus: builder.mutation<
      Repair,
      { id: string; body: RepairStatusInput }
    >({
      query: ({ id, body }) => ({
        url: `/repairs/${id}/status`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        'Repairs',
        { type: 'Repairs', id },
      ],
    }),
    deleteRepair: builder.mutation<void, string>({
      query: (id) => ({ url: `/repairs/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Repairs'],
    }),
  }),
});

export const {
  useGetRepairsQuery,
  useGetRepairQuery,
  useCreateRepairMutation,
  useUpdateRepairMutation,
  useTakeRepairMutation,
  useUpdateRepairStatusMutation,
  useDeleteRepairMutation,
} = repairsApi;
