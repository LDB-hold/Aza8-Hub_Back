import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';

import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { PrismaService } from '../../src/modules/infra/prisma/prisma.service';

describe('GET /health (e2e)', () => {
  it('returns ok', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ data: { status: 'ok' } });

    await app.close();
  });
});

