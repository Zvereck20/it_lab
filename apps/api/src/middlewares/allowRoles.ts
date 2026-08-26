import type { AuthRole } from '@itlab/contracts';
import type { NextFunction, Request, Response } from 'express';

export const allowRoles = (...allowedRoles: AuthRole[]) =>
  (request: Request, response: Response, next: NextFunction) => {
    const user = request.session.user;

    if (!user) {
      response.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Требуется авторизация',
      });
      return;
    }

    if (user.role === 'ADMIN' || allowedRoles.includes(user.role)) {
      next();
      return;
    }

    response.status(403).json({
      code: 'FORBIDDEN',
      message: 'Недостаточно прав для выполнения действия',
    });
  };
