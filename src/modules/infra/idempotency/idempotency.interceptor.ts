import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { createHash } from 'crypto';
import { Observable, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { IDEMPOTENCY_HANDLER_KEY } from '../../../common/decorators/idempotent.decorator';
import { AppError } from '../../../common/errors/app-error';
import { PrismaService } from '../prisma/prisma.service';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function stableStringify(value: Json): string {
  if (value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;

  const keys = Object.keys(value).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k]!)}`);
  return `{${entries.join(',')}}`;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function getHeader(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value) && value[0]) return value[0];
  return undefined;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = this.reflector.getAllAndOverride<string | undefined>(IDEMPOTENCY_HANDLER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!handler) return next.handle();

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const key = getHeader(request, 'idempotency-key');
    if (!key) return next.handle();

    const auth = request.aza8;
    if (!auth) {
      throw new AppError({
        code: 'UNAUTHORIZED',
        httpStatus: 401,
        message: 'Unauthorized',
      });
    }

    const requestHash = sha256Hex(
      stableStringify({
        method: request.method,
        url: request.url,
        body: (request.body ?? null) as Json,
      })
    );

    return from(
      this.prisma.idempotencyKey.findUnique({
        where: { tenantId_key_handler: { tenantId: auth.tenantId, key, handler } },
        select: { requestHash: true, responseStatus: true, responseBody: true },
      })
    ).pipe(
      mergeMap((existing) => {
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new AppError({
              code: 'CONFLICT',
              httpStatus: 409,
              message: 'Idempotency key conflict',
            });
          }

          const reply = context.switchToHttp().getResponse();
          if (reply && typeof reply.status === 'function') {
            void reply.status(existing.responseStatus);
          }

          return from(Promise.resolve(existing.responseBody));
        }

        return next.handle().pipe(
          mergeMap((data) =>
            from(
              this.prisma.idempotencyKey
                .create({
                  data: {
                    tenantId: auth.tenantId,
                    key,
                    handler,
                    requestHash,
                    responseStatus: context.switchToHttp().getResponse().statusCode ?? 200,
                    responseBody: data as object,
                  },
                })
                .then(() => data)
            )
          )
        );
      })
    );
  }
}
