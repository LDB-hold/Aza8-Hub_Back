import { Body, Controller, Param, Post } from '@nestjs/common';

import { Idempotent } from '../../../common/decorators/idempotent.decorator';
import { RequireRole } from '../../../common/decorators/require-role.decorator';
import { ToolAction } from '../../../common/decorators/tool-action.decorator';
import { AssignPackageDto } from './dto/assign-package.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantsService, type TenantCreatedResponse } from './tenants.service';

@Controller('/v1/tenants')
@RequireRole('ADM_AZA8')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @ToolAction('tenants.create')
  @Idempotent('tenants.create')
  async createTenant(@Body() dto: CreateTenantDto): Promise<{ data: TenantCreatedResponse }> {
    const data = await this.tenantsService.createTenant(dto);
    return { data };
  }

  @Post('/:tenantId/packages/:packageKey/assign')
  @ToolAction('tenants.packages.assign')
  @Idempotent('tenants.packages.assign')
  async assignPackage(
    @Param('tenantId') tenantId: string,
    @Param('packageKey') packageKey: string,
    @Body() dto: AssignPackageDto
  ): Promise<{ data: { status: 'ok' } }> {
    await this.tenantsService.assignPackage({ tenantId, packageKey, expiresAt: dto.expiresAt });
    return { data: { status: 'ok' } };
  }

  @Post('/:tenantId/seeds')
  @ToolAction('tenants.seeds.run')
  @Idempotent('tenants.seeds.run')
  async runSeeds(@Param('tenantId') tenantId: string): Promise<{ data: { status: 'ok' } }> {
    await this.tenantsService.seedTenantBase({ tenantId });
    return { data: { status: 'ok' } };
  }
}
