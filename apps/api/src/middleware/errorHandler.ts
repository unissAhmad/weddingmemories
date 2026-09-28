import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@wm/shared';
import { Prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { isProd } from '../env';

export const notFoundHandler: RequestHandler = (_req, res) => {
  const body: ApiErrorBody = { error: { code: 'NOT_FOUND', message: 'Route not found' } };
  res.status(404).json(body);
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let body: ApiErrorBody = {
    error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' },
  };

  if (err instanceof AppError) {
    status = err.status;
    body = { error: { code: err.code, message: err.message, details: err.details } };
  } else if (err instanceof ZodError) {
    status = 400;
    body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: err.issues[0]?.message ?? 'Invalid request',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    };
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    status = 409;
    body = { error: { code: 'CONFLICT', message: 'That already exists' } };
  } else if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    status = err.status ?? 400;
    body = { error: { code: 'BAD_REQUEST', message: 'Malformed request body' } };
  }

  if (status >= 500) {
    req.log?.error({ err }, 'unhandled error');
    if (!isProd) body.error.details = { message: String(err?.message ?? err) };
  }

  res.status(status).json(body);
};
