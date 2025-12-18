process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';

process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/aza8_test?schema=public';

process.env.JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY ?? 'test-private-key';
process.env.JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY ?? 'test-public-key';

process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
process.env.METRICS_TOKEN = process.env.METRICS_TOKEN ?? 'test-metrics-token';

