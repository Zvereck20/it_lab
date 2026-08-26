import express from 'express';
import helmet from 'helmet';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  return app;
};
