import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { PrismaService } from '../../infra/prisma/prisma.service';

export type UsageResponse =
  | {
      groupBy: 'toolAction';
      periodStart?: string;
      periodEnd?: string;
      items: Array<{ toolActionKey: string; count: number }>;
    }
  | {
      groupBy: 'total';
      periodStart?: string;
      periodEnd?: string;
      count: number;
    };

function isIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsage(
    tenantId: string,
    params: { periodStart?: string; periodEnd?: string; groupBy?: string }
  ): Promise<UsageResponse> {
    const start = params.periodStart?.trim();
    const end = params.periodEnd?.trim();

    if (start && !isIsoDate(start)) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'Invalid periodStart',
      });
    }

    if (end && !isIsoDate(end)) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'Invalid periodEnd',
      });
    }

    const periodStart = start ? new Date(start) : undefined;
    const periodEnd = end ? new Date(end) : undefined;

    const whereClause = {
      tenantId,
      ...(periodStart ? { periodStart: { gte: periodStart } } : {}),
      ...(periodEnd ? { periodEnd: { lte: periodEnd } } : {}),
    };

    if (params.groupBy === 'toolAction') {
      const grouped = await this.prisma.usageMetric.groupBy({
        by: ['toolActionId'],
        where: whereClause,
        _sum: { count: true },
      });

      const toolActionIds = grouped.map((g) => g.toolActionId);
      const toolActions = await this.prisma.toolAction.findMany({
        where: { id: { in: toolActionIds } },
        select: { id: true, key: true },
      });
      const idToKey = new Map<string, string>(toolActions.map((t) => [t.id, t.key]));

      return {
        groupBy: 'toolAction',
        periodStart: start,
        periodEnd: end,
        items: grouped.map((g) => ({
          toolActionKey: idToKey.get(g.toolActionId) ?? g.toolActionId,
          count: g._sum.count ?? 0,
        })),
      };
    }

    const total = await this.prisma.usageMetric.aggregate({
      where: whereClause,
      _sum: { count: true },
    });

    return {
      groupBy: 'total',
      periodStart: start,
      periodEnd: end,
      count: total._sum.count ?? 0,
    };
  }
}

