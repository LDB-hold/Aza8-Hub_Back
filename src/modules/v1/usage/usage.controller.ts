import { Controller, Get, Query } from '@nestjs/common';

import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { ToolAction } from '../../../common/decorators/tool-action.decorator';
import type { RequestAuthContext } from '../../infra/auth/request-context';
import { UsageService, type UsageResponse } from './usage.service';

@Controller('/v1/usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  @ToolAction('usage.read')
  async getUsage(
    @CurrentAuth() auth: RequestAuthContext,
    @Query('periodStart') periodStart?: string,
    @Query('periodEnd') periodEnd?: string,
    @Query('groupBy') groupBy?: string
  ): Promise<{ data: UsageResponse }> {
    const data = await this.usageService.getUsage(auth.tenantId, { periodStart, periodEnd, groupBy });
    return { data };
  }
}

