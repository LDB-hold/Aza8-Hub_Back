import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { IS_PUBLIC_KEY } from '../../../../common/decorators/public.decorator';
import { AppError } from '../../../../common/errors/app-error';
import { AuthService, type AuthenticatedActor } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestAuthContext } from '../request-context';

function getHeader(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value) && value[0]) return value[0];
  return undefined;
}

function getBearerToken(request: FastifyRequest): string | undefined {
  const auth = getHeader(request, 'authorization');
  if (!auth) return undefined;

  const [type, token] = auth.split(' ');
  if (type !== 'Bearer' || !token) return undefined;
  return token;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    const token = getBearerToken(request) ?? getHeader(request, 'x-api-key');
    if (!token) {
      throw new AppError({
        code: 'UNAUTHORIZED',
        httpStatus: 401,
        message: 'Unauthorized',
      });
    }

    let actor: AuthenticatedActor;
    try {
      actor = await this.authService.authenticate(token);
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      if (code === 'TOKEN_EXPIRED') {
        throw new AppError({
          code: 'TOKEN_EXPIRED',
          httpStatus: 401,
          message: 'Token expired',
        });
      }

      throw new AppError({
        code: 'INVALID_TOKEN',
        httpStatus: 401,
        message: 'Invalid token',
      });
    }

    const headerTenantId = getHeader(request, 'x-tenant-id');
    if (headerTenantId) {
      if (actor.kind !== 'service') {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          httpStatus: 400,
          message: 'X-Tenant-Id is only allowed for service accounts',
        });
      }

      if (headerTenantId !== actor.tenantId) {
        throw new AppError({
          code: 'TENANT_MISMATCH',
          httpStatus: 400,
          message: 'Tenant mismatch',
        });
      }
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: actor.tenantId },
      select: { id: true, status: true },
    });

    if (!tenant) {
      throw new AppError({
        code: 'TENANT_NOT_FOUND',
        httpStatus: 401,
        message: 'Tenant not found',
      });
    }

    if (tenant.status !== 'ativo') {
      throw new AppError({
        code: 'TENANT_SUSPENDED',
        httpStatus: 403,
        message: 'Tenant suspended',
      });
    }

    if (actor.kind === 'user') {
      const user = await this.prisma.user.findFirst({
        where: { id: actor.userId, tenantId: actor.tenantId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!user) {
        throw new AppError({
          code: 'UNAUTHORIZED',
          httpStatus: 401,
          message: 'Unauthorized',
        });
      }

      if (user.status !== 'ativo') {
        throw new AppError({
          code: 'FORBIDDEN_ACTION',
          httpStatus: 403,
          message: 'Forbidden',
        });
      }
    }

    // Attach context to request for downstream guards/controllers.
    const ctxAuth: RequestAuthContext = {
      actor,
      tenantId: actor.tenantId,
      userId: actor.kind === 'user' ? actor.userId : undefined,
      apiKeyId: actor.kind === 'service' ? actor.apiKeyId : undefined,
    };

    request.aza8 = ctxAuth;

    if (request.log) {
      const actorId = actor.kind === 'user' ? actor.userId : actor.apiKeyId;
      // Fastify logger is per-request and can be enriched with tenant/actor metadata.
      (request as unknown as { log: unknown }).log = request.log.child({
        tenantId: actor.tenantId,
        actorKind: actor.kind,
        actorId,
      });
    }

    return true;
  }
}
