import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { AppError } from '../../../common/errors/app-error';
import { env } from '../env';

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
export class MetricsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!env.METRICS_TOKEN) {
      throw new AppError({
        code: 'SERVICE_UNAVAILABLE',
        httpStatus: 503,
        message: 'Metrics is not enabled',
      });
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = getBearerToken(request) ?? getHeader(request, 'x-metrics-token');

    if (!token || token !== env.METRICS_TOKEN) {
      throw new AppError({
        code: 'UNAUTHORIZED',
        httpStatus: 401,
        message: 'Unauthorized',
      });
    }

    return true;
  }
}

