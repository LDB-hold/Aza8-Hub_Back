import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { AppError } from '../../../common/errors/app-error';
import { OutboxService } from '../../infra/outbox/outbox.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { CreateTenantDto } from './dto/create-tenant.dto';

export type TenantCreatedResponse = {
  tenant: { id: string; slug: string; name: string; status: string };
  adminUser: { id: string; email: string; name: string; status: string };
};

const baseOperatorKeys: string[] = [
  'rbac.users.create',
  'rbac.groups.create',
  'rbac.groups.users.add',
  'rbac.groups.users.remove',
];

function isReadAction(key: string): boolean {
  return key.endsWith('.read');
}

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService, private readonly outbox: OutboxService) {}

  async createTenant(dto: CreateTenantDto): Promise<TenantCreatedResponse> {
    const pkg = await this.prisma.package.findUnique({
      where: { key: dto.packageKey },
      select: { id: true, key: true },
    });
    if (!pkg) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'Invalid packageKey',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { slug: dto.slug, name: dto.name },
        select: { id: true, slug: true, name: true, status: true },
      });

      await tx.tenantPackage.create({
        data: { tenantId: tenant.id, packageId: pkg.id, status: 'ativo' },
      });

      const adminUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.adminUser.email,
          name: dto.adminUser.name,
          status: 'ativo',
        },
        select: { id: true, email: true, name: true, status: true },
      });

      await this.seedTenantBaseTx(tx, { tenantId: tenant.id, adminUserId: adminUser.id });

      await this.outbox.enqueueWebhookEventTx(tx, tenant.id, {
        type: 'tenant.created',
        payload: { tenantId: tenant.id, slug: tenant.slug, name: tenant.name },
      });

      await this.outbox.enqueueWebhookEventTx(tx, tenant.id, {
        type: 'tenant.package.assigned',
        payload: { tenantId: tenant.id, packageKey: dto.packageKey },
      });

      return {
        tenant,
        adminUser,
      };
    });
  }

  async assignPackage(params: {
    tenantId: string;
    packageKey: string;
    expiresAt?: string;
  }): Promise<void> {
    const pkg = await this.prisma.package.findUnique({
      where: { key: params.packageKey },
      select: { id: true },
    });
    if (!pkg) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'Invalid packageKey',
      });
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: params.tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        message: 'Tenant not found',
      });
    }

    await this.prisma.tenantPackage.upsert({
      where: { tenantId_packageId: { tenantId: params.tenantId, packageId: pkg.id } },
      create: {
        tenantId: params.tenantId,
        packageId: pkg.id,
        expiresAt: params.expiresAt ? new Date(params.expiresAt) : undefined,
      },
      update: {
        status: 'ativo',
        expiresAt: params.expiresAt ? new Date(params.expiresAt) : undefined,
      },
    });

    await this.outbox.enqueueWebhookEvent(params.tenantId, {
      type: 'tenant.package.assigned',
      payload: { tenantId: params.tenantId, packageKey: params.packageKey, expiresAt: params.expiresAt },
    });
  }

  async seedTenantBase(params: { tenantId: string }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.seedTenantBaseTx(tx, { tenantId: params.tenantId });
    });
  }

  private async seedTenantBaseTx(
    tx: Prisma.TransactionClient,
    params: { tenantId: string; adminUserId?: string }
  ): Promise<void> {
    const activePackages = await tx.tenantPackage.findMany({
      where: {
        tenantId: params.tenantId,
        status: 'ativo',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { packageId: true },
    });

    const packageIds = activePackages.map((row) => row.packageId);

    const allowedActions = await tx.packageToolAction.findMany({
      where: { packageId: { in: packageIds } },
      select: { toolAction: { select: { id: true, key: true } } },
    });

    const allowedToolActionKeys = [...new Set(allowedActions.map((row) => row.toolAction.key))];
    const keyToId = new Map<string, string>(
      allowedActions.map((row) => [row.toolAction.key, row.toolAction.id])
    );

    const [groupAdmin, groupOperator, groupViewer] = await Promise.all([
      tx.group.upsert({
        where: { tenantId_name: { tenantId: params.tenantId, name: 'ADM_CLIENTE' } },
        create: { tenantId: params.tenantId, name: 'ADM_CLIENTE', description: 'Admin do tenant' },
        update: { description: 'Admin do tenant', status: 'ativo', suspendedReason: null },
      }),
      tx.group.upsert({
        where: { tenantId_name: { tenantId: params.tenantId, name: 'OPERATOR' } },
        create: { tenantId: params.tenantId, name: 'OPERATOR', description: 'Operador do tenant' },
        update: { description: 'Operador do tenant', status: 'ativo', suspendedReason: null },
      }),
      tx.group.upsert({
        where: { tenantId_name: { tenantId: params.tenantId, name: 'VIEWER' } },
        create: { tenantId: params.tenantId, name: 'VIEWER', description: 'Somente leitura' },
        update: { description: 'Somente leitura', status: 'ativo', suspendedReason: null },
      }),
    ]);

    const adminKeys = allowedToolActionKeys;
    const viewerKeys = allowedToolActionKeys.filter(isReadAction);
    const operatorKeys = [...new Set([...viewerKeys, ...baseOperatorKeys])].filter((key) =>
      allowedToolActionKeys.includes(key)
    );

    await Promise.all([
      this.upsertGroupPermissions(tx, params.tenantId, groupAdmin.id, adminKeys, keyToId),
      this.upsertGroupPermissions(tx, params.tenantId, groupOperator.id, operatorKeys, keyToId),
      this.upsertGroupPermissions(tx, params.tenantId, groupViewer.id, viewerKeys, keyToId),
    ]);

    if (params.adminUserId) {
      await tx.userGroup.upsert({
        where: {
          tenantId_userId_groupId: {
            tenantId: params.tenantId,
            userId: params.adminUserId,
            groupId: groupAdmin.id,
          },
        },
        create: { tenantId: params.tenantId, userId: params.adminUserId, groupId: groupAdmin.id },
        update: {},
      });
    }
  }

  private async upsertGroupPermissions(
    tx: Prisma.TransactionClient,
    tenantId: string,
    groupId: string,
    toolActionKeys: string[],
    keyToId: Map<string, string>
  ): Promise<void> {
    for (const key of toolActionKeys) {
      const toolActionId = keyToId.get(key);
      if (!toolActionId) continue;

      await tx.groupPermission.upsert({
        where: { tenantId_groupId_toolActionId: { tenantId, groupId, toolActionId } },
        create: { tenantId, groupId, toolActionId },
        update: {},
      });
    }
  }
}
