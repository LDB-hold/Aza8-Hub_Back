import { Body, Controller, Get, Put } from '@nestjs/common';

import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { ToolAction } from '../../../common/decorators/tool-action.decorator';
import type { RequestAuthContext } from '../../infra/auth/request-context';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { BrandingService, type BrandingResponse } from './branding.service';

@Controller('/v1/branding')
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get()
  @ToolAction('tenant.branding.read')
  async getBranding(@CurrentAuth() auth: RequestAuthContext): Promise<{ data: BrandingResponse }> {
    const data = await this.brandingService.getBranding(auth.tenantId);
    return { data };
  }

  @Put()
  @ToolAction('tenant.branding.write')
  async putBranding(
    @CurrentAuth() auth: RequestAuthContext,
    @Body() dto: UpdateBrandingDto
  ): Promise<{ data: BrandingResponse }> {
    const data = await this.brandingService.putBranding(auth.tenantId, dto);
    return { data };
  }
}

