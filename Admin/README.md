# Administração — RativaGames

Esta pasta reúne os painéis administrativos dos produtos da RativaGames.

## Estrutura

- `PortalAdmin/`: entrada do Admin Geral e ferramentas compartilhadas do portal, comunidade, contas, ranking e rádio.
- `PortalAdmin/Radio/`: administração da rádio e relatório de estatísticas.
- `RativaPolis/`: painel administrativo do jogo RativaPolis.
- `RativaSnack/`: reservado para um painel específico do RativaSnack, caso seja criado.

## Decisões do Admin Geral

- **Acesso:** dono e administradores expressamente autorizados.
- **Permissões:** individuais e granulares; o acesso total permanece reservado ao dono.
- **Auditoria:** histórico administrativo completo, com registro no servidor e proteção contra alterações indevidas.
- **Separação:** recursos compartilhados ficam no Admin Geral; controles de jogo permanecem no painel de cada produto.

## Estado da migração

A primeira etapa criou uma entrada própria para o Admin Geral e documentou a separação do painel legado. O painel RativaPolis permanece preservado. A extração funcional dos módulos compartilhados ainda exige migração e testes por módulo, pois o arquivo atual mistura funções reais, funções demonstrativas locais e integrações com Workers.

Consulte:
- [Entrada do Admin Geral](./PortalAdmin/index.html)
- [Plano de separação dos painéis](./PortalAdmin/SEPARACAO_PAINES.md)
- [Painel RativaPolis](./RativaPolis/README.md)

O portal público único permanece na raiz do repositório: `/index.html`. Os nomes internos de APIs e Workers não devem ser alterados sem migração coordenada.
