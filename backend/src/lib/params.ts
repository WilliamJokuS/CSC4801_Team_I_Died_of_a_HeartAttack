import { z } from 'zod';
import { notFound } from './errors.js';

const uuid = z.uuid();

/** A path id that isn't a UUID can't name an existing row, so it's a 404 rather than a 400. */
export function parseId(value: string | string[] | undefined, what = 'Resource'): string {
  const result = uuid.safeParse(value);
  if (!result.success) throw notFound(`${what} not found`);
  return result.data;
}
