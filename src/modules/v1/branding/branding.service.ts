import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma/prisma.service';
import type { UpdateBrandingDto } from './dto/update-branding.dto';

export type BrandingResponse = {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  domain: string | null;
};

@Injectable()
export class BrandingService {
  constructor(private readonly prisma: PrismaService) {}

  async getBranding(tenantId: string): Promise<BrandingResponse> {
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
      select: { logoUrl: true, primaryColor: true, secondaryColor: true, domain: true },
    });
    return branding ?? { logoUrl: null, primaryColor: null, secondaryColor: null, domain: null };
  }

  async putBranding(tenantId: string, dto: UpdateBrandingDto): Promise<BrandingResponse> {
    const branding = await this.prisma.tenantBranding.upsert({
      where: { tenantId },
      create: {
        tenantId,
        logoUrl: dto.logoUrl,
        primaryColor: dto.primaryColor,
        secondaryColor: dto.secondaryColor,
        domain: dto.domain,
      },
      update: {
        logoUrl: dto.logoUrl,
        primaryColor: dto.primaryColor,
        secondaryColor: dto.secondaryColor,
        domain: dto.domain,
      },
      select: { logoUrl: true, primaryColor: true, secondaryColor: true, domain: true },
    });

    return branding;
  }
}

