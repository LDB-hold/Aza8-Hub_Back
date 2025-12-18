import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma/prisma.service';

export type MeResponse = {
  user: { id: string; email: string; name: string; status: string };
  tenant: { id: string; slug: string; name: string; status: string };
  role?: string;
  groups: Array<{ id: string; name: string }>;
};

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(params: { tenantId: string; userId: string; role?: string }): Promise<MeResponse> {
    const user = await this.prisma.user.findFirst({
      where: { id: params.userId, tenantId: params.tenantId, deletedAt: null },
      select: { id: true, email: true, name: true, status: true },
    });
    if (!user) {
      return {
        user: { id: params.userId, email: '', name: '', status: 'suspenso' },
        tenant: { id: params.tenantId, slug: '', name: '', status: 'suspenso' },
        role: params.role,
        groups: [],
      };
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: params.tenantId },
      select: { id: true, slug: true, name: true, status: true },
    });

    const groups = await this.prisma.userGroup.findMany({
      where: { tenantId: params.tenantId, userId: params.userId },
      select: { group: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return {
      user: { ...user },
      tenant: tenant ?? { id: params.tenantId, slug: '', name: '', status: 'suspenso' },
      role: params.role,
      groups: groups.map((row) => row.group),
    };
  }
}

