# Administração do RativaSnack

Na revisão atual não foi localizado um painel administrativo próprio do RativaSnack. Esta pasta fica reservada para as ferramentas específicas do jogo, como partidas, estatísticas, ranking, recompensas e moderação.

**Integração confirmada:** o servidor Node do RativaSnack encaminha login e validação de sessão para o Worker central do RativaPolis. A API do RativaSnack também consulta ratopolis_sessions e ratopolis_users no mesmo D1. Assim, contas e identidade são compartilhadas com a RativaGames e os cargos globais são administrados em Admin/PortalAdmin/Equipe.

Não copiar o painel RativaPolis como se fosse um painel RativaSnack. Quando houver operações administrativas próprias do Snack, elas deverão ter endpoints autorizados no servidor e registrar os eventos na auditoria central antes de serem expostas no painel Admin/RativaSnack.
