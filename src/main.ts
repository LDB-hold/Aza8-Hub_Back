import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { randomUUID } from 'crypto';
import type { IncomingMessage } from 'http';
import type { Http2ServerRequest } from 'http2';
import type { FastifyInstance } from 'fastify';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { MetricsService } from './modules/infra/metrics/metrics.service';
import { env } from './modules/infra/env';
import { initSentry } from './modules/infra/sentry/sentry';

async function bootstrap(): Promise<void> {
  initSentry();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        level: env.LOG_LEVEL,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers.x-api-key',
          ],
          remove: true,
        },
      },
      genReqId: (req: IncomingMessage | Http2ServerRequest): string => {
        const headerValue = req.headers['x-request-id'];
        if (typeof headerValue === 'string' && headerValue.length > 0) return headerValue;
        if (Array.isArray(headerValue) && headerValue[0]) return headerValue[0];
        return randomUUID();
      },
    }),
    { bufferLogs: true }
  );

  const fastify = app.getHttpAdapter().getInstance() as FastifyInstance;
  fastify.addHook('onRequest', (req, reply, done) => {
    (req as unknown as { aza8StartAt?: bigint }).aza8StartAt = process.hrtime.bigint();
    reply.header('X-Request-Id', req.id);
    done();
  });

  const metrics = app.get(MetricsService);
  fastify.addHook('onResponse', (req, reply, done) => {
    const startAt = (req as unknown as { aza8StartAt?: bigint }).aza8StartAt;
    if (startAt) {
      const durationMs = Number(process.hrtime.bigint() - startAt) / 1_000_000;
      const route =
        (req as unknown as { routerPath?: string }).routerPath ??
        (req as unknown as { routeOptions?: { url?: string } }).routeOptions?.url ??
        req.url.split('?')[0];

      const errorCode = (req as unknown as { aza8ErrorCode?: string }).aza8ErrorCode;

      metrics.observeHttpRequest({
        method: req.method,
        route,
        statusCode: reply.statusCode,
        durationMs,
        errorCode,
      });
    }

    done();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

void bootstrap();
