import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { createHmac } from 'crypto';
import { fetch } from 'undici';

type WorkerConfig = {
  pollIntervalMs: number;
  batchSize: number;
  maxAttempts: number;
};

function readWorkerConfig(): WorkerConfig {
  const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 1000);
  const batchSize = Number(process.env.WORKER_BATCH_SIZE ?? 10);
  const maxAttempts = Number(process.env.WORKER_MAX_ATTEMPTS ?? 5);

  return {
    pollIntervalMs: Number.isFinite(pollIntervalMs) ? pollIntervalMs : 1000,
    batchSize: Number.isFinite(batchSize) ? batchSize : 10,
    maxAttempts: Number.isFinite(maxAttempts) ? maxAttempts : 5,
  };
}

function computeBackoffMs(attempt: number): number {
  const base = 60_000; // 1 minute
  const max = 60 * 60_000; // 1 hour
  const value = Math.min(base * Math.pow(3, Math.max(attempt - 1, 0)), max);
  return Math.floor(value);
}

function signPayload(secret: string, body: string): string {
  const hmac = createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${hmac}`;
}

async function processWebhookDelivery(prisma: PrismaClient, deliveryId: string, maxAttempts: number): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { subscription: { select: { url: true, secret: true, status: true } } },
  });

  if (!delivery) return;
  if (delivery.status === 'delivered' || delivery.status === 'dead') return;
  if (delivery.subscription.status !== 'ativo') return;

  const body = JSON.stringify({
    eventId: delivery.eventId,
    type: delivery.eventType,
    createdAt: delivery.createdAt.toISOString(),
    data: delivery.payload,
  });

  const signature = signPayload(delivery.subscription.secret, body);

  const attempt = delivery.attempts + 1;
  const now = new Date();

  try {
    const response = await fetch(delivery.subscription.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-aza8-event-id': delivery.eventId,
        'x-aza8-event-type': delivery.eventType,
        'x-aza8-signature': signature,
      },
      body,
    });

    const responseText = await response.text();

    if (response.ok) {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'delivered',
          attempts: attempt,
          lastAttemptAt: now,
          responseStatus: response.status,
          responseBody: responseText.slice(0, 10_000),
          lastError: null,
        },
      });
      return;
    }

    const lastError = `HTTP ${response.status}`;
    const nextAttemptAt = attempt >= maxAttempts ? null : new Date(Date.now() + computeBackoffMs(attempt));

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: attempt >= maxAttempts ? 'dead' : 'failed',
        attempts: attempt,
        lastAttemptAt: now,
        nextAttemptAt,
        responseStatus: response.status,
        responseBody: responseText.slice(0, 10_000),
        lastError,
      },
    });
  } catch (error: unknown) {
    const lastError = error instanceof Error ? error.message : 'Unknown error';
    const nextAttemptAt = attempt >= maxAttempts ? null : new Date(Date.now() + computeBackoffMs(attempt));

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: attempt >= maxAttempts ? 'dead' : 'failed',
        attempts: attempt,
        lastAttemptAt: now,
        nextAttemptAt,
        lastError,
      },
    });
  }
}

async function workerLoop(): Promise<void> {
  const config = readWorkerConfig();
  const prisma = new PrismaClient();

  console.log('[worker] Starting', config);

  while (true) {
    const now = new Date();

    const jobs = await prisma.outboxJob.findMany({
      where: { status: 'pending', availableAt: { lte: now } },
      orderBy: { availableAt: 'asc' },
      take: config.batchSize,
      select: { id: true, type: true, payload: true, retries: true },
    });

    for (const job of jobs) {
      const claimed = await prisma.outboxJob.updateMany({
        where: { id: job.id, status: 'pending' },
        data: { status: 'processing' },
      });
      if (claimed.count === 0) continue;

      try {
        if (job.type === 'webhook.deliver') {
          const payload = job.payload as { deliveryId?: string };
          if (payload && typeof payload.deliveryId === 'string') {
            await processWebhookDelivery(prisma, payload.deliveryId, config.maxAttempts);
          }
        }

        await prisma.outboxJob.update({
          where: { id: job.id },
          data: { status: 'done', lastError: null },
        });
      } catch (error: unknown) {
        const lastError = error instanceof Error ? error.message : 'Unknown error';
        const retries = job.retries + 1;

        const shouldDeadLetter = retries >= config.maxAttempts;
        const availableAt = shouldDeadLetter ? null : new Date(Date.now() + computeBackoffMs(retries));

        await prisma.outboxJob.update({
          where: { id: job.id },
          data: {
            status: shouldDeadLetter ? 'dead' : 'pending',
            retries,
            availableAt: availableAt ?? new Date(),
            lastError,
          },
        });
      }
    }

    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

void workerLoop().catch((error: unknown) => {
  console.error('[worker] Fatal', error);
  process.exitCode = 1;
});

