import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { PrismaService } from '../../infra/prisma/prisma.service';

type CursorPayload = { createdAt: string; id: string };

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeCursor(cursor?: string): CursorPayload | undefined {
  if (!cursor) return undefined;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as CursorPayload;
    if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function parseLimit(value?: string): number {
  const parsed = value ? Number(value) : 50;
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(Math.floor(parsed), 100);
}

function isIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

export type ListAuditLogsResponse = {
  items: Array<{
    id: string;
    actorType: string;
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
  meta: { nextCursor?: string; hasMore: boolean };
};

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAuditLogs(
    tenantId: string,
    params: {
      limit?: string;
      cursor?: string;
      actor?: string;
      action?: string;
      entityType?: string;
      createdAtFrom?: string;
      createdAtTo?: string;
    }
  ): Promise<ListAuditLogsResponse> {
    const limit = parseLimit(params.limit);
    const cursor = decodeCursor(params.cursor);

    if (params.createdAtFrom && !isIsoDate(params.createdAtFrom)) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'Invalid createdAtFrom',
      });
    }

    if (params.createdAtTo && !isIsoDate(params.createdAtTo)) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'Invalid createdAtTo',
      });
    }

    const createdAtFrom = params.createdAtFrom ? new Date(params.createdAtFrom) : undefined;
    const createdAtTo = params.createdAtTo ? new Date(params.createdAtTo) : undefined;

    const logs = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        ...(params.actor ? { actorUserId: params.actor } : {}),
        ...(params.action ? { action: params.action } : {}),
        ...(params.entityType ? { entityType: params.entityType } : {}),
        ...(createdAtFrom ? { createdAt: { gte: createdAtFrom } } : {}),
        ...(createdAtTo ? { createdAt: { lte: createdAtTo } } : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        actorType: true,
        actorUserId: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
      },
    });

    const hasMore = logs.length > limit;
    const sliced = logs.slice(0, limit);
    const nextCursor = hasMore
      ? encodeCursor({
          createdAt: sliced[sliced.length - 1]!.createdAt.toISOString(),
          id: sliced[sliced.length - 1]!.id,
        })
      : undefined;

    return {
      items: sliced.map((l) => ({
        id: l.id,
        actorType: l.actorType,
        actorUserId: l.actorUserId,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        metadata: (l.metadata as Record<string, unknown> | null) ?? null,
        createdAt: l.createdAt.toISOString(),
      })),
      meta: { hasMore, nextCursor },
    };
  }
}

