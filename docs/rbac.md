# RBAC Guide

## Papéis e descrições
- `ADM_AZA8`: define catálogo de ferramentas, ações disponíveis e pacotes globais; cria o 1º acesso do cliente. Não gerencia usuários/grupos do cliente.
- `ADM_CLIENTE`: administra o tenant; cria usuários (colaboradores/externos), grupos e vincula permissões por ferramenta; configura whitelabel e monitora métricas/logs do tenant.
- `COLABORADOR`: usuário interno do cliente, com permissões atribuídas via grupos e ações por ferramenta.
- `EXTERNO`: usuário convidado/fornecedor; recebe permissões restritas definidas pelo cliente (via grupos).

## Grupos padrão (seeds)
- Seeds por tenant criam grupos base para acelerar o onboarding:
  - `ADM_CLIENTE` (admin do tenant)
  - `OPERATOR` (opera funcionalidades principais)
  - `VIEWER` (somente leitura)

## Permissões por `tool_action`
- Fonte de verdade: cada rota/ação relevante do backend mapeia para um `tool_action` estável (ex.: `catalog.tools.create`).
- Grupos possuem permissões (bindings) por `tool_action`; usuários herdam permissões via grupos.
- Política padrão: deny-by-default (ação não mapeada/não atribuída → 403).

## Tabela de permissões
- Recursos do Hub (hub.aza8.com.br):
  - Catálogo/Pacotes: `ADM_AZA8` pode criar/editar; `ADM_CLIENTE` somente visualizar pacotes aplicáveis ao seu tenant.
  - Tenants: `ADM_AZA8` cria/ativa/suspende; `ADM_CLIENTE` gerencia apenas seu tenant (whitelabel, métricas).
  - Usuários/Grupos: apenas `ADM_CLIENTE` gerencia dentro do próprio tenant.
  - Auditoria/Logs do tenant: `ADM_AZA8` vê panorama global; `ADM_CLIENTE` vê logs do próprio tenant.
- Recursos do portal `{client}.aza8.com.br` (operacional):
  - Ferramentas e ações são definidas pelo cliente via grupos. Exemplo de ações: `ver`, `baixar`, `adicionar`, `editar`, `excluir` (customizadas por ferramenta).
  - Grupos agregam permissões por ferramenta. Usuários herdam permissões via grupos; ausência de grupo implica acesso negado.

## Regras especiais
- Escopo sempre por `tenantId`: nenhum papel pode agir fora do tenant vigente (exceto visão global de métricas/logs do `ADM_AZA8`).
- `ADM_AZA8` não pode alterar usuários/grupos/permissões do cliente.
- Conflito de permissões: aplicar política mais permissiva apenas se explicitamente atribuída; default deny para ações não mapeadas.

## API keys (service accounts)
- Uso: integrações máquina-a-máquina por tenant.
- Autenticação: `Authorization: Bearer <API_KEY>` (padrão). Opcional: `X-API-Key: <API_KEY>` quando o cliente não consegue enviar `Authorization`.
- Escopo: API keys têm escopo por `tool_action` (ou perfis como read-only/write/admin).
- Tenant: tenant é derivado do token/API key; header `X-Tenant-Id` pode ser aceito apenas para service accounts; mismatch claim≠header → 400.

## Provisionamento
- Criação de tenant: `ADM_AZA8` cria tenant e associa pacote inicial; gera credencial de `ADM_CLIENTE` (1º acesso).
- Gestão de usuários: `ADM_CLIENTE` cria/atualiza/revoga usuários (colaborador/externo) e associa a grupos.
- Gestão de grupos/permissões: `ADM_CLIENTE` cria grupos e atribui ações por ferramenta; alterações propagam para o portal operacional.
- Revogação: remover usuário de grupos ou desativar usuário; cascata remove permissões efetivas.

## Auditoria
- Registrar todas as alterações de configuração (catálogo, pacotes, grupos, permissões, usuários, whitelabel) com `actorId`, `tenantId`, timestamp, payload e resultado.
- Logs de acesso a ferramentas devem incluir tenant, usuário, grupo(s) e ação executada. Armazenar em trilha de auditoria consultável e exportável.
