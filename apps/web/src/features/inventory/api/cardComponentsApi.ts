import { api } from '../../../app/api';

export interface CardComponent {
  id: string;
  inventoryItemId: string;
  name: string;
  quantity: number;
  addedById: string | null;
  addedByName: string;
  addedAt: string;
}

export type CardTarget = { type: 'order' | 'repair'; id: string };
const url = ({ type, id }: CardTarget) => `/card-components/${type}/${id}`;
const tags = (target: CardTarget) => [
  'InventoryItems' as const,
  { type: 'CardComponents' as const, id: `${target.type}:${target.id}` },
];

export const cardComponentsApi = api.injectEndpoints({
  endpoints: builder => ({
    getCardComponents: builder.query<{ items: CardComponent[] }, CardTarget>({
      query: url,
      providesTags: (_result, _error, target) => [{ type: 'CardComponents', id: `${target.type}:${target.id}` }],
    }),
    addCardComponent: builder.mutation<void, CardTarget & { inventoryItemId: string; quantity: number }>({
      query: ({ type, id, inventoryItemId, quantity }) => ({ url: url({ type, id }), method: 'POST', body: { inventoryItemId, quantity } }),
      invalidatesTags: (_result, _error, target) => tags(target),
    }),
    updateCardComponent: builder.mutation<void, CardTarget & { componentId: string; quantity: number }>({
      query: ({ type, id, componentId, quantity }) => ({ url: `${url({ type, id })}/${componentId}`, method: 'PATCH', body: { quantity } }),
      invalidatesTags: (_result, _error, target) => tags(target),
    }),
    deleteCardComponent: builder.mutation<void, CardTarget & { componentId: string }>({
      query: ({ type, id, componentId }) => ({ url: `${url({ type, id })}/${componentId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, target) => tags(target),
    }),
  }),
});

export const {
  useGetCardComponentsQuery,
  useAddCardComponentMutation,
  useUpdateCardComponentMutation,
  useDeleteCardComponentMutation,
} = cardComponentsApi;
