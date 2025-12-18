import { Module } from '@nestjs/common';

import { ApiKeysModule } from './api-keys/api-keys.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { BrandingModule } from './branding/branding.module';
import { CatalogModule } from './catalog/catalog.module';
import { ConfigModule } from './config/config.module';
import { GroupsModule } from './groups/groups.module';
import { MeModule } from './me/me.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsageModule } from './usage/usage.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ApiKeysModule,
    AuditLogsModule,
    BrandingModule,
    CatalogModule,
    ConfigModule,
    GroupsModule,
    MeModule,
    TenantsModule,
    UsageModule,
    UsersModule,
  ],
})
export class V1Module {}
