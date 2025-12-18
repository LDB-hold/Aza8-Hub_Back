# Platform Overview

## Documentação
- Contratos HTTP (API v1): `docs/api/v1.md`

## Estrutura funcional
- Domínios principais: `Tenant` (cliente), `Ferramenta` (catálogo Aza8), `Pacote` (combinação de ferramentas e limites), `Usuário` (colaborador ou externo), `Grupo` (coleção de usuários), `PermissãoPorFerramenta` (ação permitida dentro de cada ferramenta), `Provisionamento` (atribuição de pacote e permissões para o tenant), `Auditoria` (logs de configuração e acesso).
- Serviços previstos:
  - Catálogo Aza8: CRUD de ferramentas, definição de ações disponíveis por ferramenta e limites de uso por pacote.
  - Tenancy: criação/gestão de clientes, estado de provisionamento, domínios `{client}.aza8.com.br`.
  - Identidade e acesso: gestão de usuários, grupos e herança de permissões por ferramenta.
  - Governança e observabilidade: métricas, logs globais e por tenant, trilhas de auditoria de configuração.
  - Whitelabel e configuração do tenant: branding e parâmetros operacionais específicos.

## Seeds e dados iniciais
- Seeds mínimos previstos:
  - Catálogo global: ferramentas (`tool`), ações (`tool_action`), pacotes (`package`) e composição pacote→ações (idempotente via upsert por `key`).
  - Tenant: grupos padrão (`ADM_CLIENTE`, `OPERATOR`, `VIEWER`), permissões base por `tool_action`, usuário admin inicial e vínculo do pacote inicial.
- Comandos previstos: `make seed` ou `npm run seed` (idempotente); detalhes em `docs/development.md`.

## Dependências externas
- Banco de dados: Supabase (Postgres gerenciado) com projetos separados (dev/staging e prod). RLS desativado; enforcement de tenant/RBAC na aplicação.
- Identidade/autenticação: auth interno com JWT (RS256) e refresh tokens; possibilidade de plugar IdP/OIDC depois.
- Observabilidade: logs JSON (tenant-aware), métricas (`/metrics` restrito), Sentry (error tracking) e OpenTelemetry (tracing) quando habilitado.
- Filas/eventos: outbox/job_queue no Postgres com worker; pode evoluir para Redis/fila gerenciada conforme throughput.
- Storage (opcional): whitelabel e arquivamento (ex.: logs antigos/exports) conforme necessidades de produto e retenção.

## Decisões recentes
- Multi-tenant com separação clara: hub.aza8.com.br (Aza8 + ADM Cliente) controla `{client}.aza8.com.br` (operacional); configurações do Hub propagam para o portal do tenant.
- ADM Aza8 não cria usuários do cliente nem define permissões/grupos do cliente; papel restrito a catálogo, pacotes e 1º acesso do tenant.
- Resolução de tenant: claim `tenantId` no token como fonte principal; header `X-Tenant-Id` apenas para service accounts; mismatch → 400.

## Perfis operacionais (defaults)
- Objetivo: ter presets para retenção, DR (RPO/RTO), retries/DLQ e webhooks, com evolução futura por tenant/contrato.
- Perfil selecionado (inicial): **MVP**.
- MVP:
  - Retenção: `audit_log` 90 dias (hot); `usage_metrics` 12 meses.
  - DR: RPO 24h; RTO 8h.
  - Retries/DLQ: 5 tentativas com backoff exponencial; depois DLQ.
  - Webhooks v1 (iniciais): `tenant.created`, `tenant.package.assigned`, `user.created`, `user.updated`, `group.permission.changed`, `api_key.revoked`.
- Padrão (equilibrado): `audit_log` hot 90d + archive 12m; `usage_metrics` 13m; RPO 6h/RTO 4h; 10 tentativas; webhooks ampliados.
- Enterprise (alto rigor): `audit_log` hot 180d + archive 2–5a; `usage_metrics` 24–36m; RPO 1h/RTO 1h; 15–20 tentativas; webhooks por domínio e schemas versionados.

## Próximos passos
- Definir infra/deploy e CI/CD (onde roda o container, papel do Cloudflare, secrets por ambiente e pipeline).
- Implementar contratos v1, migrações, seeds e enforcement de tenant/RBAC conforme decisões atuais.
- Implementar outbox/worker e webhooks v1 (perfil MVP) com retries e DLQ.
