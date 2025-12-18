import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { IS_PUBLIC_KEY } from '../../../../common/decorators/public.decorator';
import { REQUIRED_ROLE_KEY, type RequiredRole } from '../../../../common/decorators/require-role.decorator';
import { TOOL_ACTION_KEY } from '../../../../common/decorators/tool-action.decorator';
import { AppError } from '../../../../common/errors/app-error';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestAuthContext } from '../request-context';

function getAuthContext(request: FastifyRequest): RequestAuthContext | undefined {
  return request.aza8;
}

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const auth = getAuthContext(request);
    if (!auth) {
      throw new AppError({
        code: 'UNAUTHORIZED',
        httpStatus: 401,
        message: 'Unauthorized',
      });
    }

    const requiredRole = this.reflector.getAllAndOverride<RequiredRole | undefined>(REQUIRED_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRole) {
      const role = auth.actor.kind === 'user' ? auth.actor.role : undefined;
      if (role !== requiredRole) {
        throw new AppError({
          code: 'FORBIDDEN_ACTION',
          httpStatus: 403,
          message: 'Forbidden',
        });
      }

      return true;
    }

    const requiredToolActionKey = this.reflector.getAllAndOverride<string | undefined>(TOOL_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredToolActionKey) {
      throw new AppError({
        code: 'FORBIDDEN_ACTION',
        httpStatus: 403,
        message: 'Forbidden',
      });
    }

    if (auth.actor.kind === 'service') {
      if (auth.actor.profile === 'admin') return true;
      if (auth.actor.profile === 'write') return true;
      if (auth.actor.profile === 'read-only' && requiredToolActionKey.endsWith('.read')) return true;
      if (auth.actor.toolActionKeys.includes(requiredToolActionKey)) return true;

      throw new AppError({
        code: 'FORBIDDEN_ACTION',
        httpStatus: 403,
        message: 'Forbidden',
      });
    }

    const permission = await this.prisma.groupPermission.findFirst({
      where: {
        tenantId: auth.tenantId,
        toolAction: { key: requiredToolActionKey },
        group: { userGroups: { some: { userId: auth.actor.userId } } },
      },
      select: { id: true },
    });

    if (!permission) {
      throw new AppError({
        code: 'FORBIDDEN_ACTION',
        httpStatus: 403,
        message: 'Forbidden',
      });
    }

    return true;
  }
}
