# RATÓPOLIS

Repositório do jogo, portal, painel administrativo e Worker da API do RATÓPOLIS.

## Arquivos oficiais de produção

- **Portal:** `index.html`
- **Jogo:** `ratopolis_v1.52.0_shaman.html`
- **Painel administrativo:** `ratopolis_admin_v65_3_1_integracao_cenarios_auditoria.html`

Esses são os arquivos oficiais indicados pelo responsável pelo projeto. Não os remover, renomear ou substituir durante a limpeza sem uma solicitação explícita.

## Estrutura

- `index.html` — portal oficial.
- `ratopolis_v1.52.0_shaman.html` — jogo oficial.
- `ratopolis_admin_v65_3_1_integracao_cenarios_auditoria.html` — painel administrativo oficial.
- Outros `*.html` — versões históricas, testes ou ferramentas; verificar referências antes de arquivar.
- `workers/ratopolis-api-dev-v30.js` — fonte versionada do Worker da API de desenvolvimento.
- `migrations/` — migrations SQL; não renomear nem apagar sem conferir a ordem e o banco alvo.
- `docs/` — contratos e notas de integração.

## Regras de manutenção

1. Mantenha `main` estável; faça limpezas e refatorações em branches e PRs.
2. Preserve os três arquivos oficiais acima e confira links, hospedagem e dependências antes de mexer em outros HTMLs.
3. Não altere nomes/ordem de migrations já aplicadas.
4. Nunca versione tokens, secrets, arquivos de ambiente locais ou dados de jogadores.
5. Não sobrescreva o Worker nem altere bindings/segredos como parte de uma limpeza de arquivos.
6. Antes de publicar mudanças, valide login, salas online, chat, loja, eventos/recompensas e painel administrativo.

Veja [a auditoria de organização](docs/REPOSITORY_CLEANUP.md) para os critérios da limpeza.
