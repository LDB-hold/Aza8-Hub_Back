# Agents

## IMPORTANTE
- Este repositório é exclusivamente backend; nada de frontend deve ser desenvolvido aqui.
- Documente cada fluxo e contrato de API na pasta `docs/` para que futuros projetos de frontend consigam consumir o backend sem ambiguidades.
- Pense sempre em separação clara de responsabilidades e mantenha o backend pronto para ser integrado por qualquer front independente.
- Todo o código backend deve utilizar tipagem explícita (parâmetros, retornos e estruturas de dados), seguindo o padrão de tipagem adotado pela stack tecnológica do projeto.

## Resumo do Projeto
A Aza8 Hub é uma plataforma multi-tenant que centraliza o catálogo de ferramentas oferecidas pela Aza8 e controla o provisionamento para cada cliente. Ela permite à Aza8 definir pacotes e políticas globais, enquanto cada cliente personaliza usuários, grupos e permissões. O objetivo é garantir governança e rastreabilidade completas do lado do backend.

## ⚙️ Princípios de Operação
1. **Fonte de verdade — MCP primeiro**
   - Priorize MCPs em vez de buscas locais sempre que possível.
   - Reutilize leituras recentes dos MCPs para evitar redundância.
2. **Confirmação antes de agir**
   - Não execute comandos nem alterações sem autorização explícita.
   - Solicite confirmação antes de ações destrutivas, alterações fora do fluxo padrão, mudanças de permissões, seeds ou tenancy.
   - Sempre apresente um resumo do impacto esperado antes de executar qualquer ação.
3. **Sincronização automática de documentação**
   - Após cada modificação relevante, atualize os documentos que representam o estado atual do sistema.

## Documentos obrigatórios (pasta `docs/`)
- `docs/platform-overview.md`: Estrutura funcional, seeds e dependências externas.
- `docs/architecture-base.md`: Camadas, tenancy e arquitetura base.
- `docs/development.md`: Fluxos de desenvolvimento e setup local.
- `docs/rbac.md`: Papéis, permissões e processos de provisionamento.
- `docs/e2e.md`: Cenários e validações end-to-end de integrações/API.
- `docs/api/v1.md`: Contratos HTTP da API v1 (endpoints, payloads, padrões, erros, idempotência).
- `docs/Tutorial/README.md`: Tutorial passo a passo para rodar local/dev/staging/prod (inclui explicação de staging).

## Notas de trabalho (raiz)
- `working-notes.md`: working notes (decisões em evolução e rascunhos). Deve ser promovido para `docs/` quando estabilizar.

> Este projeto não possui frontend: todo o backend deve ser projetado e documentado para consumo futuro por um front independente. Qualquer novo documento deve ser criado dentro da pasta `docs/` para manter a organização centralizada e facilitar a integração posterior.

## Regra de rastreabilidade (obrigatória)
- Toda mudança deve citar explicitamente:
  - **Docs consultados:** liste os arquivos lidos.
  - **Docs atualizados:** liste os arquivos alterados.
