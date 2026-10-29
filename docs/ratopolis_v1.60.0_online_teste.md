# Ratópolis v1.60.0 — teste multiplayer online

Esta é uma página de teste separada. Não substitui `index.html` nem a versão oficial usada pelo portal.

## Arquivos

- Cliente: `ratopolis_v1.60.0_online_teste.html`
- Worker de salas: `ratopolis-room-server-v1`
- Versão publicada do Worker: `v6.1.0-ws-hibernation-roster-fix`

## Antes do teste

1. Abra a página de teste pelo GitHub Pages, depois que a publicação terminar:
   https://vt12gt.github.io/ratopolis/ratopolis_v1.60.0_online_teste.html
2. Entre no portal Ratópolis com uma conta válida.
3. Abra o jogo em dois dispositivos ou em dois navegadores/perfis separados. Não use a mesma conta nos dois.
4. Toque em **JOGAR** nos dois. O jogo deve procurar uma sala pública automaticamente.
5. Confirme que os dois jogadores entram na mesma sala e que cada um vê o outro no cenário.

## Checklist de validação

- [ ] A página abre sem erro de JavaScript.
- [ ] O botão **JOGAR** não inicia uma partida offline quando o serviço online está indisponível.
- [ ] As duas contas entram numa sala e aparecem na lista de jogadores.
- [ ] Cada rato aparece uma única vez, sem duplicar o próprio jogador.
- [ ] Movimento e animação são sincronizados nos dois sentidos.
- [ ] Ao fechar uma aba, o jogador desconectado some depois da tolerância de aproximadamente 20 segundos.
- [ ] Ao reconectar, o jogador volta sem ficar duplicado.
- [ ] O Shaman é confirmado pelo servidor; duas contas não podem assumir esse papel simultaneamente.
- [ ] Sair da sala libera a vaga para outro jogador.

## Diagnóstico

- Worker health: https://ratopolis-room-server-v1.juniorgmj69.workers.dev/health
- Código do Worker: `workers/ratopolis-room-server-v1_v6.1.0_ws-hibernation-roster-fix.js`

O endpoint `/health` confirma apenas que o Worker responde. O multiplayer só deve ser considerado validado depois de testar duas contas reais em dispositivos/navegadores separados.

## Rollback

A versão anterior do Worker permanece no histórico de versões da Cloudflare (versão 62). A nova página HTML é independente e pode ser removida sem alterar a página principal.
