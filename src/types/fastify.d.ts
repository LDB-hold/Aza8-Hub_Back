import type { RequestAuthContext } from '../modules/infra/auth/request-context';

declare module 'fastify' {
  interface FastifyRequest {
    aza8?: RequestAuthContext;
  }
}
