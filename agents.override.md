# Agents Override — Aza8 Hub Back

Este override muda o foco do agente de “definição de checklist” para **execução do desenvolvimento do backend**, usando como fonte de verdade os documentos em `docs/` e mantendo `working-notes.md` como anotações de trabalho.

## Objetivo
- Implementar o backend conforme os contratos em `docs/` (principalmente `docs/api/v1.md`) e as decisões registradas em `working-notes.md`.
- Manter rastreabilidade e sincronização de documentação a cada mudança relevante.

## Fonte de verdade (ordem)
1. `Agents.md` (regras globais obrigatórias)
2. `docs/api/v1.md` (contratos HTTP e padrões de API)
3. `docs/architecture-base.md`, `docs/platform-overview.md` (arquitetura/visão)
4. `docs/rbac.md`, `docs/e2e.md`, `docs/development.md` (RBAC, E2E, setup)
5. `docs/Tutorial/README.md` (como rodar local/dev/staging/prod; manter sempre atualizado)
6. `working-notes.md` (working notes; pode conter rascunhos e decisões em evolução)

## Como o agente deve operar (desenvolvimento)

1. **Planejar antes de codar**
   - Antes de alterar código:
     - Ler os docs relevantes.
     - Propor um plano curto (3–7 passos) e pedir confirmação do usuário.

2. **Confirmação antes de agir**
   - Não executar comandos nem alterações sem autorização explícita (inclui: instalar deps, rodar testes, migrações, seeds, gerar código).
   - Antes de aplicar qualquer patch, resumir impacto esperado e arquivos afetados.
   - Ações com risco (migrações/seeds/tenancy/dados) exigem confirmação explícita + identificação do ambiente (dev/staging/prod).

3. **Contratos primeiro**
   - Rotas, payloads, paginação, idempotência, erros e headers devem seguir `docs/api/v1.md`.
   - Se o código precisar divergir do contrato, o doc deve ser atualizado na mesma entrega (com rastreabilidade).

4. **Tipagem explícita**
   - DTOs, retornos, estruturas e contratos internos devem manter tipagem explícita.

5. **Sem frontend**
   - Não criar frontend; apenas backend e documentação para consumo futuro.

6. **Documentação e rastreabilidade**
   - Ao final de cada alteração relevante:
     - Atualizar os docs que representam o estado atual (em `docs/`).
     - Se algo ainda estiver em aberto, registrar em `working-notes.md`.
     - Se a mudança afetar execução/setup/variáveis/CI/deploy, atualizar também `docs/Tutorial/README.md`.
   - Sempre informar no output:
     - **Docs consultados**
     - **Docs atualizados**

## Ordem sugerida de implementação (MVP)
1. Bootstrap NestJS (Fastify), config/env validation e `/health`
2. Prisma + Supabase (schema, migrate, generate)
3. Auth (JWT RS256 + API key) e resolução de tenant (claim `tenantId`, `X-Tenant-Id` só service accounts; mismatch → 400)
4. RBAC com `tool_action` (metadata por rota + guard; deny-by-default)
5. Endpoints v1 (começar por onboarding, catálogo e gestão de usuários/grupos)
6. Observabilidade (logs JSON, `X-Request-Id`, `/metrics` restrito, Sentry/OTel quando habilitado)
7. Outbox/worker + Webhooks (perfil MVP)
8. Testes (unit/integration/e2e) alinhados a `docs/e2e.md`
