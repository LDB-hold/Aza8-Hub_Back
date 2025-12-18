import { Controller, Get, Header, UseGuards } from '@nestjs/common';

import { Public } from '../../../common/decorators/public.decorator';
import { MetricsGuard } from './metrics.guard';
import { MetricsService } from './metrics.service';

@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('/metrics')
  @Public()
  @UseGuards(MetricsGuard)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}

