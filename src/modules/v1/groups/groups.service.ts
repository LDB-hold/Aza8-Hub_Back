import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { OutboxService } from '../../infra/outbox/outbox.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { CreateGroupDto } from './dto/create-group.dto';
import type { UpdateGroupDto } from './dto/update-group.dto';
import type { UpdateGroupStatusDto } from './dto/update-group-status.dto';

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

export type ListGroupsResponse = {
  items: Array<{ id: string; name: string; description: string | null; status: string; createdAt: string }>;
  meta: { nextCursor?: string; hasMore: boolean };
};

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService, private readonly outbox: OutboxService) {}

  async createGroup(tenantId: string, dto: CreateGroupDto): Promise<{ id: string }> {
    const group = await this.prisma.group.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        status: dto.status ?? 'ativo',
      },
      select: { id: true },
    });
    return group;
  }

  async listGroups(
    tenantId: string,
    params: { limit?: string; cursor?: string; status?: string; q?: string }
  ): Promise<ListGroupsResponse> {
    const limit = parseLimit(params.limit);
    const cursor = decodeCursor(params.cursor);

    const statusFilter =
      params.status === 'ativo' || params.status === 'suspenso' ? params.status : undefined;

    const q = params.q?.trim();

    const groups = await this.prisma.group.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: statusFilter,
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
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
      select: { id: true, name: true, description: true, status: true, createdAt: true },
    });

    const hasMore = groups.length > limit;
    const sliced = groups.slice(0, limit);
    const nextCursor = hasMore
      ? encodeCursor({
          createdAt: sliced[sliced.length - 1]!.createdAt.toISOString(),
          id: sliced[sliced.length - 1]!.id,
        })
      : undefined;

    return {
      items: sliced.map((g) => ({ ...g, createdAt: g.createdAt.toISOString() })),
      meta: { hasMore, nextCursor },
    };
  }

  async updateGroup(tenantId: string, id: string, dto: UpdateGroupDto): Promise<void> {
    const updated = await this.prisma.group.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { name: dto.name, description: dto.description },
    });

    if (updated.count === 0) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        message: 'Group not found',
      });
    }
  }

  async updateGroupStatus(tenantId: string, id: string, dto: UpdateGroupStatusDto): Promise<void> {
    const updated = await this.prisma.group.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { status: dto.status, suspendedReason: dto.suspendedReason },
    });

    if (updated.count === 0) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        message: 'Group not found',
      });
    }
  }

  async addUserToGroup(tenantId: string, groupId: string, userId: string): Promise<void> {
    const [group, user] = await Promise.all([
      this.prisma.group.findFirst({
        where: { id: groupId, tenantId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.user.findFirst({
        where: { id: userId, tenantId, deletedAt: null },
        select: { id: true },
      }),
    ]);

    if (!group) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        message: 'Group not found',
      });
    }

    if (!user) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        message: 'User not found',
      });
    }

    await this.prisma.userGroup.upsert({
      where: { tenantId_userId_groupId: { tenantId, userId, groupId } },
      create: { tenantId, userId, groupId },
      update: {},
    });
  }

  async removeUserFromGroup(tenantId: string, groupId: string, userId: string): Promise<void> {
    await this.prisma.userGroup.deleteMany({
      where: { tenantId, groupId, userId },
    });
  }

  async addGroupPermissions(tenantId: string, groupId: string, toolActionKeys: string[]): Promise<void> {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!group) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        message: 'Group not found',
      });
    }

    const actions = await this.prisma.toolAction.findMany({
      where: { key: { in: toolActionKeys } },
      select: { id: true, key: true },
    });

    const missingKeys = toolActionKeys.filter((key) => !actions.some((a) => a.key === key));
    if (missingKeys.length > 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: `Unknown toolActionKeys: ${missingKeys.join(', ')}`,
      });
    }

    for (const action of actions) {
      await this.prisma.groupPermission.upsert({
        where: { tenantId_groupId_toolActionId: { tenantId, groupId, toolActionId: action.id } },
        create: { tenantId, groupId, toolActionId: action.id },
        update: {},
      });
    }

    await this.outbox.enqueueWebhookEvent(tenantId, {
      type: 'group.permission.changed',
      payload: { groupId },
    });
  }

  async removeGroupPermission(tenantId: string, groupId: string, permissionId: string): Promise<void> {
    await this.prisma.groupPermission.deleteMany({
      where: { id: permissionId, tenantId, groupId },
    });

    await this.outbox.enqueueWebhookEvent(tenantId, {
      type: 'group.permission.changed',
      payload: { groupId },
    });
  }
}
