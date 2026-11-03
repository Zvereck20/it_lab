import type {
  NoteComment,
  NoteCommentInput,
  NoteDetails,
  NoteInput,
  NoteListQuery,
  NoteListResponse,
  NoteParticipantsResponse,
} from '@itlab/contracts';

import { api } from '../../../app/api';

interface UpdateNoteRequest {
  id: string;
  body: NoteInput;
}

export const notesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getNoteParticipants: builder.query<NoteParticipantsResponse, void>({
      query: () => '/notes/participants',
      providesTags: ['NoteParticipants'],
    }),
    getNotes: builder.query<NoteListResponse, NoteListQuery>({
      query: (params) => ({ url: '/notes', params }),
      providesTags: ['Notes'],
    }),
    getNote: builder.query<NoteDetails, string>({
      query: (id) => `/notes/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Notes', id }],
    }),
    createNote: builder.mutation<NoteDetails, NoteInput>({
      query: (body) => ({ url: '/notes', method: 'POST', body }),
      invalidatesTags: ['Notes'],
    }),
    updateNote: builder.mutation<NoteDetails, UpdateNoteRequest>({
      query: ({ id, body }) => ({ url: `/notes/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, { id }) => ['Notes', { type: 'Notes', id }],
    }),
    deleteNote: builder.mutation<void, string>({
      query: (id) => ({ url: `/notes/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Notes'],
    }),
    createNoteComment: builder.mutation<
      NoteComment,
      { id: string; body: NoteCommentInput }
    >({
      query: ({ id, body }) => ({
        url: `/notes/${id}/comments`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => ['Notes', { type: 'Notes', id }],
    }),
  }),
});

export const {
  useGetNoteParticipantsQuery,
  useGetNotesQuery,
  useGetNoteQuery,
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
  useCreateNoteCommentMutation,
} = notesApi;
