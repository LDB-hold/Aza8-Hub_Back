# Development Guide

## Setup local
- Stack: Node.js 20 LTS + TypeScript, NestJS (Fastify adapter), Prisma Migrate.
- Banco: Supabase (Postgres) com projetos separados (dev/staging e prod).
- Variáveis de ambiente (mínimas):
  - `DATABASE_URL`: conexão com Postgres (em dev/staging, pode usar service_role para migrate/seed).
  - `JWT_PRIVATE_KEY` e `JWT_PUBLIC_KEY`: chaves RS256 (PEM; pode usar `\\n` no `.env`).
  - `LOG_LEVEL`: ex.: `info`.
  - (Opcional) `SENTRY_DSN`: error tracking.
  - (Opcional) `METRICS_TOKEN`: habilita `/metrics` (Prometheus) e restringe acesso.
- Passos base:
  - Instalar dependências (`npm install`).
  - Gerar Prisma Client (`npm run prisma:generate`).
  - Rodar migrações (`npm run prisma:migrate:dev`) e gerar client (`npm run prisma:generate`).
  - Rodar seed global (`npm run seed`).
  - Subir a API (`npm run start:dev`).
  - (Opcional) Subir o worker/outbox (`npm run worker`).

## Ambientes (dev/staging e prod)
- Dev/staging: usado para desenvolvimento, migrações e seeds idempotentes; pode ser resetado/recriado.
- Prod: dados reais; aplicar somente `prisma migrate deploy` via CI; seeds por tenant apenas por comando explícito/endpoint restrito.

## Fluxo de trabalho
- Branches: feature branches por escopo; commits pequenos e descritivos.
- Testes: rodar suite de unidade/integrados antes de abrir PR; registrar resultado.
- Documentação: atualizar `docs/` sempre que contratos, fluxos ou decisões mudarem.
- Revisão: PR deve referenciar cenários de e2e impactados e evidências de teste.

## Scripts e comandos úteis
- `npm run start:dev`: sobe API em modo dev (NestJS).
- `npm run worker`: processa fila/outbox (webhooks v1) em loop.
- `npm test`: roda testes automatizados (unit/integration/e2e).
- `npm run seed`: aplica seed global (catálogo + pacote base) de forma idempotente.
  - Seed por tenant: `npm run seed -- --tenant <TENANT_ID> --packageKey <PACKAGE_KEY> --adminEmail <EMAIL> --adminName <NAME>`
  - Em `NODE_ENV=production`, exige `--allow-prod`.
- `npm run prisma:migrate:dev`: migrações para dev/staging.
- `npm run prisma:migrate:deploy`: migrações para produção (CI).
- `npm run prisma:generate`: gera Prisma Client.

## Troubleshooting
- Falhas de autenticação: verificar emissão de token com `tenantId`, `aud`, `iss` corretos.
- Erros de acesso negado: checar associação de usuário a grupos e permissões por ferramenta; default é deny.
- Divergência de tenant: conferir claim `tenantId` no token; `X-Tenant-Id` é aceito apenas para service accounts; mismatch claim≠header deve retornar 400.

## Checklist pós-alteração
- Testes locais executados e verdes.
- Migrações aplicadas (se houver).
- Logs e métricas checados em dev.
- Documentação atualizada em `docs/` (incluir seção de “Docs consultados/atualizados” nas notas da mudança).
