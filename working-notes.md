# Working Notes

Este arquivo concentra decisões e anotações de trabalho do backend (working notes).

- Documentação oficial: `docs/` (ex.: `docs/api/v1.md`)

# Backend Estrutura

## Stack e runtime
- Linguagem/runtime: Node.js 20 LTS + TypeScript.
- Framework HTTP: NestJS com adapter Fastify (DI nativa, guards/pipes/interceptors para multi-tenant e RBAC).
- Banco de dados: Supabase (Postgres gerenciado).
- Migrations/ORM: Prisma Migrate + Prisma Client.
- RLS: desativado no Supabase; enforcement de tenant/RBAC feito na aplicação (guards/pipes/interceptors), usando conexão service_role.

## Modelo de dados inicial
- Tenancy: coluna `tenant_id` em tabelas de domínio; tabelas globais sem tenant (`tool`, `package`, `tool_action`).
- Identificadores e status: UUID em todas as tabelas; `created_at`/`updated_at`; `deleted_at` opcional; status enum (`ativo`, `suspenso`) com `suspended_reason` onde fizer sentido.
- Catálogo global:
  - `tool`: `id`, `key` único, `name`, `description`, `status`.
  - `package`: `id`, `key` único, `name`, `description`, `status`.
  - `tool_action`: `id`, `tool_id` FK, `key` único, `name`, `description`, `status`.
- Tenancy e oferta:
  - `tenant`: `id`, `slug` único, `name`, `status`, `suspended_reason`, `created_at`, `updated_at`.
  - `tenant_package`: `id`, `tenant_id` FK, `package_id` FK, `status`, `assigned_at`, `expires_at`; unique (`tenant_id`, `package_id`).
  - `tenant_tool_override` (opcional): `tenant_id` FK, `tool_id`/`tool_action_id`, `flags/limits` (jsonb) para customização por tenant.
- Identidade e RBAC:
  - `user`: `id`, `tenant_id` FK, `email` unique por tenant, `name`, `status`, `auth_provider` (interno/IdP), `suspended_reason`, `created_at`, `updated_at`, `deleted_at` opcional.
  - `group`: `id`, `tenant_id` FK, `name` unique por tenant, `description`, `status`, `suspended_reason`, `created_at`, `updated_at`, `deleted_at` opcional.
  - `user_group`: `id`, `tenant_id` FK, `user_id` FK, `group_id` FK, `created_at`; unique (`tenant_id`, `user_id`, `group_id`).
  - `group_permission`: `id`, `tenant_id` FK, `group_id` FK, `tool_action_id` FK, `scope/constraints` (jsonb) opcional, `created_at`; unique (`tenant_id`, `group_id`, `tool_action_id`).
  - `api_key`/`service_account`: `id`, `tenant_id` FK, `name`, `role`, `hash`, `expires_at`, `last_used_at`, `status`; `name` unique por tenant; `actor_type = service` para auditoria.
- Auditoria e governança:
  - `audit_log`: `id`, `tenant_id` FK, `actor_user_id` FK opcional, `actor_type` (user/service), `action`, `entity_type`, `entity_id`, `metadata` (jsonb), `ip`, `user_agent`, `created_at`; índice (`tenant_id`, `created_at`).
  - `idempotency_key`: `id`, `tenant_id` FK, `key`, `handler`, `status`, `response_hash`, `created_at`, `updated_at`; unique (`tenant_id`, `key`, `handler`).
  - `job_queue`/`outbox`: `id`, `tenant_id` FK opcional, `type`, `payload` (jsonb), `status`, `retries`, `available_at`, `created_at`.
- Observabilidade e uso:
  - `usage_metrics`: `id`, `tenant_id` FK, `tool_action_id` FK, `period_start`, `period_end`, `count`; índice (`tenant_id`, `period_start`).
- Integração e segredos:
  - `integration_credential`: `id`, `tenant_id` FK, `provider`, `name`, `data_encrypted`, `created_at`, `updated_at`, `expires_at`.
- Branding e config:
  - `tenant_config`: `id`, `tenant_id` FK, `flags/limits` (jsonb).
  - `tenant_branding`: `id`, `tenant_id` FK, `logo_url`, `primary_color`, `secondary_color`, `domain`.
- Índices e constraints:
  - Índices em todos os FKs e em (`tenant_id`, `created_at`) para auditoria/uso.
  - Unique: já citados (email por tenant, group name por tenant, tenant_package, user_group, group_permission, tool/package/tool_action keys).
  - Naming: `fk_<tabela>_<coluna>`, `idx_<tabela>_<cols>` para consistência.
- RLS: desativado (Supabase); enforcement de tenant/RBAC na aplicação.

## Resolução de tenant
- Fonte principal: claim `tenantId` no token (JWT ou API key). Tenant precisa existir e estar ativo.
- Header: `X-Tenant-Id` (case-insensitive) aceito apenas para service accounts/API keys; usuários finais não usam header.
- Conflito claim vs header: se ambos vierem e divergirem, responder 400 (rejeita a requisição).
- Guard global (Nest): extrai `tenantId` do claim; para service accounts pode aceitar header, valida tenant ativo e injeta no contexto. Pipes/interceptors impedem uso de tenant vindo do payload.
- Tokens/keys: emitidos já atrelados a um único tenant; não é permitido “trocar” tenant via header para usuários finais.

## Autenticação e autorização
- Identidade: auth interno (usuário em `user`); deixar pronto para plugar IdP/OIDC depois. Service accounts via `api_key` com hash.
- Access token: JWT RS256, expiração curta (~15m). Claims: `sub` (userId ou serviceId), `tenantId`, `role`/grupos, `type` (`user`/`service`), `exp`, `jti`.
- Refresh token: habilitado, expiração longa (ex.: 7–30 dias), armazenado com hash + `revoked_at` + `jti` para rotação e revogação.
- Revogação: blacklist por `jti`; logout invalida refresh; API keys podem ser desativadas por status.
- RBAC: autorização por guards baseado em grupo/permissão (`tool_action_id`); API keys têm escopo por `tool_action` ou perfil predefinido (read-only/write/admin).
- Enforcements: guard global autentica e valida tenant ativo; guard de autorização mapeia rota → `tool_action` e checa permissão/escopo; pipes/interceptors evitam override de tenant em payload.

## Segurança e compliance (LGPD)
- Princípios: minimização de dados, least privilege, segregação por tenant, rastreabilidade (audit_log) e redaction de PII/segredos em logs.
- Retenção:
  - Definir política por tipo de dado (ex.: `audit_log`, `usage_metrics`, logs de webhook deliveries).
  - Preferir retenção + arquivamento (hot storage por N dias/meses; archive para dados antigos).
- Exportação de dados por tenant:
  - Endpoint/admin ou job assíncrono para export (JSON/CSV), com escopo estrito (ADM_CLIENTE) e trilha em `audit_log`.
- Remoção/anônimização de usuário:
  - Preferir soft delete (`deleted_at`) + anônimização de PII (ex.: substituir `email`/`name` por valores irreversíveis) mantendo `user.id` para integridade histórica.
  - Garantir que `audit_log` não vaze PII; armazenar referências por id.
- Criptografia de `integration_credential`:
  - Armazenar segredos criptografados na aplicação (ex.: `data_encrypted`) e manter chaves fora do banco (secret manager/KMS).
  - Rotação: suportar `key_version` e reencrypt via job (sem downtime).
- Acesso mínimo ao banco:
  - Usar credencial com privilégio mínimo no runtime; service_role/admin apenas em migrações/seeds (CI) e fluxos controlados.
- Logs e PII:
  - Nunca logar tokens/chaves/senhas; `details` em erros sem PII; redaction antes de enviar para Sentry.

## Contratos de API v1
- Padrões: REST JSON, prefixo `/v1`, Bearer JWT ou API key; `X-Tenant-Id` só para service accounts; envelopes `{ data, meta? }`; erros com códigos internos (ex.: `TENANT_NOT_FOUND`, `FORBIDDEN_ACTION`).
- Onboarding (Aza8/admin cliente):
  - `POST /v1/tenants`: cria tenant + associa `packageKey` + cria usuário ADM_CLIENTE; payload: `slug`, `name`, `packageKey`, `adminUser {email,name}`.
  - `POST /v1/tenants/{tenantId}/packages/{packageKey}/assign`: vincula pacote ao tenant.
  - (Opcional) `POST /v1/tenants/{tenantId}/seeds`: roda seed base (catálogo/roles).
- Catálogo/pacotes (Aza8):
  - `POST /v1/catalog/tools`; `POST /v1/catalog/tools/{toolKey}/actions`; `POST /v1/catalog/packages`; `POST /v1/catalog/packages/{packageKey}/actions`.
  - `GET /v1/catalog/*` para listas/detalhes.
- Gestão por tenant (ADM cliente):
  - Perfil: `GET /v1/me`.
  - Usuários: `POST /v1/users`, `GET /v1/users`, `PATCH /v1/users/{id}`, `PATCH /v1/users/{id}/status`.
  - Grupos: `POST /v1/groups`, `GET /v1/groups`, `PATCH /v1/groups/{id}`, `PATCH /v1/groups/{id}/status`.
  - Membership: `POST /v1/groups/{id}/users/{userId}`, `DELETE /v1/groups/{id}/users/{userId}`.
  - Permissões: `POST /v1/groups/{id}/permissions` (lista de `tool_action`), `DELETE /v1/groups/{id}/permissions/{permissionId}`.
  - API keys: `POST /v1/api-keys` (escopo por `tool_action` ou perfil), `GET /v1/api-keys`, `PATCH /v1/api-keys/{id}/status`, rotate.
- Auditoria:
  - `GET /v1/audit-logs` com filtros (`actor`, `action`, `entity_type`, datas). Eventos: login/logout, user/group CRUD, permissões, API keys, package assignment.
- Whitelabel/branding:
  - `GET/PUT /v1/branding` (logo/cores/domínio), `GET/PUT /v1/config` (flags/limits por tenant).
- Observabilidade/uso:
  - `GET /health` (sem auth).
  - `GET /v1/usage` por tenant, agrupado por `tool_action`, período.

## Padrões de API para crescimento
- Paginação:
  - Preferir cursor pagination em listas (`limit` + `cursor`), evitando offset para coleções grandes.
  - Resposta com `meta.nextCursor` e `meta.hasMore` (ou equivalente).
- Filtros e ordenação:
  - Padrão consistente de query params (ex.: `status`, `q`, `createdAtFrom/To`, `sort=created_at:desc`).
  - Evitar filtros “genéricos” demais no começo; evoluir conforme necessidade.
- Versionamento:
  - `/v1` no path. Mudanças breaking → `/v2` (sem quebrar `/v1`).
  - Política de depreciação: anunciar, manter período de convivência e remover depois.
- Idempotência:
  - Endpoints de criação/provisionamento aceitam `Idempotency-Key` (header).
  - Persistir em `idempotency_key` por (`tenant_id`, `handler`, `key`) e retornar a mesma resposta em replays.
- Rate limiting:
  - Rate limit por tenant e por rota/categoria (idealmente na borda quando infra estiver definida; fallback no app).
  - Retornar 429 com `RATE_LIMITED`.
- Fonte de verdade de RBAC:
  - Cada rota “protegida” mapeia para um `tool_action` estável (ex.: `catalog.tools.create`).
  - Guard de autorização lê esse `tool_action` (metadata do controller/handler) e verifica permissões.
  - `audit_log.action` pode reutilizar esse mesmo identificador.

## Provisionamento e seeds
- Comando único: `make seed` (ou `npm run seed`) para rodar seeds.
- Seeds globais (Aza8): catálogo completo (tools, tool_actions, packages, composição package→tool_action) via upsert para evitar duplicatas.
- Seeds por tenant (quando acionado): grupos padrão (ADM_CLIENTE, OPERATOR, VIEWER), permissões desses grupos, usuário admin inicial, vinculação do package inicial.
- Idempotência: upsert por chave para não duplicar; opcional `seed_history/version` para rastrear execuções.
- Ambientes online separados: projeto Supabase dev/staging para migrar/seedar e testar; projeto Supabase prod para dados reais. Seeds de tenant em prod só via comando explícito (`seed --tenant <id>` ou endpoint restrito Aza8).
- Segurança: criar admin de tenant apenas em caminho protegido; usar service_role; RLS desativado conforme decisão.

## Estratégia de migração e dados
- Ferramenta: Prisma Migrate.
- Dev/staging: `prisma migrate dev` apontando para Supabase dev; em seguida `prisma generate` e `npm run seed`.
- Produção: somente `prisma migrate deploy`; nunca `migrate dev` em prod. Seeds de tenant apenas via comando explícito.
- Convenções: nome de FKs/índices com `fk_<tabela>_<coluna>` e `idx_<tabela>_<cols>` para leitura/depuração.
- Revisão/CI: migrações geradas em branch; revisar SQL no PR; opcional dry-run em staging/CI antes de prod.
- Correção: preferir migrações forward (nova migração corrige problema) em vez de rollback/down.
- Segurança: `DATABASE_URL` de service_role usada só para migração/seed em backend/CI; não expor em front.

## Migrações e zero-downtime (expand/contract)
- Regra principal: toda migração aplicada via `prisma migrate deploy` deve ser compatível com a versão anterior do app por pelo menos 1 release (para permitir rollback do app sem mexer no banco).
- Expand/contract (como funciona):
  - Expand (seguro): adicionar coluna **nullable**, nova tabela, novos índices; escrever em “novo” sem quebrar “antigo”.
  - Backfill: migrar dados em job/script separado, em batches (evitar UPDATE gigante dentro da migração).
  - Switch: deploy que passa a ler do novo (mantendo fallback).
  - Contract: remover/renomear colunas antigas **somente** depois de o app antigo não depender mais (normalmente após um ciclo).
- Quando pode remover coluna:
  - Apenas após: (1) o código que lê/escreve a coluna ter sido removido, (2) ter passado pelo menos um deploy estável, (3) ter verificação/observabilidade mostrando que ninguém depende do campo.
- Evitar operações que travam tabelas:
  - Para grandes tabelas: evitar `ALTER COLUMN SET NOT NULL` sem preparação; preferir backfill + constraint validada depois.
  - Índices em tabelas grandes: considerar `CREATE INDEX CONCURRENTLY` (pode exigir SQL manual em migração).
- Rollback operacional (como funciona):
  - Se o deploy falhar: rollback do app para a versão anterior (o banco permanece com migração “expand” compatível).
  - Se a migração introduziu incompatibilidade: aplicar migração corretiva (forward) que restaura compatibilidade em vez de “down”.

## Jobs/assíncrono e integrações (outbox)
- Quando usar: tarefas longas, chamadas a terceiros, processamento pesado, notificações/webhooks e sincronizações.
- Worker separado:
  - Rodar um processo/serviço de worker separado do API (mesmo repo) para processar fila/outbox de forma independente e escalável.
- Outbox (como funciona):
  - Na mesma transação do comando (ex.: onboarding), gravar um evento na `outbox`/`job_queue` com `type`, `payload`, `tenant_id`, `status`, `attempts`, `available_at`.
  - O worker busca itens prontos, processa e marca como concluído; em falha, incrementa tentativas e agenda retry.
  - Modelo é “at-least-once”: consumidores devem ser idempotentes (usar `event_id`/`idempotency_key`).
- Retries, DLQ e idempotência:
  - Backoff exponencial (ex.: 1m, 5m, 15m, 1h).
  - Após N tentativas, marcar como “dead” (DLQ lógica) e exigir intervenção/manual.
- Webhooks/eventos:
  - Subscrições por tenant (url + secret + eventos habilitados).
  - Entrega com assinatura (HMAC), `eventId` e retries; registrar deliveries para auditoria.
- Tecnologia (dependente de infra):
  - Começar com outbox no Postgres (sem Redis) e evoluir para BullMQ/Redis ou fila gerenciada quando throughput exigir.

## Escalabilidade de dados (Supabase/Postgres)
- Pooling (pgBouncer):
  - Em produção, preferir conexão com pooler para o runtime do app (evita saturar conexões).
  - Migrações/DDL preferem conexão direta (sem pooler) quando necessário.
  - Prisma: usar `DATABASE_URL` (runtime) e `DIRECT_URL`/URL direta (migrations) quando aplicável.
- Limites de conexão (Prisma):
  - Controlar conexões por instância e por ambiente; escalar horizontalmente sem estourar `max_connections`.
  - Monitorar erros de pool/timeout e ajustar limites.
- Índices obrigatórios por tenant:
  - Em tabelas tenant-scoped, índices sempre iniciando por `tenant_id` (ex.: `(tenant_id, created_at)`, `(tenant_id, email)`).
  - Monitorar planos de query conforme volume cresce.
- Particionamento e retenção:
  - Planejar particionamento por tempo para `audit_log` e `usage_metrics` (mensal/semanal) quando crescer.
  - Retenção: manter hot por N dias/meses e arquivar o resto (job assíncrono).
- Backups e DR:
  - Definir RPO/RTO (ex.: RPO ≤ 24h; RTO ≤ 4h) e validar restore em staging periodicamente.
  - Documentar passo a passo de restore (quem faz, como valida, como comunica).

## Observabilidade
- Logs: estruturados em JSON (ideal via logger do Fastify/pino) com `level`, `message`, `timestamp`, `requestId`, `tenantId`, `actorType` (`user`/`service`), `userId/serviceId`, `method`, `path`, `statusCode`, `latency_ms` e `error.code` quando houver.
- Correlação: gerar `requestId` (ou aceitar se vier de um gateway) e devolver `X-Request-Id` na resposta; propagar `requestId`/`traceId` para `audit_log.metadata` quando registrar ações.
- Segurança/PII: nunca logar `Authorization`, cookies, refresh tokens, api keys, senhas ou payloads sensíveis; preferir allowlist de headers/campos; scrub antes de enviar para Sentry.
- Métricas: expor `/metrics` (restrito) com contadores/histogramas de latência, 4xx/5xx e códigos internos (`TENANT_NOT_FOUND`, `FORBIDDEN_ACTION`, etc.). **Evitar** usar `tenantId` como label (cardinalidade alta); `tenantId` fica em logs/traces.
- Error tracking: usar Sentry para exceptions e alertas, anexando contexto (`tenantId`, `userId`, `requestId`, `tool_action`), com scrub/redaction.
- Tracing: instrumentar com OpenTelemetry (HTTP + DB) para gerar `traceId` e propagar `traceparent`; incluir `traceId` nos logs quando habilitado.
- DB observability: registrar/medir queries lentas (threshold) e erros de conexão/pool; evitar logar SQL completo em produção quando houver risco de PII.
- Jobs/outbox: métricas e logs de `job_queue/outbox` (tamanho, retries, falhas) com `jobId/eventId` correlacionáveis.

## Estratégia de testes
- Ferramentas: Jest + `@nestjs/testing` + `supertest`.
- Banco em testes (recomendado): Postgres descartável (Docker/Testcontainers) para integração/E2E; evita depender do Supabase online e evita sujar dados. Unit tests não usam DB.
- Unit tests (como funciona): testar serviços/funções isoladas (sem HTTP/DB) — regras de RBAC, validação de tenantId, mapeamento rota→`tool_action`, redaction de logs.
- Integration tests (como funciona): testar Prisma + DB real com migrations aplicadas; validar constraints/uniques, upserts de seeds, `idempotency_key`, gravação de `audit_log`.
- E2E tests (como funciona): subir app Nest e chamar rotas HTTP; validar auth/tenant/RBAC/auditoria no fluxo completo.
- Cenários mínimos (E2E):
  - Onboarding: `POST /v1/tenants` cria tenant + package + ADM_CLIENTE.
  - Tenant enforcement: claim `tenantId` obrigatório; tenant suspenso bloqueia; `X-Tenant-Id` só para service account; mismatch claim≠header → 400.
  - RBAC: sem permissão → 403; com permissão → 200; união de permissões via múltiplos grupos.
  - API keys: escopo por `tool_action` (permitido X, bloqueado Y); desativação/revogação.
  - Auditoria: ação relevante grava `audit_log` com `requestId`.
  - Observabilidade: `/metrics` restrito; garantir redaction de `Authorization`/tokens/api keys.
- Scripts: `test:unit`, `test:integration`, `test:e2e`; integração/E2E rodam migrations antes e limpam dados entre testes (truncate ou transaction).

## Governança de erros
- Formato de resposta (padrão):
  - Sempre retornar um objeto `error` com `code` (string estável), `message` (segura para o cliente), `requestId` (para suporte) e `details` (opcional e sem PII).
  - Exemplo:
    ```json
    {
      "error": {
        "code": "FORBIDDEN_ACTION",
        "message": "Você não tem permissão para executar esta ação.",
        "details": { "toolAction": "catalog.tools.create" },
        "requestId": "01J…"
      }
    }
    ```
- Onde a regra vive (como funciona):
  - Serviços lançam erros “de domínio” com `code` + `httpStatus` + `details` (quando aplicável).
  - Um `ExceptionFilter` global do Nest transforma qualquer erro em resposta padronizada, adicionando `requestId` (e `traceId` se existir).
  - Em produção, **não** retornar stack trace nem mensagens internas; enviar stack e contexto para Sentry.
- Mapeamento para HTTP (principais):
  - `VALIDATION_ERROR` → 400 (campos inválidos; `details` com lista de erros).
  - `TENANT_MISMATCH` → 400 (claim ≠ `X-Tenant-Id`).
  - `UNAUTHORIZED` / `INVALID_TOKEN` / `TOKEN_EXPIRED` → 401.
  - `TENANT_NOT_FOUND` → 401 (tenant do claim não existe) **ou** 404 (se preferir não revelar); padrão recomendado: 401.
  - `TENANT_SUSPENDED` → 403.
  - `FORBIDDEN_ACTION` → 403 (sem permissão para `tool_action`).
  - `NOT_FOUND` → 404 (recurso não encontrado dentro do tenant).
  - `CONFLICT` / `DUPLICATE_RESOURCE` → 409 (ex.: email já existe no tenant; unique violation).
  - `RATE_LIMITED` → 429.
  - `INTERNAL_ERROR` / `DATABASE_ERROR` → 500 (não expor detalhes; log/Sentry).
  - `SERVICE_UNAVAILABLE` → 503 (dependência indisponível).
- Observabilidade e auditoria:
  - Todo erro 5xx gera log `error` e evento no Sentry com `code`, `requestId`, `tenantId` e `actor`.
  - Erros 4xx relevantes (ex.: `FORBIDDEN_ACTION`, `TENANT_MISMATCH`) geram log `warn` com `code` (sem dados sensíveis).
- Mensagens e detalhes:
  - `message` deve ser curta e segura (nada de SQL/stack/segredos).
  - `details` é opcional e deve ser uma estrutura pequena (ex.: campo inválido, `toolAction`); nunca incluir tokens, headers sensíveis ou PII.

## Perfis operacionais (defaults)
- Objetivo: definir valores padrão para retenção, DR (RPO/RTO), retries/DLQ e webhooks. Esses valores podem evoluir por tenant/contrato no futuro.
- Perfil selecionado (inicial): **MVP**.

### MVP (inicial)
- Retenção:
  - `audit_log`: 90 dias (hot) e remoção após o período (sem arquivamento no MVP).
  - `usage_metrics`: 12 meses.
- Backups/DR:
  - RPO: 24h.
  - RTO: 8h.
- Retries/DLQ:
  - Tentativas: 5 (com backoff exponencial).
  - Backoff sugerido: 1m → 5m → 15m → 1h → 6h; depois DLQ.
- Webhooks v1 (primeiros event types):
  - `tenant.created`
  - `tenant.package.assigned`
  - `user.created`
  - `user.updated`
  - `group.permission.changed`
  - `api_key.revoked`

### Padrão (equilibrado)
- Retenção:
  - `audit_log`: 90 dias hot + archive até 12 meses (fora do banco principal).
  - `usage_metrics`: 13 meses.
- Backups/DR:
  - RPO: 6h.
  - RTO: 4h.
- Retries/DLQ:
  - Tentativas: 10 (backoff exponencial com teto de 24h).
  - DLQ com alerta e fluxo de reprocessamento.
- Webhooks v1:
  - MVP + `user.status.changed`, `group.created/updated`, `user_group.changed`, `api_key.created`, `package.unassigned`.

### Enterprise (alto rigor)
- Retenção:
  - `audit_log`: 180 dias hot + archive 2–5 anos (conforme contrato).
  - `usage_metrics`: 24–36 meses (conforme necessidade analítica).
- Backups/DR:
  - RPO: 1h.
  - RTO: 1h.
- Retries/DLQ:
  - Tentativas: 15–20; DLQ com observabilidade (dashboards) e reprocessamento controlado.
- Webhooks v1:
  - Padrão + eventos adicionais por domínio (ex.: whitelabel/config changes, provisioning events, integrações específicas) e schemas versionados por evento.

## Infra/Deploy (pendente)
- Onde o container vai rodar (VPS/Kubernetes/Fly.io/Render/EC2/etc.)?
- Cloudflare será apenas DNS/proxy/WAF ou usaremos Cloudflare Tunnel?
- CI/CD: qual ferramenta (ex.: GitHub Actions) e pipeline (test → build → migrate deploy → deploy app → smoke test)?
- Gestão de segredos por ambiente (dev/staging/prod): onde ficam (CI secrets/secret manager), como rotacionar (JWT/DB) e lista final de env vars obrigatórias.
- Estratégia de zero-downtime: como aplicar migrações compatíveis (expand/contract) e rollback operacional (rollback do app + migração corretiva).

### Como rodar em dev
- Ambiente: projeto Supabase dev/staging separado.
- Passo a passo:
  - Configurar `DATABASE_URL` (service_role do Supabase dev).
  - `npm install`
  - `npx prisma migrate dev`
  - `npx prisma generate`
  - `npm run seed` (ou `make seed`) para catálogo + tenant de teste.
  - `npm run start:dev` (NestJS).

### Como promover para produção
- Pré-requisito: projeto Supabase prod separado; variables seguras (`DATABASE_URL` service_role em CI; app usa usuário de aplicação se preferir).
- Migrações: `prisma migrate deploy` apontando para prod (via pipeline/CI). Opcional dry-run em staging antes.
- Seeds: rodar catálogo global; seeds de tenant só com comando explícito `seed --tenant <id>` (ou endpoint restrito Aza8).
- Build/run: `npm run build` e `npm run start:prod` (ou container). `NODE_ENV=production`, JWT keys e API keys segregadas por ambiente.

# Proximas Features (não usar)


# Credenciais (não usar)

- Project Name: za8-hub-dev
  Password: xRyRaxPKRRosaRsO

  Database connection string (Direct connection / URI)
  postgresql://postgres:[xRyRaxPKRRosaRsO]@db.sxouprhqdyapsbfkvphq.supabase.co:5432/postgres

- Project Name: aza8-hub-staging
  Password: 

  Database connection string (Direct connection / URI)

- Project Name: aza8-hub-prod
  Password: xRyRaxPKRRosaRsO

  Database connection string (Direct connection / URI)

