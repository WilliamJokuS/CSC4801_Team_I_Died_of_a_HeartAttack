import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

/**
 * Thrown from route handlers / services; rendered as the contract's error envelope:
 * { "error": { "code": string, "message": string } }
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, code = 'VALIDATION_ERROR') =>
  new HttpError(400, code, message);
export const unauthorized = (message = 'Authentication required', code = 'UNAUTHORIZED') =>
  new HttpError(401, code, message);
export const forbidden = (message = 'Forbidden', code = 'FORBIDDEN') =>
  new HttpError(403, code, message);
export const notFound = (message = 'Not found', code = 'NOT_FOUND') =>
  new HttpError(404, code, message);
export const conflict = (message: string, code = 'CONFLICT') => new HttpError(409, code, message);

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
};

const transientPrismaCodes = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2028']);
const transientPostgresCodes = new Set(['55P03', '57014']);

function isTransientDatabaseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const { code, errorCode, meta } = error as Error & {
    code?: string;
    errorCode?: string;
    meta?: { code?: string };
  };
  return transientPrismaCodes.has(code ?? errorCode ?? '') ||
    transientPostgresCodes.has(code ?? '') ||
    (code === 'P2010' && transientPostgresCodes.has(meta?.code ?? '')) ||
    /\b(?:lock timeout|statement timeout|query read timeout|timeout exceeded when trying to connect|connection terminated due to connection timeout)\b/i.test(error.message);
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  // Static-file middleware can set the file's MIME type before raising an error.
  res.type('json');
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    const message = err.issues
      .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join('; ');
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message } });
    return;
  }
  // Malformed JSON body from express.json()
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
    return;
  }
  // Body over the express.json() size limit
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
    return;
  }
  // The API contract maps unsupported charsets to 400.
  if (err?.type === 'charset.unsupported') {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed request' } });
    return;
  }
  // Express's route decoder sets a status on URIError without setting expose.
  const invalidRoute = err instanceof URIError && 'status' in err && err.status === 400;
  const exposedClientError =
    err?.expose === true && Number.isInteger(err.status) && err.status >= 400 && err.status < 500;
  if (invalidRoute || exposedClientError) {
    res.status(err.status).json({ error: { code: 'BAD_REQUEST', message: 'Malformed request' } });
    return;
  }
  if (isTransientDatabaseError(err)) {
    res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'Database temporarily unavailable. Please try again.' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
};
