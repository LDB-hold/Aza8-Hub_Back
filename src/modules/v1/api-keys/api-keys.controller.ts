import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { Idempotent } from '../../../common/decorators/idempotent.decorator';
import { ToolAction } from '../../../common/decorators/tool-action.decorator';
import type { RequestAuthContext } from '../../infra/auth/request-context';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyStatusDto } from './dto/update-api-key-status.dto';
import { ApiKeysService, type ListApiKeysResponse } from './api-keys.service';

@Controller('/v1/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @ToolAction('rbac.api_keys.create')
  @Idempotent('rbac.api_keys.create')
  async createApiKey(
    @CurrentAuth() auth: RequestAuthContext,
    @Body() dto: CreateApiKeyDto
  ): Promise<{ data: { id: string; value: string } }> {
    const apiKey = await this.apiKeysService.createApiKey(auth.tenantId, dto);
    return { data: apiKey };
  }

  @Get()
  @ToolAction('rbac.api_keys.read')
  async listApiKeys(@CurrentAuth() auth: RequestAuthContext): Promise<{ data: ListApiKeysResponse }> {
    const data = await this.apiKeysService.listApiKeys(auth.tenantId);
    return { data };
  }

  @Patch('/:id/status')
  @ToolAction('rbac.api_keys.status.update')
  async updateApiKeyStatus(
    @CurrentAuth() auth: RequestAuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyStatusDto
  ): Promise<{ data: { status: 'ok' } }> {
    await this.apiKeysService.updateApiKeyStatus(auth.tenantId, id, dto.status);
    return { data: { status: 'ok' } };
  }
}
