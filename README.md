# RATÓPOLIS

Repositório do jogo, portal, painel administrativo e Worker da API do RATÓPOLIS.

## Estrutura atual

- `index.html` — portal publicado na raiz (entrada padrão de hospedagem estática).
- `ratopolis_v*.html` — builds/versionamentos históricos do jogo; confirme a versão de produção antes de remover qualquer arquivo.
- `portal_ratopolis*.html` — versões do portal e integrações.
- `ratopolis_admin_*.html`, `ratopolis_editor_*.html` — versões do painel/editor de cenários.
- `workers/ratopolis-api-dev-v30.js` — fonte versionada do Worker da API de desenvolvimento.
- `migrations/` — migrations SQL; não renomear nem apagar sem conferir a ordem e o banco alvo.
- `docs/` — contratos e notas de integração.

## Regras de manutenção

1. Mantenha `main` estável; faça limpezas e refatorações em branches e PRs.
2. Não apague builds HTML antigos até confirmar que não são usados por links, hospedagem, jogadores ou fluxo administrativo.
3. Não altere nomes/ordem de migrations já aplicadas.
4. Nunca versione tokens, secrets, arquivos de ambiente locais ou dados de jogadores.
5. Para uma versão nova, prefira um nome claro e mantenha uma única entrada oficial documentada.
6. Antes de publicar mudanças, valide login, salas online, chat, loja, eventos/recompensas e painel administrativo.

Veja [a auditoria de organização](docs/REPOSITORY_CLEANUP.md) para a primeira etapa de limpeza.
