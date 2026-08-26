import type { NextFunction, Request, Response } from 'express';

export const requireAuth = (request: Request, response: Response, next: NextFunction) => {
  if (!request.session.user) {
    response.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Требуется авторизация',
    });
    return;
  }

  next();
};
