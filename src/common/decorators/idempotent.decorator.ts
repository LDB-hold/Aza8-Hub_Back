import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENCY_HANDLER_KEY = 'aza8:idempotencyHandler';

export function Idempotent(handler: string): MethodDecorator & ClassDecorator {
  return SetMetadata(IDEMPOTENCY_HANDLER_KEY, handler);
}

