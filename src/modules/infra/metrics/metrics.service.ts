import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

type ObserveParams = {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  errorCode?: string;
};

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  private readonly httpRequestsTotal: Counter<'method' | 'route' | 'status_code' | 'error_code'>;
  private readonly httpRequestDurationMs: Histogram<'method' | 'route' | 'status_code'>;

  constructor() {
    this.registry = new Registry();

    collectDefaultMetrics({ register: this.registry });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      registers: [this.registry],
      labelNames: ['method', 'route', 'status_code', 'error_code'],
    });

    this.httpRequestDurationMs = new Histogram({
      name: 'http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      registers: [this.registry],
      labelNames: ['method', 'route', 'status_code'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    });
  }

  observeHttpRequest(params: ObserveParams): void {
    const statusCode = String(params.statusCode);
    const errorCode = params.errorCode ?? 'none';

    this.httpRequestsTotal.inc({
      method: params.method,
      route: params.route,
      status_code: statusCode,
      error_code: errorCode,
    });

    this.httpRequestDurationMs.observe(
      {
        method: params.method,
        route: params.route,
        status_code: statusCode,
      },
      params.durationMs
    );
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}

