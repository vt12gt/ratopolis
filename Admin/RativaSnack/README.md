# Administração do RativaSnack

Painel administrativo próprio, separado do Admin RativaPolis e do Admin RativaGames.

- Painel: https://vt12gt.github.io/RativaGames/Admin/RativaSnack/
- API administrativa: https://rativasnack-admin-api-dev.juniorgmj69.workers.dev
- Worker: `rativasnack-admin-api-dev`
- Banco do jogo: `rativasnack-dev-isolated`
- Banco de autenticação: `ratopolis-dev-v31`

## Recursos implementados
- Visão geral de contas, cadastros recentes, partidas, pontuação, tempo jogado, eventos e sessões válidas.
- Atualização manual do ranking mensal, sem esperar o ciclo automático.
- Eventos da sala ao vivo, histórico de ganhadores e logs.
- Pesquisa de jogadores, reset de progresso e exclusão da conta específica do jogo.
- Enviar, retirar ou definir saldo de queijo.
- Auditoria administrativa para as operações feitas pelo painel.

## Autenticação e segurança
A API valida o token de sessão da RativaGames e consulta a autorização administrativa do serviço de equipe. A senha não é armazenada no painel. O reset preserva a conta e reinicia o progresso. A exclusão remove os dados e a identidade do RativaSnack, sem apagar a conta principal compartilhada do portal. Contas com cargos administrativos ficam protegidas contra exclusão pelo painel. As operações administrativas são registradas em `game_audit_logs`.

## Presença online
A API do jogo ainda não registra heartbeat contínuo de cada jogador dentro das salas. Para evitar números falsos, o painel apresenta sessões válidas do portal em separado e sinaliza que isso não equivale a jogadores online reais. A contagem exata online depende da integração de presença no cliente RativaSnack Online/servidor de salas.
