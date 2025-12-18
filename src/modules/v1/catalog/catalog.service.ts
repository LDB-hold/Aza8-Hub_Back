import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { CreatePackageDto } from './dto/create-package.dto';
import type { CreateToolActionDto } from './dto/create-tool-action.dto';
import type { CreateToolDto } from './dto/create-tool.dto';

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

export type ListToolsResponse = {
  items: Array<{ id: string; key: string; name: string; description: string | null; status: string }>;
  meta: { nextCursor?: string; hasMore: boolean };
};

export type ListPackagesResponse = {
  items: Array<{ id: string; key: string; name: string; description: string | null; status: string }>;
  meta: { nextCursor?: string; hasMore: boolean };
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async createTool(dto: CreateToolDto): Promise<{ id: string }> {
    const tool = await this.prisma.tool.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        status: dto.status ?? 'ativo',
      },
      select: { id: true },
    });
    return tool;
  }

  async listTools(params: { limit?: string; cursor?: string }): Promise<ListToolsResponse> {
    const limit = parseLimit(params.limit);
    const cursor = decodeCursor(params.cursor);

    const items = await this.prisma.tool.findMany({
      where: cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
            ],
          }
        : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: { id: true, key: true, name: true, description: true, status: true, createdAt: true },
    });

    const hasMore = items.length > limit;
    const sliced = items.slice(0, limit);

    const nextCursor = hasMore
      ? encodeCursor({ createdAt: sliced[sliced.length - 1]!.createdAt.toISOString(), id: sliced[sliced.length - 1]!.id })
      : undefined;

    return {
      items: sliced.map(({ createdAt: _createdAt, ...rest }) => rest),
      meta: { hasMore, nextCursor },
    };
  }

  async createToolAction(toolKey: string, dto: CreateToolActionDto): Promise<{ id: string }> {
    const tool = await this.prisma.tool.findUnique({
      where: { key: toolKey },
      select: { id: true },
    });
    if (!tool) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        message: 'Tool not found',
      });
    }

    const action = await this.prisma.toolAction.create({
      data: {
        toolId: tool.id,
        key: dto.key,
        name: dto.name,
        description: dto.description,
        status: dto.status ?? 'ativo',
      },
      select: { id: true },
    });
    return action;
  }

  async createPackage(dto: CreatePackageDto): Promise<{ id: string }> {
    const pkg = await this.prisma.package.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        status: dto.status ?? 'ativo',
      },
      select: { id: true },
    });
    return pkg;
  }

  async listPackages(params: { limit?: string; cursor?: string }): Promise<ListPackagesResponse> {
    const limit = parseLimit(params.limit);
    const cursor = decodeCursor(params.cursor);

    const items = await this.prisma.package.findMany({
      where: cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
            ],
          }
        : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: { id: true, key: true, name: true, description: true, status: true, createdAt: true },
    });

    const hasMore = items.length > limit;
    const sliced = items.slice(0, limit);
    const nextCursor = hasMore
      ? encodeCursor({ createdAt: sliced[sliced.length - 1]!.createdAt.toISOString(), id: sliced[sliced.length - 1]!.id })
      : undefined;

    return {
      items: sliced.map(({ createdAt: _createdAt, ...rest }) => rest),
      meta: { hasMore, nextCursor },
    };
  }

  async setPackageActions(packageKey: string, toolActionKeys: string[]): Promise<void> {
    const pkg = await this.prisma.package.findUnique({
      where: { key: packageKey },
      select: { id: true },
    });
    if (!pkg) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        message: 'Package not found',
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

    await this.prisma.$transaction(async (tx) => {
      await tx.packageToolAction.deleteMany({
        where: { packageId: pkg.id, toolActionId: { notIn: actions.map((a) => a.id) } },
      });

      for (const action of actions) {
        await tx.packageToolAction.upsert({
          where: { packageId_toolActionId: { packageId: pkg.id, toolActionId: action.id } },
          create: { packageId: pkg.id, toolActionId: action.id },
          update: {},
        });
      }
    });
  }
}

