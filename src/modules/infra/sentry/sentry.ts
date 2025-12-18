import * as Sentry from '@sentry/node';

import { env } from '../env';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  initialized = true;

  if (!env.SENTRY_DSN) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0,
  });
}

export function captureException(exception: unknown, context?: Record<string, unknown>): void {
  if (!env.SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('request', context);
    }
    Sentry.captureException(exception);
  });
}

