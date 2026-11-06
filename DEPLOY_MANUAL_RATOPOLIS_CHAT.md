# Ratópolis — implantação manual do chat e presença

## Implantação realizada em 06/11/2026\n\n- Portal principal atualizado na branch `main`; Pages publica em https://vt12gt.github.io/ratopolis/ .\n- Worker `ratopolis-room-server-v1` atualizado na Cloudflare (deployment `12d97ecc4649427ebab81dd94b0734cb`).\n- Worker `ratopolis-community-chat-preview` atualizado na Cloudflare (deployment `2d6ec788ce714242864c2894ad9d6f08`).\n- Cron configurado: `0 3,15 * * *` (00h e 12h de Brasília).\n\n## Arquivos preparados

1. Portal atualizado (branch `portal-comunidade-preview`): `index.html`
   - Curtidas no roster do chat da comunidade.
   - Mensagem privada entre participantes conectados (não é gravada no histórico do servidor).
   - Botões de moderação para SpAdmin, Admin e GM.
   - Painel reservado de presença das salas do jogo.
   - Comando `#Aviso texto` encaminhado ao servidor das salas para aparecer no chat dentro da partida.
   - Player de rádio e comando `#RadioPedido` preservados.

2. Worker do chat: `workers/ratopolis-community-chat-preview_v1.1.0-community-features.js`
   - Moderação persistente no Durable Object.
   - Curtidas persistidas por jogador.
   - Mensagens privadas enviadas somente aos sockets dos participantes online; não entram no histórico público.
   - Limpeza do histórico via evento `scheduled`.
   - Mantém tickets, autenticação, CORS, pedidos de rádio e classe `CommunityRoom`.

3. Worker das salas: `workers/ratopolis-room-server-v1_v6.1.1_staff-presence-announcements.js`
   - Endpoint de presença das salas, restrito à permissão administrativa `viewAdminPanel`.
   - Endpoint de avisos da equipe para todas as salas, inclusive salas privadas e Lobby.
   - Evento `game_announcement` enviado aos sockets de cada sala.

4. Jogo: `ratopolis_v1.56.0_teste_matchmaking.html`
   - Exibe avisos recebidos no chat da partida.

## Ordem de implantação

### 1. Worker das salas
Atualize o script existente `ratopolis-room-server-v1` com o conteúdo do arquivo 3.
**Preserve os bindings e secrets atuais**, especialmente `ROOMS`, `AUTH_SERVICE`, `SESSION_REVOKE_SECRET`, `COMPETITION_SECRET` e as variáveis já existentes. Não crie outro namespace Durable Object nem altere migrations: a classe existente continua sendo `Room`.

### 2. Worker do chat da comunidade
Atualize o script existente `ratopolis-community-chat-preview` com o conteúdo do arquivo 2.
**Preserve os bindings atuais**, especialmente `COMMUNITY_ROOM` (classe `CommunityRoom`) e `AUTH_SERVICE`. Não remova a configuração Durable Object existente.

Depois, em Settings → Triggers → Cron Triggers, adicione:
```
0 3,15 * * *
```
O agendamento é UTC e corresponde a 00:00 e 12:00 no horário de Brasília (UTC−3). O aviso de renovação será inserido no lugar do histórico apagado.

### 3. Portal e jogo
Publique o `index.html` desta branch no Pages/portal oficial e publique o arquivo 4 no caminho de jogo usado pelo portal. A versão do jogo incluída aqui é a `v1.56.0_teste_matchmaking.html`; confirme que o endereço de jogo do portal aponta para esse arquivo publicado.

## Teste depois de implantar

1. Entre com uma conta SpAdmin/Admin/GM e abra o Chat da Toca.
2. Clique em **Jogadores no jogo** com ao menos um jogador dentro de uma sala; confira nickname e sala.
3. Envie `#Aviso Teste de comunicado Ratópolis`; o chat da partida deve mostrar o aviso destacado.
4. Teste curtir, DM e moderação com duas contas/dispositivos diferentes.
5. Teste o pedido `#RadioPedido` e confirme que ele continua chegando à administração da rádio.
6. Confirme que jogadores silenciados continuam lendo, mas não conseguem falar; libere-os pela equipe.
7. Verifique os horários do Cron no painel Cloudflare.

## Observações importantes

- Os dois Workers já foram implantados na Cloudflare e o Cron já está configurado.
- Ban/mute e curtidas usam o identificador da conta quando autenticada. Convidados recebem ID efêmero; banimento persistente de convidado não é garantido.
- DM é somente online e não fica armazenada no servidor.
- A limpeza do histórico roda somente depois que o Cron for configurado.
- A autorização de presença e avisos consulta o endpoint administrativo e exige `viewAdminPanel`.
