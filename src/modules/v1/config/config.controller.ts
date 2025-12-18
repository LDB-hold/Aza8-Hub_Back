import { Body, Controller, Get, Put } from '@nestjs/common';

import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { ToolAction } from '../../../common/decorators/tool-action.decorator';
import type { RequestAuthContext } from '../../infra/auth/request-context';
import { UpdateConfigDto } from './dto/update-config.dto';
import { ConfigService, type TenantConfigResponse } from './config.service';

@Controller('/v1/config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @ToolAction('tenant.config.read')
  async getConfig(@CurrentAuth() auth: RequestAuthContext): Promise<{ data: TenantConfigResponse }> {
    const data = await this.configService.getConfig(auth.tenantId);
    return { data };
  }

  @Put()
  @ToolAction('tenant.config.write')
  async putConfig(
    @CurrentAuth() auth: RequestAuthContext,
    @Body() dto: UpdateConfigDto
  ): Promise<{ data: TenantConfigResponse }> {
    const data = await this.configService.putConfig(auth.tenantId, dto);
    return { data };
  }
}

