import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';

import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { PrismaService } from '../../src/modules/infra/prisma/prisma.service';

function createTestApp(moduleRef: TestingModule): NestFastifyApplication {
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  return app;
}

describe('Security envelopes (e2e)', () => {
  it('returns UNAUTHORIZED on protected route without token', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    const app = createTestApp(moduleRef);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const response = await app.inject({ method: 'GET', url: '/v1/users' });
    expect(response.statusCode).toBe(401);

    const body = JSON.parse(response.payload) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(typeof body.error.requestId).toBe('string');

    await app.close();
  });

  it('restricts /metrics with METRICS_TOKEN', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    const app = createTestApp(moduleRef);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const unauthorized = await app.inject({ method: 'GET', url: '/metrics' });
    expect(unauthorized.statusCode).toBe(401);

    const ok = await app.inject({
      method: 'GET',
      url: '/metrics',
      headers: { authorization: `Bearer ${process.env.METRICS_TOKEN}` },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['content-type']).toContain('text/plain');
    expect(ok.payload).toContain('http_requests_total');

    await app.close();
  });
});
