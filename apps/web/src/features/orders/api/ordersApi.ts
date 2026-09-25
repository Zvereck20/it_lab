import type {
  AdditionalCategory,
  AdditionalCategoryInput,
  MainCategory,
  MainCategoryInput,
  Order,
  OrderCategoriesResponse,
  OrderDetails,
  OrderInput,
  OrderListQuery,
  OrderListResponse,
  OrderStatusInput,
} from '@itlab/contracts';

import { api } from '../../../app/api';

interface UpdateEntity<T> {
  id: string;
  body: T;
}

export const ordersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getOrderCategories: builder.query<OrderCategoriesResponse, void>({
      query: () => '/orders/categories',
      providesTags: ['OrderCategories'],
    }),
    createOrderMainCategory: builder.mutation<MainCategory, MainCategoryInput>({
      query: (body) => ({ url: '/orders/categories/main', method: 'POST', body }),
      invalidatesTags: ['OrderCategories'],
    }),
    updateOrderMainCategory: builder.mutation<
      MainCategory,
      UpdateEntity<MainCategoryInput>
    >({
      query: ({ id, body }) => ({
        url: `/orders/categories/main/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['OrderCategories', 'Orders'],
    }),
    deleteOrderMainCategory: builder.mutation<void, string>({
      query: (id) => ({ url: `/orders/categories/main/${id}`, method: 'DELETE' }),
      invalidatesTags: ['OrderCategories'],
    }),
    createOrderAdditionalCategory: builder.mutation<
      AdditionalCategory,
      AdditionalCategoryInput
    >({
      query: (body) => ({ url: '/orders/categories/additional', method: 'POST', body }),
      invalidatesTags: ['OrderCategories'],
    }),
    updateOrderAdditionalCategory: builder.mutation<
      AdditionalCategory,
      UpdateEntity<AdditionalCategoryInput>
    >({
      query: ({ id, body }) => ({
        url: `/orders/categories/additional/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['OrderCategories', 'Orders'],
    }),
    deleteOrderAdditionalCategory: builder.mutation<void, string>({
      query: (id) => ({ url: `/orders/categories/additional/${id}`, method: 'DELETE' }),
      invalidatesTags: ['OrderCategories'],
    }),
    getOrders: builder.query<OrderListResponse, OrderListQuery>({
      query: (params) => ({ url: '/orders', params }),
      providesTags: ['Orders'],
    }),
    getOrder: builder.query<OrderDetails, string>({
      query: (id) => `/orders/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Orders', id }],
    }),
    createOrder: builder.mutation<Order, OrderInput>({
      query: (body) => ({ url: '/orders', method: 'POST', body }),
      invalidatesTags: ['Orders'],
    }),
    updateOrder: builder.mutation<Order, UpdateEntity<OrderInput>>({
      query: ({ id, body }) => ({ url: `/orders/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, { id }) => ['Orders', { type: 'Orders', id }],
    }),
    takeOrder: builder.mutation<Order, string>({
      query: (id) => ({ url: `/orders/${id}/take`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => ['Orders', { type: 'Orders', id }],
    }),
    updateOrderStatus: builder.mutation<
      Order,
      { id: string; body: OrderStatusInput }
    >({
      query: ({ id, body }) => ({ url: `/orders/${id}/status`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, { id }) => ['Orders', { type: 'Orders', id }],
    }),
    deleteOrder: builder.mutation<void, string>({
      query: (id) => ({ url: `/orders/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Orders'],
    }),
  }),
});

export const {
  useGetOrderCategoriesQuery,
  useCreateOrderMainCategoryMutation,
  useUpdateOrderMainCategoryMutation,
  useDeleteOrderMainCategoryMutation,
  useCreateOrderAdditionalCategoryMutation,
  useUpdateOrderAdditionalCategoryMutation,
  useDeleteOrderAdditionalCategoryMutation,
  useGetOrdersQuery,
  useGetOrderQuery,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useTakeOrderMutation,
  useUpdateOrderStatusMutation,
  useDeleteOrderMutation,
} = ordersApi;
