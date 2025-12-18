# Progress

## Definições (concluído)
[x] - Stack e runtime: definido como Node.js 20 LTS + TypeScript, NestJS com adapter Fastify, Supabase (Postgres) e Prisma Migrate/Client; RLS desativado (enforcement na aplicação).
[x] - Modelo de dados inicial: schema com tenancy por `tenant_id`, catálogo global (tool/package/tool_action), vínculos por tenant (tenant_package, overrides), identidade e RBAC (user/group/user_group/group_permission/api_key), auditoria/governança (audit_log/idempotency/outbox), uso, integrações e branding; UUIDs, timestamps, status enum, índices por tenant e uniques chaveados.
[x] - Resolução de tenant: `tenantId` no claim (JWT/API key) como fonte principal; header `X-Tenant-Id` só para service accounts; se claim ≠ header, 400; guard global valida tenant ativo e injeta contexto; pipes/interceptors bloqueiam tenant vindo do payload.
[x] - Autenticação/autorização: auth interno com opção de IdP depois; JWT RS256 (~15m) com `sub/tenantId/role/type/exp/jti`; refresh tokens com rotação/revogação; API keys com hash e escopo por `tool_action`; guard global autentica e valida tenant ativo; guard de autorização mapeia rota→tool_action; pipes/interceptors bloqueiam override de tenant.
[x] - Contratos de API v1: REST `/v1` com Bearer JWT/API key; onboarding de tenant+package+ADM_CLIENTE; catálogo global; gestão por tenant (users/groups/permissions/membership/API keys); auditoria; branding/config; usage; `X-Tenant-Id` só para service accounts; envelopes `{data, meta?}`; erros com códigos internos.
[x] - Provisionamento e seeds: comando único (`make seed`/`npm run seed`); seeds globais (catalogo tools/actions/packages) via upsert; por tenant cria grupos base, permissões, admin inicial e vincula package; projetos Supabase dev/prod separados; em prod seeds de tenant só via comando explícito; service_role com RLS off.
[x] - Observabilidade: logs JSON com `requestId/tenantId/actor`, redaction de PII/segredos, métricas (latência/erros/códigos internos) sem labels de alta cardinalidade, Sentry para error tracking e OpenTelemetry para tracing, `/health` e `/metrics` restrito.
[x] - Estratégia de migração e dados: Prisma Migrate; dev com `migrate dev` + `generate` + seed; prod só `migrate deploy`; FKs/índices nomeados; revisão/dry-run em staging/CI; correções forward; service_role restrito a migração/seed.
[x] - Estratégia de testes: Jest + @nestjs/testing + supertest; unit (RBAC/tenant/redaction), integration (Prisma+DB com migrations/seeds/idempotency/audit), e2e (onboarding, tenant enforcement, RBAC, API key scope/revogação, auditoria, /metrics restrito); Postgres descartável recomendado.
[x] - Governança de erros: resposta padronizada `{ error: { code, message, details?, requestId } }`, ExceptionFilter global, catálogo de códigos (VALIDATION/TENANT/AUTH/RBAC/NOT_FOUND/CONFLICT/RATE_LIMIT/INTERNAL) e mapeamento para HTTP; sem stack/PII no cliente, com Sentry/logs para debug.

## Implementação do backend (MVP)
[x] - Bootstrap do projeto (NestJS + Fastify adapter) e estrutura de pastas (modules/domains/infra).
[x] - Configuração e validação de env vars (dev/staging/prod) conforme `docs/development.md`.
[x] - Setup Prisma (schema + generate) e migração inicial no Supabase dev.
[x] - Implementar schema do banco (tabelas e constraints) conforme `working-notes.md` (modelo de dados).
[x] - Seed idempotente: catálogo global + seeds por tenant (grupos base/pacote/admin) conforme `docs/platform-overview.md`.
[x] - Implementar `/health` + `X-Request-Id` + logger JSON (base de observabilidade).
[x] - Implementar autenticação (JWT RS256 + refresh + API keys) conforme `docs/api/v1.md`.
[x] - Implementar resolução de tenant (claim `tenantId`; `X-Tenant-Id` só service accounts; mismatch → 400).
[x] - Implementar RBAC por `tool_action` (metadata por rota + guard; deny-by-default) conforme `docs/rbac.md`.
[x] - Implementar endpoints v1: onboarding de tenant e package (`POST /v1/tenants`, assign, seeds) conforme `docs/api/v1.md`.
[x] - Implementar endpoints v1: catálogo global (tools/actions/packages) conforme `docs/api/v1.md`.
[x] - Implementar endpoints v1: users/groups/membership/permissions conforme `docs/api/v1.md`.
[x] - Implementar endpoints v1: api-keys, audit-logs, branding/config, usage conforme `docs/api/v1.md`.
[x] - Implementar `/metrics` (restrito) + Sentry (error tracking) + OTel (opcional) conforme `working-notes.md`.
[x] - Implementar outbox/worker + webhooks v1 (perfil MVP) com retries e DLQ conforme `working-notes.md`.
[x] - Implementar testes unit/integration/e2e (cenários de `docs/e2e.md`) e scripts `npm test`.
