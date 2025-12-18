import { Controller, Get, Query } from '@nestjs/common';

import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { ToolAction } from '../../../common/decorators/tool-action.decorator';
import type { RequestAuthContext } from '../../infra/auth/request-context';
import { AuditLogsService, type ListAuditLogsResponse } from './audit-logs.service';

@Controller('/v1/audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @ToolAction('audit.logs.read')
  async listAuditLogs(
    @CurrentAuth() auth: RequestAuthContext,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('actor') actor?: string,
    @Query('action') action?: string,
    @Query('entity_type') entityType?: string,
    @Query('createdAtFrom') createdAtFrom?: string,
    @Query('createdAtTo') createdAtTo?: string
  ): Promise<{ data: ListAuditLogsResponse['items']; meta: ListAuditLogsResponse['meta'] }> {
    const { items, meta } = await this.auditLogsService.listAuditLogs(auth.tenantId, {
      limit,
      cursor,
      actor,
      action,
      entityType,
      createdAtFrom,
      createdAtTo,
    });
    return { data: items, meta };
  }
}

