import type { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('[Error]', err);

  res.status(500).json({
    code: 500,
    message: err.message || 'Internal Server Error',
    data: null,
    requestId: req.headers['x-request-id'] || 'unknown',
  });
};
