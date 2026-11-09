# Administração — RativaGames

Esta pasta reúne os painéis administrativos dos produtos da RativaGames.

## Estrutura

- `PortalAdmin/`: administração geral do portal público, comunidade, contas, ranking e rádio.
- `PortalAdmin/Radio/`: administração da rádio e relatório de estatísticas do portal.
- `RativaPolis/`: painel administrativo específico do jogo RativaPolis.
- `RativaSnack/`: reservado para o painel administrativo específico do RativaSnack, caso seja criado.

## Admin Geral — decisão de projeto

O Admin Geral será a central de administração da plataforma RativaGames.

- **Acesso:** somente o dono e administradores expressamente autorizados pelo dono.
- **Permissões:** acesso dos administradores será individual e granular, conforme as responsabilidades atribuídas. O acesso total fica reservado ao dono.
- **Separação:** o painel geral administra recursos compartilhados do portal; os painéis de RativaPolis e RativaSnack mantêm controles específicos de cada jogo.
- **Auditoria:** manter histórico administrativo completo, registrando todas as ações realizadas nos painéis e sistemas administrativos.
- **Integridade:** os registros de auditoria devem ser armazenados no servidor, protegidos contra alteração ou exclusão por usuários administrativos comuns e consultáveis por quem tiver permissão.

Consulte [ADMIN_GERAL.md](./PortalAdmin/ADMIN_GERAL.md) para os requisitos de acesso, permissões e auditoria.

## Observações

- O portal público único permanece na raiz do repositório: `/index.html`.
- Os jogos continuam em suas pastas próprias; os painéis administrativos ficam separados.
- Na revisão desta estrutura não foi localizado um painel administrativo próprio do RativaSnack.
- Os nomes internos de APIs e Workers foram preservados para evitar quebrar integrações existentes.
