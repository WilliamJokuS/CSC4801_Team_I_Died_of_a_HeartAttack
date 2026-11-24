import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

export interface AuthLimits {
  requestsPerMinute: number;
  concurrency: number;
}

export function limitAuthRequests({ requestsPerMinute, concurrency }: AuthLimits) {
  const perClient = rateLimit({
    windowMs: 60_000,
    limit: requestsPerMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'AUTH_RATE_LIMITED', message: 'Too many sign-in or registration attempts. Try again later.' } },
  });
  let active = 0;

  return (handler: RequestHandler): RequestHandler[] => [
    perClient,
    async (req, res, next) => {
      if (active >= concurrency) {
        res.set('Retry-After', '1').status(503).json({
          error: { code: 'AUTH_BUSY', message: 'Sign-in and registration are busy. Try again shortly.' },
        });
        return;
      }

      active += 1;
      try {
        await handler(req, res, next);
      } finally {
        active -= 1;
      }
    },
  ];
}
