import type {
  AdditionalCategory,
  AdditionalCategoryInput,
  InventoryCategoriesResponse,
  InventoryItem,
  InventoryItemInput,
  InventoryListQuery,
  InventoryListResponse,
  MainCategory,
  MainCategoryInput,
} from '@itlab/contracts';

import { api } from '../../../app/api';

interface UpdateEntity<T> {
  id: string;
  body: T;
}

export const inventoryApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getInventoryCategories: builder.query<InventoryCategoriesResponse, void>({
      query: () => '/inventory/categories',
      providesTags: ['InventoryCategories'],
    }),
    createMainCategory: builder.mutation<MainCategory, MainCategoryInput>({
      query: (body) => ({
        url: '/inventory/categories/main',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['InventoryCategories'],
    }),
    updateMainCategory: builder.mutation<MainCategory, UpdateEntity<MainCategoryInput>>({
      query: ({ id, body }) => ({
        url: `/inventory/categories/main/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['InventoryCategories', 'InventoryItems'],
    }),
    deleteMainCategory: builder.mutation<void, string>({
      query: (id) => ({
        url: `/inventory/categories/main/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['InventoryCategories'],
    }),
    createAdditionalCategory: builder.mutation<AdditionalCategory, AdditionalCategoryInput>({
      query: (body) => ({
        url: '/inventory/categories/additional',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['InventoryCategories'],
    }),
    updateAdditionalCategory: builder.mutation<
      AdditionalCategory,
      UpdateEntity<AdditionalCategoryInput>
    >({
      query: ({ id, body }) => ({
        url: `/inventory/categories/additional/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['InventoryCategories', 'InventoryItems'],
    }),
    deleteAdditionalCategory: builder.mutation<void, string>({
      query: (id) => ({
        url: `/inventory/categories/additional/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['InventoryCategories'],
    }),
    getInventoryItems: builder.query<InventoryListResponse, InventoryListQuery>({
      query: (params) => ({
        url: '/inventory/items',
        params,
      }),
      providesTags: ['InventoryItems'],
    }),
    getInventoryItem: builder.query<InventoryItem, string>({
      query: (id) => `/inventory/items/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'InventoryItems', id }],
    }),
    createInventoryItem: builder.mutation<InventoryItem, InventoryItemInput>({
      query: (body) => ({
        url: '/inventory/items',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['InventoryItems'],
    }),
    updateInventoryItem: builder.mutation<InventoryItem, UpdateEntity<InventoryItemInput>>({
      query: ({ id, body }) => ({
        url: `/inventory/items/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        'InventoryItems',
        { type: 'InventoryItems', id },
      ],
    }),
    deleteInventoryItem: builder.mutation<void, string>({
      query: (id) => ({
        url: `/inventory/items/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['InventoryItems'],
    }),
  }),
});

export const {
  useGetInventoryCategoriesQuery,
  useCreateMainCategoryMutation,
  useUpdateMainCategoryMutation,
  useDeleteMainCategoryMutation,
  useCreateAdditionalCategoryMutation,
  useUpdateAdditionalCategoryMutation,
  useDeleteAdditionalCategoryMutation,
  useGetInventoryItemsQuery,
  useGetInventoryItemQuery,
  useCreateInventoryItemMutation,
  useUpdateInventoryItemMutation,
  useDeleteInventoryItemMutation,
} = inventoryApi;
