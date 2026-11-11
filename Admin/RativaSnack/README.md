# Administração do RativaSnack

Painel administrativo próprio, separado do Admin RativaPolis e do Admin RativaGames.

- Painel principal: https://vt12gt.github.io/RativaGames/Admin/RativaSnack/
- Painel de teste com dados privados: https://vt12gt.github.io/RativaGames/Admin/RativaSnack/index-perfil-privado-teste.html
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
A API valida o token de sessão da RativaGames e consulta a autorização administrativa do serviço de equipe. A senha não é armazenada no painel. O reset preserva a conta e reinicia o progresso. A exclusão remove os dados de jogo e desativa/anônimiza a identidade do RativaSnack com um registro de bloqueio (tombstone), para impedir que o vínculo com o portal recrie automaticamente a conta. A conta principal compartilhada do portal não é apagada. Contas com cargos administrativos ficam protegidas contra exclusão pelo painel. As operações administrativas são registradas em `game_audit_logs`.

## Presença online
O cliente RativaSnack Online envia heartbeat autenticado a cada 20 segundos enquanto o jogador está em uma sala. O painel considera online quem enviou o último sinal nos 60 segundos anteriores. Ao sair da sala, o cliente encerra a presença; se o navegador fechar abruptamente, o registro expira pela janela de 60 segundos. Sessões válidas do portal são exibidas separadamente.
