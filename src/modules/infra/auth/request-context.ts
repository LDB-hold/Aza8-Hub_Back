import type { AuthenticatedActor } from './auth.service';

export type RequestAuthContext = {
  actor: AuthenticatedActor;
  tenantId: string;
  userId?: string;
  apiKeyId?: string;
};

