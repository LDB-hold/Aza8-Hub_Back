import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AppError } from '../errors/app-error';
import { captureException } from '../../modules/infra/sentry/sentry';

type ErrorResponseBody = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
};

function getRequestId(request: FastifyRequest): string {
  if (typeof request.id === 'string' && request.id.length > 0) return request.id;
  return 'unknown';
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();

    const requestId = getRequestId(request);

    const response = (status: number, body: ErrorResponseBody): void => {
      (request as unknown as { aza8ErrorCode?: string }).aza8ErrorCode = body.error.code;
      void reply.status(status).send(body);
    };

    if (exception instanceof AppError) {
      response(exception.httpStatus, {
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
          requestId,
        },
      });
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        response(HttpStatus.CONFLICT, {
          error: {
            code: 'DUPLICATE_RESOURCE',
            message: 'Duplicate resource',
            requestId,
          },
        });
        return;
      }

      captureException(exception, { requestId });
      response(HttpStatus.INTERNAL_SERVER_ERROR, {
        error: {
          code: 'DATABASE_ERROR',
          message: 'Database error',
          requestId,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const rawResponse = exception.getResponse();

      if (status >= 500) {
        captureException(exception, { requestId });
      }

      response(status, {
        error: {
          code: status === HttpStatus.BAD_REQUEST ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
          message: typeof rawResponse === 'string' ? rawResponse : exception.message,
          requestId,
        },
      });
      return;
    }

    captureException(exception, { requestId });
    response(HttpStatus.INTERNAL_SERVER_ERROR, {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal error',
        requestId,
      },
    });
  }
}
