import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/infra/auth/auth.module';
import { AuthGuard } from './modules/infra/auth/guards/auth.guard';
import { AuthorizationGuard } from './modules/infra/auth/guards/authorization.guard';
import { IdempotencyInterceptor } from './modules/infra/idempotency/idempotency.interceptor';
import { MetricsModule } from './modules/infra/metrics/metrics.module';
import { OutboxModule } from './modules/infra/outbox/outbox.module';
import { PrismaModule } from './modules/infra/prisma/prisma.module';
import { V1Module } from './modules/v1/v1.module';

@Module({
  imports: [PrismaModule, AuthModule, MetricsModule, OutboxModule, HealthModule, V1Module],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
