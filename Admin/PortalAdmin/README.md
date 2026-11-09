# Administração do Portal RativaGames

Este diretório é a entrada do Admin Geral e reúne os módulos administrativos compartilhados do portal.

## Entrada

- `index.html`: central de acesso aos módulos gerais atualmente disponíveis.
- `Radio/radio_admin.html`: painel de controle da rádio.
- `Radio/radio_stats.html`: estatísticas e relatório de audiência.

## Migração do painel legado

O painel administrativo antigo do RativaPolis reúne funções compartilhadas e funções específicas do jogo no mesmo HTML. A separação está sendo feita por etapas, sem remover o painel legado antes de testar cada substituição.

O mapa de responsabilidades está em [SEPARACAO_PAINES.md](./SEPARACAO_PAINES.md).

**Importante:** a central de entrada não substitui autenticação nem autorização no servidor. Gestão global de contas, equipe, permissões e auditoria só será considerada migrada quando os módulos e endpoints correspondentes estiverem funcionando e testados aqui.

O portal público único continua sendo o `index.html` da raiz do repositório.
