# E2E Cenários e Validações

## Cenários críticos
- Onboarding do cliente (1º acesso): `ADM_AZA8` cria tenant, define pacote inicial e entrega credencial de `ADM_CLIENTE`; validar que o tenant fica ativo e visível em hub.
- Gestão de catálogo/pacote: `ADM_AZA8` cria/edita ferramentas e ações, monta pacote, aplica ao tenant; `ADM_CLIENTE` enxerga pacote aplicado em modo leitura.
- Gestão de usuários/grupos: `ADM_CLIENTE` cria grupos, define permissões por ferramenta, cria usuários (colaborador/externo) e associa a grupos; usuários passam a acessar o portal `{client}` com as permissões esperadas.
- Enforcing de permissões: usuário com permissões limitadas tenta ações não permitidas e recebe deny; ações permitidas são executadas com sucesso.
- Auditoria/logs: toda alteração de configuração é registrada com `actorId` e `tenantId`; consultar trilha e exportar.
- Whitelabel do tenant: `ADM_CLIENTE` altera branding e vê efeito no portal `{client}`.

## Casos de integração/API
- Autenticação/identidade: emissão/validação de tokens com `tenantId` e papel; refresh/rotação e revogação refletem no acesso.
- Resolução de tenant: claim `tenantId` obrigatório; `X-Tenant-Id` aceito apenas para service accounts; mismatch claim≠header → 400.
- RBAC: rotas mapeadas para `tool_action`; usuário/API key sem permissão → 403; com permissão → 200.
- API keys: escopo por `tool_action` (permitido X, bloqueado Y); desativação/revogação invalida acesso.
- Idempotência: endpoints de criação/provisionamento aceitam `Idempotency-Key` e não duplicam operações em replays.
- Observabilidade: logs estruturados incluem `tenantId` e `userId`; métricas de uso agregadas por rota/código interno (sem labels de alta cardinalidade).
- Provisionamento assíncrono: eventos gravados na outbox/job_queue, processados por worker com retries e DLQ; webhooks entregues com `eventId` e assinatura.

## Preparação e dados
- Seeds: catálogo inicial, pacote base, papéis `ADM_AZA8` e `ADM_CLIENTE`.
- Dados de teste: criar tenant de teste, usuário `ADM_CLIENTE` inicial, grupos “Equipe Marketing” e “Gerente MKT” com ações distintas (ex.: ver/baixar vs. adicionar/editar/excluir).
- Ambiente: Supabase dev/staging (projeto separado de prod), base limpa ou fixtures de tenant isolado; identidade configurada para emitir tokens com `tenantId`.

## Resultados e métricas
- Registrar status de cada cenário (pass/fail), data, build/commit testado e ambiente.
- Métricas alvo: tempo de propagação de permissões, taxa de erro 4xx/5xx por tenant, latência de chamadas críticas.

## Pendências
- Definir infra/deploy e CI/CD (onde roda o container, Cloudflare proxy/tunnel, secrets por ambiente).
- Implementar e validar worker/outbox e webhooks v1 conforme perfil operacional (MVP).
- Implementar export de auditoria por tenant e política de retenção/arquivamento conforme perfil operacional.
