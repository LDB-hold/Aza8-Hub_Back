import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import type { RequestAuthContext } from '../../modules/infra/auth/request-context';
import { AppError } from '../errors/app-error';

export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestAuthContext => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    if (!request.aza8) {
      throw new AppError({
        code: 'UNAUTHORIZED',
        httpStatus: 401,
        message: 'Unauthorized',
      });
    }
    return request.aza8;
  }
);
