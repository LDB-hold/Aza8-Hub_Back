# Architecture Base

## Camadas do sistema
- API (REST/HTTP): expõe contratos versionados; aplica autenticação/autorização por tenant e papel.
- Application/Services: orquestra regras de negócio de catálogo, provisionamento, identidade e auditoria.
- Domain: modelos com tipagem explícita e invariantes (tenantId obrigatório em entidades multi-tenant).
- Infra/Persistence: repositórios com acesso a banco relacional; segregação lógica por tenant.
- Background/Workers: tarefas de provisionamento assíncrono, sincronização de permissões e expurgo de logs.

## Tenancy e isolamento
- Identificação: claim `tenantId` no token (JWT/API key) como fonte principal; header `X-Tenant-Id` (case-insensitive) apenas para service accounts; mismatch claim≠header → 400.
- Propagação: guard global resolve e valida o tenant (existente/ativo) e injeta `tenantId` obrigatório no contexto da requisição; payload não pode sobrescrever `tenantId`.
- Isolamento: segregação lógica por `tenantId` em todas as entidades; default é única base com colunas `tenant_id` + índices iniciando por `tenant_id`. RLS desativado no Supabase; enforcement na aplicação.
- Governança: ações do `hub.aza8.com.br` escrevem configuração que é aplicada/propagada ao ambiente `{client}`; operações sempre validadas contra o tenant atual.
- Auditoria: toda alteração de configuração grava trilha com `actorId`, `tenantId`, timestamp e payload.

## Padrões e convenções
- Tipagem explícita em DTOs, serviços e repositórios; contratos versionados (`v1`) e nomes claros.
- DTOs separados de entidades; validação de entrada na borda (API) e regras adicionais na camada Application.
- Naming: entidades principais em inglês (`Tenant`, `Tool`, `Package`, `User`, `Group`, `PermissionBinding`, `AuditLog`).
- Erros padronizados com códigos de domínio (ex.: `TENANT_NOT_FOUND`, `FORBIDDEN_ACTION`, `INVALID_PACKAGE_CONFIG`).
- Autorização baseada em papel + permissões por ferramenta: resolução sempre vinculada ao `tenantId`.
- RBAC como fonte de verdade: cada rota protegida mapeia para um `tool_action` estável; guard de autorização valida permissões/escopos (incluindo API keys).

## Infraestrutura
- Banco de dados: Supabase (Postgres). Migrações via Prisma Migrate; indices e constraints nomeados para depuração.
- Pooling: usar pooler (pgBouncer) para runtime; migrações/DDL preferem conexão direta quando necessário (ex.: `DIRECT_URL`).
- Filas/Eventos: padrão outbox/job_queue no Postgres com worker separado; pode evoluir para Redis/fila gerenciada conforme throughput.
- Observabilidade: logs JSON, `/metrics` restrito, Sentry (error tracking) e OpenTelemetry (tracing) quando habilitado.
- Storage (opcional): whitelabel, exports e arquivamento (ex.: dados antigos de auditoria/uso conforme retenção).

## Operação e escalabilidade (perfil inicial)
- Perfil selecionado: MVP (valores podem evoluir por tenant/contrato).
- Retenção: `audit_log` 90 dias (hot); `usage_metrics` 12 meses.
- DR: RPO 24h; RTO 8h.
- Retries/DLQ: 5 tentativas (backoff exponencial) e DLQ lógica para intervenção.
- Webhooks v1 iniciais: `tenant.created`, `tenant.package.assigned`, `user.created`, `user.updated`, `group.permission.changed`, `api_key.revoked`.

## Mudanças recentes
- 2024-04-xx — Base de arquitetura alinhada à visão executiva multi-tenant (Aza8 Hub controla portal `{client}`); camadas e padrões definidos para iniciar contratos e implementação inicial.
