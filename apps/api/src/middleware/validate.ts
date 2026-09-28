import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Parses body/query/params with shared zod schemas. Parsed values land on `req.valid`
 * (Express 5 makes `req.query` read-only). ZodErrors are formatted by errorHandler.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    req.valid = {
      body: schemas.body ? schemas.body.parse(req.body) : undefined,
      query: schemas.query ? schemas.query.parse(req.query) : undefined,
      params: schemas.params ? schemas.params.parse(req.params) : undefined,
    };
    next();
  };
}
