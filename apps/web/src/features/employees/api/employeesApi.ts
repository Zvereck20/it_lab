import type {
  Employee,
  EmployeeCreateInput,
  EmployeesResponse,
  EmployeeUpdateInput,
} from '@itlab/contracts';

import { api } from '../../../app/api';

interface UpdateEmployeeRequest {
  id: string;
  body: EmployeeUpdateInput;
}

export const employeesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getEmployees: builder.query<EmployeesResponse, void>({
      query: () => '/employees',
      providesTags: ['Employees'],
    }),
    getTechnicians: builder.query<EmployeesResponse, void>({
      query: () => '/employees/technicians',
      providesTags: ['Technicians'],
    }),
    createEmployee: builder.mutation<Employee, EmployeeCreateInput>({
      query: (body) => ({
        url: '/employees',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Employees', 'Technicians'],
    }),
    updateEmployee: builder.mutation<Employee, UpdateEmployeeRequest>({
      query: ({ id, body }) => ({
        url: `/employees/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Employees', 'Technicians', 'Repairs'],
    }),
    deleteEmployee: builder.mutation<void, string>({
      query: (id) => ({
        url: `/employees/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Employees', 'Technicians'],
    }),
  }),
});

export const {
  useGetEmployeesQuery,
  useGetTechniciansQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
} = employeesApi;
