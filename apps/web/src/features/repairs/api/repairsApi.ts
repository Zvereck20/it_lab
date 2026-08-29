import type {
  Repair,
  RepairInput,
  RepairListQuery,
  RepairListResponse,
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
    getRepair: builder.query<Repair, string>({
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
  useDeleteRepairMutation,
} = repairsApi;
