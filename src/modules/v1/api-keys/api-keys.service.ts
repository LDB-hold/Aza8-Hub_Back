import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

import { AppError } from '../../../common/errors/app-error';
import { OutboxService } from '../../infra/outbox/outbox.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { CreateApiKeyDto } from './dto/create-api-key.dto';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function generateApiKeyValue(): string {
  const random = randomBytes(32).toString('base64url');
  return `aza8_sk_${random}`;
}

type ApiKeyProfileDb = 'read_only' | 'write' | 'admin';

function mapProfileToDb(profile?: 'read-only' | 'write' | 'admin'): ApiKeyProfileDb | undefined {
  if (!profile) return undefined;
  if (profile === 'read-only') return 'read_only';
  return profile;
}

export type ListApiKeysResponse = Array<{
  id: string;
  name: string;
  status: string;
  profile: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}>;

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService, private readonly outbox: OutboxService) {}

  async createApiKey(tenantId: string, dto: CreateApiKeyDto): Promise<{ id: string; value: string }> {
    if (!dto.profile && (!dto.toolActionKeys || dto.toolActionKeys.length === 0)) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'toolActionKeys or profile is required',
      });
    }

    const value = generateApiKeyValue();
    const hash = sha256Hex(value);

    const toolActions = dto.toolActionKeys
      ? await this.prisma.toolAction.findMany({
          where: { key: { in: dto.toolActionKeys } },
          select: { id: true, key: true },
        })
      : [];

    if (dto.toolActionKeys) {
      const missingKeys = dto.toolActionKeys.filter((key) => !toolActions.some((a) => a.key === key));
      if (missingKeys.length > 0) {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          httpStatus: 400,
          message: `Unknown toolActionKeys: ${missingKeys.join(', ')}`,
        });
      }
    }

    const apiKey = await this.prisma.$transaction(async (tx) => {
      const created = await tx.apiKey.create({
        data: {
          tenantId,
          name: dto.name,
          hash,
          profile: mapProfileToDb(dto.profile),
          status: 'ativo',
        },
        select: { id: true },
      });

      for (const action of toolActions) {
        await tx.apiKeyToolAction.upsert({
          where: { tenantId_apiKeyId_toolActionId: { tenantId, apiKeyId: created.id, toolActionId: action.id } },
          create: { tenantId, apiKeyId: created.id, toolActionId: action.id },
          update: {},
        });
      }

      return created;
    });

    return { id: apiKey.id, value };
  }

  async listApiKeys(tenantId: string): Promise<ListApiKeysResponse> {
    const keys = await this.prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, status: true, profile: true, expiresAt: true, lastUsedAt: true, createdAt: true },
    });

    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      status: k.status,
      profile: k.profile,
      expiresAt: k.expiresAt ? k.expiresAt.toISOString() : null,
      lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
      createdAt: k.createdAt.toISOString(),
    }));
  }

  async updateApiKeyStatus(tenantId: string, id: string, status: 'ativo' | 'suspenso'): Promise<void> {
    const updated = await this.prisma.apiKey.updateMany({
      where: { id, tenantId },
      data: { status },
    });

    if (updated.count === 0) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        message: 'API key not found',
      });
    }

    if (status === 'suspenso') {
      await this.outbox.enqueueWebhookEvent(tenantId, {
        type: 'api_key.revoked',
        payload: { apiKeyId: id },
      });
    }
  }
}
