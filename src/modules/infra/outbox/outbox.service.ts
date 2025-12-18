import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

export type WebhookEventType =
  | 'tenant.created'
  | 'tenant.package.assigned'
  | 'user.created'
  | 'user.updated'
  | 'group.permission.changed'
  | 'api_key.revoked';

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueueWebhookEvent(
    tenantId: string,
    params: { type: WebhookEventType; payload: Record<string, unknown> }
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.enqueueWebhookEventTx(tx, tenantId, params);
    });
  }

  async enqueueWebhookEventTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    params: { type: WebhookEventType; payload: Record<string, unknown> }
  ): Promise<void> {
    const subscriptions = await tx.webhookSubscription.findMany({
      where: {
        tenantId,
        status: 'ativo',
        OR: [{ events: { has: params.type } }, { events: { has: '*' } }],
      },
      select: { id: true },
    });

    if (subscriptions.length === 0) return;

    for (const subscription of subscriptions) {
      const eventId = randomUUID();

      const delivery = await tx.webhookDelivery.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          eventType: params.type,
          eventId,
          payload: params.payload as Prisma.InputJsonValue,
          status: 'pending',
        },
        select: { id: true },
      });

      await tx.outboxJob.create({
        data: {
          tenantId,
          type: 'webhook.deliver',
          payload: { deliveryId: delivery.id } as Prisma.InputJsonValue,
          status: 'pending',
        },
      });
    }
  }
}
