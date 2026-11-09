# Administração do RativaPolis

Este diretório contém o painel administrativo atualmente utilizado pelo jogo RativaPolis.

- Painel preservado: `ratopolis_admin_v65_3_1_integracao_cenarios_auditoria.html`
- O painel permanece operacional durante a migração.
- Não remover nem duplicar módulos antes de confirmar dependências, endpoints, permissões e dados.

## Responsabilidades que permanecem no RativaPolis

- Fases, salas, cenários e aprovação de mapas.
- Economia, XP, loja, catálogo, inventário e gifts.
- Missões, guildas, competições, temporadas e balanceamento.
- Eventos e recompensas específicos do jogo.
- Feedback específico do RativaPolis.

## Funções compartilhadas em migração para Admin Geral

O painel legado também contém seções que não devem ficar vinculadas a um jogo: visão geral global, consulta de contas globais, gestão de equipe/permissões, auditoria, registros de acesso, relatórios globais e integração do portal.

Essas funções serão extraídas para `Admin/PortalAdmin` em etapas. Até que cada módulo seja migrado e testado, a cópia atual permanece no painel legado para evitar perda de acesso.

## Cuidados técnicos

- Preservar autenticação e validação de autorização no Worker.
- Não confiar apenas em esconder botões ou páginas no navegador.
- Manter os identificadores de APIs, Workers e chaves de sessão existentes até haver migração coordenada.
- Não converter dados demonstrativos locais em dados reais.
- Testar cada fluxo antes de remover sua versão antiga.
