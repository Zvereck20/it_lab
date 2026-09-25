import connectPgSimple from 'connect-pg-simple';
import express from 'express';
import helmet from 'helmet';
import session from 'express-session';

import { SESSION_COOKIE_NAME, SESSION_DURATION_MS } from './config/auth.js';
import { env } from './config/env.js';
import { sessionPool } from './db/sessionPool.js';
import { authRouter } from './routes/auth.routes.js';
import { employeesRouter } from './routes/employees.routes.js';
import { inventoryRouter } from './routes/inventory.routes.js';
import { ordersRouter } from './routes/orders.routes.js';
import { repairsRouter } from './routes/repairs.routes.js';

const PostgresSessionStore = connectPgSimple(session);

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');

  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(helmet());
  app.use(express.json());
  app.use(session({
    name: SESSION_COOKIE_NAME,
    secret: env.SESSION_SECRET,
    store: new PostgresSessionStore({
      pool: sessionPool,
      tableName: 'user_sessions',
      createTableIfMissing: false,
    }),
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: SESSION_DURATION_MS,
    },
  }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/employees', employeesRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/repairs', repairsRouter);

  app.use((_request, response) => {
    response.status(404).json({
      code: 'NOT_FOUND',
      message: 'Ресурс не найден',
    });
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error(error);
    response.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Не удалось выполнить операцию. Попробуйте позже',
    });
  });

  return app;
};
