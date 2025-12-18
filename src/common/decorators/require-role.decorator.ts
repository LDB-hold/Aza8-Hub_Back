import { SetMetadata } from '@nestjs/common';

export const REQUIRED_ROLE_KEY = 'aza8:requiredRole';

export type RequiredRole = 'ADM_AZA8' | 'ADM_CLIENTE' | 'COLABORADOR' | 'EXTERNO';

export function RequireRole(role: RequiredRole): MethodDecorator & ClassDecorator {
  return SetMetadata(REQUIRED_ROLE_KEY, role);
}

