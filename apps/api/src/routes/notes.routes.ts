import type { AuthUser, NoteParticipantKey } from '@itlab/contracts';
import {
  noteCommentInputSchema,
  noteInputSchema,
  noteListQuerySchema,
} from '@itlab/contracts';
import type { Prisma } from '../generated/prisma/client.js';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const NOTE_PAGE_SIZE = 50;
const ADMIN_KEY = 'ADMIN' as const;
const idSchema = z.string().uuid();

const participantSelect = {
  participantKey: true,
  userId: true,
  nameSnapshot: true,
  role: true,
} satisfies Prisma.NoteParticipantSelect;

const noteListSelect = {
  id: true,
  title: true,
  creatorName: true,
  creatorRole: true,
  createdAt: true,
  updatedAt: true,
  participants: {
    orderBy: [{ nameSnapshot: 'asc' as const }, { participantKey: 'asc' as const }],
    select: participantSelect,
  },
} satisfies Prisma.NoteSelect;

const noteDetailsSelect = {
  ...noteListSelect,
  creatorKey: true,
  description: true,
  comments: {
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    select: {
      id: true,
      authorName: true,
      authorRole: true,
      text: true,
      createdAt: true,
    },
  },
} satisfies Prisma.NoteSelect;

type SelectedNote = Prisma.NoteGetPayload<{ select: typeof noteListSelect }>;
type SelectedNoteDetails = Prisma.NoteGetPayload<{ select: typeof noteDetailsSelect }>;

interface ParticipantRow {
  participantKey: NoteParticipantKey;
  userId: string | null;
  nameSnapshot: string;
  role: 'ADMIN' | 'MANAGER' | 'TECHNICIAN';
}

const validationError = (message = 'Проверьте введённые данные') => ({
  code: 'VALIDATION_ERROR',
  message,
});

const actorKey = (user: AuthUser) => user.id ?? ADMIN_KEY;

const noteAccessFilter = (user: AuthUser): Prisma.NoteWhereInput => ({
  OR: [
    { creatorKey: actorKey(user) },
    { participants: { some: { participantKey: actorKey(user) } } },
  ],
});

const mapParticipant = (participant: SelectedNote['participants'][number]) => ({
  key: participant.participantKey,
  userId: participant.userId,
  name: participant.nameSnapshot,
  role: participant.role,
});

const mapNote = (note: SelectedNote) => ({
  id: note.id,
  title: note.title,
  creatorName: note.creatorName,
  creatorRole: note.creatorRole,
  createdAt: note.createdAt,
  updatedAt: note.updatedAt,
  participants: note.participants.map(mapParticipant),
});

const mapNoteDetails = (note: SelectedNoteDetails, user: AuthUser) => {
  const key = actorKey(user);

  return {
    ...mapNote(note),
    description: note.description,
    comments: note.comments,
    permissions: {
      canEdit: note.creatorKey === key,
      canComment: note.participants.some((participant) => participant.participantKey === key),
    },
  };
};

const resolveParticipants = async (
  participantKeys: NoteParticipantKey[],
  creatorKey: string,
): Promise<ParticipantRow[] | string> => {
  if (participantKeys.includes(creatorKey as NoteParticipantKey)) {
    return 'Создателя задачи не нужно добавлять в список сотрудников';
  }

  const userIds = participantKeys.filter((key) => key !== ADMIN_KEY);
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds }, isActive: true },
        select: { id: true, name: true, role: true },
      })
    : [];

  if (users.length !== userIds.length) {
    return 'Один или несколько выбранных сотрудников не найдены';
  }

  const usersById = new Map(users.map((user) => [user.id, user]));

  return participantKeys.map((key) => {
    if (key === ADMIN_KEY) {
      return {
        participantKey: ADMIN_KEY,
        userId: null,
        nameSnapshot: 'Администратор',
        role: 'ADMIN',
      };
    }

    const user = usersById.get(key)!;
    return {
      participantKey: key,
      userId: user.id,
      nameSnapshot: user.name,
      role: user.role,
    };
  });
};

export const notesRouter = Router();

notesRouter.use(requireAuth);

notesRouter.get('/participants', async (_request, response) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, role: true },
  });

  response.json({
    participants: [
      { key: ADMIN_KEY, userId: null, name: 'Администратор', role: 'ADMIN' },
      ...users.map((user) => ({
        key: user.id,
        userId: user.id,
        name: user.name,
        role: user.role,
      })),
    ],
  });
});

notesRouter.get('/', async (request, response) => {
  const parsedQuery = noteListQuerySchema.safeParse(request.query);
  const user = request.session.user!;

  if (!parsedQuery.success) {
    response.status(400).json(validationError('Некорректный номер страницы'));
    return;
  }

  const { page } = parsedQuery.data;
  const where = noteAccessFilter(user);
  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * NOTE_PAGE_SIZE,
      take: NOTE_PAGE_SIZE,
      select: noteListSelect,
    }),
    prisma.note.count({ where }),
  ]);

  response.json({
    items: notes.map(mapNote),
    pagination: {
      page,
      limit: NOTE_PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / NOTE_PAGE_SIZE),
    },
  });
});

notesRouter.post('/', async (request, response) => {
  const parsedBody = noteInputSchema.safeParse(request.body);
  const user = request.session.user!;

  if (!parsedBody.success) {
    response.status(400).json(validationError(parsedBody.error.issues[0]?.message));
    return;
  }

  const key = actorKey(user);
  const participants = await resolveParticipants(parsedBody.data.participantKeys, key);
  if (typeof participants === 'string') {
    response.status(400).json(validationError(participants));
    return;
  }

  const note = await prisma.note.create({
    data: {
      title: parsedBody.data.title,
      description: parsedBody.data.description,
      creatorKey: key,
      creatorId: user.id,
      creatorName: user.name,
      creatorRole: user.role,
      participants: { create: participants },
    },
    select: noteDetailsSelect,
  });

  response.status(201).json(mapNoteDetails(note, user));
});

notesRouter.get('/:id', async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  const user = request.session.user!;

  if (!parsedId.success) {
    response.status(400).json(validationError('Некорректный идентификатор задачи'));
    return;
  }

  const note = await prisma.note.findFirst({
    where: { id: parsedId.data, ...noteAccessFilter(user) },
    select: noteDetailsSelect,
  });

  if (!note) {
    response.status(404).json({ code: 'NOT_FOUND', message: 'Задача не найдена' });
    return;
  }

  response.json(mapNoteDetails(note, user));
});

notesRouter.patch('/:id', async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  const parsedBody = noteInputSchema.safeParse(request.body);
  const user = request.session.user!;

  if (!parsedId.success || !parsedBody.success) {
    response.status(400).json(validationError(parsedBody.success
      ? 'Некорректный идентификатор задачи'
      : parsedBody.error.issues[0]?.message));
    return;
  }

  const key = actorKey(user);
  const existingNote = await prisma.note.findFirst({
    where: { id: parsedId.data, creatorKey: key },
    select: { id: true },
  });
  if (!existingNote) {
    response.status(404).json({ code: 'NOT_FOUND', message: 'Задача не найдена' });
    return;
  }

  const participants = await resolveParticipants(parsedBody.data.participantKeys, key);
  if (typeof participants === 'string') {
    response.status(400).json(validationError(participants));
    return;
  }

  const note = await prisma.note.update({
    where: { id: parsedId.data },
    data: {
      title: parsedBody.data.title,
      description: parsedBody.data.description,
      participants: {
        deleteMany: {},
        create: participants,
      },
    },
    select: noteDetailsSelect,
  });

  response.json(mapNoteDetails(note, user));
});

notesRouter.delete('/:id', async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  const user = request.session.user!;

  if (!parsedId.success) {
    response.status(400).json(validationError('Некорректный идентификатор задачи'));
    return;
  }

  const deleted = await prisma.note.deleteMany({
    where: { id: parsedId.data, creatorKey: actorKey(user) },
  });
  if (deleted.count === 0) {
    response.status(404).json({ code: 'NOT_FOUND', message: 'Задача не найдена' });
    return;
  }

  response.status(204).end();
});

notesRouter.post('/:id/comments', async (request, response) => {
  const parsedId = idSchema.safeParse(request.params.id);
  const parsedBody = noteCommentInputSchema.safeParse(request.body);
  const user = request.session.user!;

  if (!parsedId.success || !parsedBody.success) {
    response.status(400).json(validationError(parsedBody.success
      ? 'Некорректный идентификатор задачи'
      : parsedBody.error.issues[0]?.message));
    return;
  }

  const key = actorKey(user);
  const note = await prisma.note.findFirst({
    where: {
      id: parsedId.data,
      participants: { some: { participantKey: key } },
    },
    select: { id: true },
  });
  if (!note) {
    response.status(404).json({ code: 'NOT_FOUND', message: 'Задача не найдена' });
    return;
  }

  const comment = await prisma.$transaction(async (transaction) => {
    const createdComment = await transaction.noteComment.create({
      data: {
        noteId: parsedId.data,
        authorKey: key,
        authorId: user.id,
        authorName: user.name,
        authorRole: user.role,
        text: parsedBody.data.text,
      },
      select: {
        id: true,
        authorName: true,
        authorRole: true,
        text: true,
        createdAt: true,
      },
    });
    await transaction.note.update({
      where: { id: parsedId.data },
      data: { updatedAt: new Date() },
    });
    return createdComment;
  });

  response.status(201).json(comment);
});
