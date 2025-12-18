# Tutorial — Ambientes e como rodar

Este guia documenta:
- O que é **dev**, **staging** e **produção**;
- Como rodar o backend **localmente** apontando para cada ambiente;
- Quais pré-requisitos e variáveis de ambiente são esperados.

> Regra: sempre que mudar comando/variável/fluxo de deploy, este tutorial deve ser atualizado.

## O que é cada ambiente

### Local
- A API (NestJS) roda na sua máquina.
- Pode usar banco local (opcional) ou um banco online (ex.: Supabase dev).

### Dev
- Ambiente online para desenvolvimento compartilhado.
- Mudanças são frequentes; dados podem ser resetados.

### Staging (pré-produção)
- Ambiente online **mais parecido possível com produção**.
- Serve para validar:
  - deploy,
  - migrações (`prisma migrate deploy`),
  - integrações externas (webhooks, e-mail, etc.),
  - configurações/segredos de runtime.
- Objetivo: reduzir risco de quebrar produção.

### Produção (prod)
- Ambiente online com dados reais.
- Deve receber apenas mudanças já validadas em staging (quando existir).

## Recomendação de ambientes (Supabase)
- Criar **projetos Supabase separados**:
  - `dev`
  - `staging`
  - `prod`
- Nunca reutilizar as chaves/URLs entre ambientes.

## O que muda entre ambientes (checklist)
- `DATABASE_URL`: aponta para o Postgres do ambiente correto (Supabase dev/staging/prod).
- Chaves JWT: par RS256 diferente por ambiente.
- Observabilidade: DSN/integrações (Sentry/OTel) diferentes por ambiente.
- Métricas: `METRICS_TOKEN` diferente por ambiente (ou desabilitado).
- Seeds/migrações:
  - Dev: mais flexível (migrate dev + seed).
  - Staging: espelha prod (migrate deploy + smoke tests).
  - Prod: migrate deploy via CI; seeds somente com comandos explícitos e controlados.

## Pré-requisitos para rodar localmente
- Node.js 20 LTS
- NPM
- Acesso ao projeto Supabase do ambiente (dev ou staging) e às connection strings

## Variáveis de ambiente (mínimas)
> Os nomes finais podem evoluir durante a implementação; este tutorial deve ser mantido sincronizado com `docs/development.md`.

- `DATABASE_URL`: conexão do Postgres do ambiente (no MVP pode usar service_role em dev/staging).
- `JWT_PRIVATE_KEY`: chave privada RS256 para assinar tokens.
- `JWT_PUBLIC_KEY`: chave pública RS256 para validar tokens.
- `LOG_LEVEL`: ex.: `info`
- (Opcional) `SENTRY_DSN`, `OTEL_*`
- (Opcional) `METRICS_TOKEN`: habilita `/metrics` (Prometheus) e restringe acesso.

## Como rodar localmente (conectando no Supabase dev)
1. Exportar variáveis do ambiente dev (`DATABASE_URL`, chaves JWT, etc.).
2. Instalar dependências: `npm install`
3. Aplicar migrações em dev: `npm run prisma:migrate:dev`
4. Gerar Prisma Client: `npm run prisma:generate`
5. Rodar seed global: `npm run seed`
6. Subir a API: `npm run start:dev`
7. (Opcional) Subir o worker/outbox: `npm run worker`
8. Validar: `GET /health` deve retornar OK.

## Como rodar localmente (conectando no Supabase staging)
1. Exportar variáveis do ambiente staging (`DATABASE_URL`, chaves JWT, etc.).
2. Aplicar migrações: preferir `npm run prisma:migrate:deploy` (para simular prod).
3. Subir a API local: `npm run start:dev`
4. Rodar smoke tests (quando existirem).

## Como rodar em produção (visão geral)
> A infra de deploy ainda será definida (Docker/CI/Cloudflare). Atualizar este bloco quando a estratégia estiver fechada.

- Migrações: via CI com `npx prisma migrate deploy` apontando para Supabase prod.
- Seeds:
  - Evitar rodar “seed geral” em prod.
  - Seeds por tenant somente via comando explícito/endpoint restrito.
  - Script de seed em prod exige `--allow-prod`.
- Segredos: configurar em CI/secret manager (nunca commitar).

## Manutenção deste tutorial (obrigatório)
- Sempre que mudar:
  - comandos (`npm run ...`),
  - variáveis de ambiente,
  - fluxo de migração/seed,
  - estratégia de deploy,
  - separação dev/staging/prod,
  este tutorial deve ser atualizado junto.
