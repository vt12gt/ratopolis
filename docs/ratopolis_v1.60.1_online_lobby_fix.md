# Ratópolis v1.60.1 — lobby simplificado e conexão online

Esta é uma página de teste separada. Não substitui `index.html` nem a versão oficial do jogo.

## Arquivos

- Cliente de teste: `ratopolis_v1.60.1_online_lobby_fix.html`
- Página: https://vt12gt.github.io/ratopolis/ratopolis_v1.60.1_online_lobby_fix.html
- Worker de salas: `ratopolis-room-server-v1`
- Health do Worker: https://ratopolis-room-server-v1.juniorgmj69.workers.dev/health

## O que mudou

- Corrigido o fluxo que chamava `/api/lobby/join` duas vezes durante a entrada no Lobby. A segunda chamada podia bloquear a conexão e impedir a emissão do ticket WebSocket.
- A reconexão reaproveita a inscrição no Lobby, sem tentar registrar a mesma conta novamente.
- Ao sair do Lobby para procurar uma partida, o estado da inscrição é liberado antes de procurar sala.
- O progresso de busca aparece dentro do botão **JOGAR**, em vez de cobrir a tela inteira.
- Os atalhos **Meu Lar, Mini Game, Amigos, Ranking, Conquistas e Configurações** ficam dentro do Lobby.
- O menu lateral antigo fica oculto; os IDs dos botões foram preservados para manter os eventos existentes.
- `index.html` e a versão oficial não foram alterados.

## Teste recomendado

1. Abra a página de teste em dois dispositivos ou navegadores/perfis diferentes.
2. Entre no portal com duas contas diferentes.
3. Confira se ambos aparecem no Lobby.
4. Pressione **JOGAR** e observe a barra no próprio botão.
5. Confirme que ambos entram numa sala de partida e conseguem ver o movimento um do outro.
6. Teste reconexão e saída da sala.

A validação de sintaxe dos 16 scripts embutidos passou. Isso não substitui um teste real com duas contas conectadas; se o servidor ainda recusar a autenticação, a mensagem mostrada no Lobby ajuda a identificar a próxima falha.
