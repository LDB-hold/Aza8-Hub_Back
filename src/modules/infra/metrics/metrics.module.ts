import { Global, Module } from '@nestjs/common';

import { MetricsController } from './metrics.controller';
import { MetricsGuard } from './metrics.guard';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsGuard, MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}

