import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { OutboxService } from '../../infra/outbox/outbox.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { UpdateUserStatusDto } from './dto/update-user-status.dto';

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

export type ListUsersResponse = {
  items: Array<{ id: string; email: string; name: string; status: string; createdAt: string }>;
  meta: { nextCursor?: string; hasMore: boolean };
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly outbox: OutboxService) {}

  async createUser(tenantId: string, dto: CreateUserDto): Promise<{ id: string }> {
    if (dto.groupIds && dto.groupIds.length > 0) {
      const groups = await this.prisma.group.findMany({
        where: { tenantId, id: { in: dto.groupIds }, deletedAt: null },
        select: { id: true },
      });

      if (groups.length !== dto.groupIds.length) {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          httpStatus: 400,
          message: 'Invalid groupIds',
        });
      }
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId,
          email: dto.email,
          name: dto.name,
        },
        select: { id: true },
      });

      if (dto.groupIds && dto.groupIds.length > 0) {
        for (const groupId of dto.groupIds) {
          await tx.userGroup.upsert({
            where: {
              tenantId_userId_groupId: { tenantId, userId: user.id, groupId },
            },
            create: { tenantId, userId: user.id, groupId },
            update: {},
          });
        }
      }

      return user;
    });

    await this.outbox.enqueueWebhookEvent(tenantId, {
      type: 'user.created',
      payload: { userId: user.id },
    });

    return user;
  }

  async listUsers(
    tenantId: string,
    params: { limit?: string; cursor?: string; status?: string; q?: string }
  ): Promise<ListUsersResponse> {
    const limit = parseLimit(params.limit);
    const cursor = decodeCursor(params.cursor);

    const statusFilter =
      params.status === 'ativo' || params.status === 'suspenso' ? params.status : undefined;

    const q = params.q?.trim();

    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: statusFilter,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
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
      select: { id: true, email: true, name: true, status: true, createdAt: true },
    });

    const hasMore = users.length > limit;
    const sliced = users.slice(0, limit);
    const nextCursor = hasMore
      ? encodeCursor({
          createdAt: sliced[sliced.length - 1]!.createdAt.toISOString(),
          id: sliced[sliced.length - 1]!.id,
        })
      : undefined;

    return {
      items: sliced.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
      meta: { hasMore, nextCursor },
    };
  }

  async updateUser(tenantId: string, id: string, dto: UpdateUserDto): Promise<void> {
    const exists = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        message: 'User not found',
      });
    }

    await this.prisma.user.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { name: dto.name },
    });

    await this.outbox.enqueueWebhookEvent(tenantId, {
      type: 'user.updated',
      payload: { userId: id },
    });
  }

  async updateUserStatus(tenantId: string, id: string, dto: UpdateUserStatusDto): Promise<void> {
    const exists = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        message: 'User not found',
      });
    }

    await this.prisma.user.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { status: dto.status, suspendedReason: dto.suspendedReason },
    });

    await this.outbox.enqueueWebhookEvent(tenantId, {
      type: 'user.updated',
      payload: { userId: id },
    });
  }
}
