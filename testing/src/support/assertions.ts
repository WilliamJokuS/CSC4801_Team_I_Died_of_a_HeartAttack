import { expect } from 'vitest';
import { HttpError } from '../../../backend/src/lib/errors.js';

/**
 * Asserts a call rejects with a request-validation failure. The services let zod's ZodError
 * propagate (the error handler turns it into 400 VALIDATION_ERROR), and zod lives in
 * backend/node_modules, so the error is recognised by shape rather than imported.
 */
export async function expectValidationError(promise: Promise<unknown>): Promise<void> {
  let caught: any;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught, 'expected the call to reject').toBeDefined();
  expect(caught.name).toBe('ZodError');
  expect(Array.isArray(caught.issues)).toBe(true);
  expect(caught.issues.length).toBeGreaterThan(0);
}

/** Asserts a service call rejects with the contract's HttpError (status, optional code/message). */
export async function expectHttpError(
  promise: Promise<unknown>,
  status: number,
  code?: string,
  message?: string,
): Promise<HttpError> {
  let caught: unknown;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught, 'expected the call to reject').toBeDefined();
  expect(caught).toBeInstanceOf(HttpError);
  const err = caught as HttpError;
  expect(err.status).toBe(status);
  if (code !== undefined) expect(err.code).toBe(code);
  if (message !== undefined) expect(err.message).toBe(message);
  return err;
}
