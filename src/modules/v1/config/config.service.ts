import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../infra/prisma/prisma.service';
import type { UpdateConfigDto } from './dto/update-config.dto';

export type TenantConfigResponse = {
  flags: Record<string, unknown> | null;
  limits: Record<string, unknown> | null;
};

@Injectable()
export class ConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(tenantId: string): Promise<TenantConfigResponse> {
    const cfg = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: { flags: true, limits: true },
    });

    return {
      flags: (cfg?.flags as Record<string, unknown> | null) ?? null,
      limits: (cfg?.limits as Record<string, unknown> | null) ?? null,
    };
  }

  async putConfig(tenantId: string, dto: UpdateConfigDto): Promise<TenantConfigResponse> {
    const flags = dto.flags ? (dto.flags as Prisma.InputJsonValue) : undefined;
    const limits = dto.limits ? (dto.limits as Prisma.InputJsonValue) : undefined;

    const cfg = await this.prisma.tenantConfig.upsert({
      where: { tenantId },
      create: { tenantId, flags, limits },
      update: { flags, limits },
      select: { flags: true, limits: true },
    });

    return {
      flags: (cfg.flags as Record<string, unknown> | null) ?? null,
      limits: (cfg.limits as Record<string, unknown> | null) ?? null,
    };
  }
}
