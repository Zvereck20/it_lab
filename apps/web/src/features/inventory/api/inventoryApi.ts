import type {
  AdditionalCategory,
  AdditionalCategoryInput,
  InventoryCategoriesResponse,
  InventoryAllocationInput,
  InventoryAllocationResponse,
  InventoryAllocationTargetsQuery,
  InventoryAllocationTargetsResponse,
  InventoryItem,
  InventoryItemInput,
  InventoryListQuery,
  InventoryListResponse,
  MainCategory,
  MainCategoryInput,
  WorkItemComponent,
  WorkItemComponentInput,
  WorkItemComponentQuantityInput,
} from '@itlab/contracts';

import { api } from '../../../app/api';

interface UpdateEntity<T> {
  id: string;
  body: T;
}

export type WorkItemType = 'order' | 'repair';

interface WorkItemComponentTarget {
  type: WorkItemType;
  workItemId: string;
}

interface UpdateWorkItemComponent extends WorkItemComponentTarget {
  componentId: string;
  body: WorkItemComponentQuantityInput;
}

interface DeleteWorkItemComponent extends WorkItemComponentTarget {
  componentId: string;
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
    getInventoryAllocationTargets: builder.query<
      InventoryAllocationTargetsResponse,
      InventoryAllocationTargetsQuery
    >({
      query: (params) => ({
        url: '/inventory/allocation-targets',
        params,
      }),
    }),
    allocateInventoryItem: builder.mutation<
      InventoryAllocationResponse,
      { id: string; body: InventoryAllocationInput }
    >({
      query: ({ id, body }) => ({
        url: `/inventory/items/${id}/allocate`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        'InventoryItems',
        { type: 'InventoryItems', id },
        'Orders',
        'Repairs',
      ],
    }),
    addWorkItemComponent: builder.mutation<
      WorkItemComponent,
      WorkItemComponentTarget & { body: WorkItemComponentInput }
    >({
      query: ({ type, workItemId, body }) => ({
        url: `/inventory/work-items/${type}/${workItemId}/components`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { type, workItemId }) => [
        'InventoryItems',
        { type: type === 'order' ? 'Orders' : 'Repairs', id: workItemId },
      ],
    }),
    updateWorkItemComponent: builder.mutation<WorkItemComponent, UpdateWorkItemComponent>({
      query: ({ type, workItemId, componentId, body }) => ({
        url: `/inventory/work-items/${type}/${workItemId}/components/${componentId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { type, workItemId }) => [
        'InventoryItems',
        { type: type === 'order' ? 'Orders' : 'Repairs', id: workItemId },
      ],
    }),
    deleteWorkItemComponent: builder.mutation<void, DeleteWorkItemComponent>({
      query: ({ type, workItemId, componentId }) => ({
        url: `/inventory/work-items/${type}/${workItemId}/components/${componentId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { type, workItemId }) => [
        'InventoryItems',
        { type: type === 'order' ? 'Orders' : 'Repairs', id: workItemId },
      ],
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
  useGetInventoryAllocationTargetsQuery,
  useAllocateInventoryItemMutation,
  useAddWorkItemComponentMutation,
  useUpdateWorkItemComponentMutation,
  useDeleteWorkItemComponentMutation,
  useCreateInventoryItemMutation,
  useUpdateInventoryItemMutation,
  useDeleteInventoryItemMutation,
} = inventoryApi;
