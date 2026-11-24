import { z } from 'zod';

// In Unicode mode, paired surrogates match as a single code point outside this range.
export const persistedText = z.string().refine(
  (value) => !/[\u0000\uD800-\uDFFF]/u.test(value),
  'must not contain NUL characters or unpaired Unicode surrogates',
);
