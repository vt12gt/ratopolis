# Ratópolis v1.56.0 — Shaman + arquitetura de servidor (candidata)

## Base e segurança
- Base exata: `ratopolis_v1.55.11_multiplayer_reconnect_fix.html`.
- Esta entrega fica na branch `feature/v1.56.0-shaman-server-authority`; não altera `main`, GitHub Pages nem o Worker ativo.
- Cliente: HTML5/JavaScript. Flash/Adobe Flash não será usado: está obsoleto e não é adequado para o APK/PWA atual.
- O serviço de salas ativo é Cloudflare Worker + Durable Objects (`ratopolis-room-server-v1`), não um servidor dedicado tradicional.

## Correções nesta candidata
1. Contagem de seleção do Shaman ampliada de 5 para 15 segundos.
2. A resposta inicial de `assignShaman` agora inclui `roleConfirmed`, `isShaman` e `noShamanSelected`. Antes, o motor exigia `roleConfirmed === true`, mas o método retornava a resposta crua da API; isso fazia a confirmação falhar.
3. Se ninguém se candidatar, no fim dos 15 segundos o cliente pede `autoSelect:true`; o Durable Object escolhe um jogador aleatoriamente dentro de uma transação, evitando o método anterior em que a primeira requisição concorrente ganhava.
4. O patch do Worker proposto força o papel conforme `room.shamanId`. Somente o Shaman atualmente registrado poderá publicar `shamanObjects` e `shamanPreview`; objetos serão filtrados por tipo, dimensões e valores numéricos. O patch está separado e não foi implantado.

## Arquitetura recomendada
- **Server / Game Server:** Worker de entrada + Durable Object por sala. Dono da sala, participantes, Shaman, ciclo da rodada, validação e estado compartilhado.
- **Request:** endpoints HTTP autenticados para entrar/sair, escolher papel, consultar estado e solicitar ações administrativas.
- **Resource:** mapas, sementes, definições de objetos, limites, configurações e dados estáticos versionados; não aceitar recursos arbitrários do cliente.
- **Client:** HTML5/JavaScript (Canvas), entrada do jogador, renderização, animação, predição visual e interpolação. O cliente nunca deve decidir autoridade, pontuação ou recompensas.
- **Realtime:** WebSocket `wss://` para enviar intenção/estado e distribuir snapshots/eventos. A conexão sozinha não torna o servidor autoritativo.

## Limite técnico importante
Esta candidata fecha a autoridade do papel do Shaman e a validação de publicação de objetos, mas a física dos objetos e o movimento ainda são simulados no cliente e replicados. Portanto, **ainda não é um servidor de simulação totalmente autoritativo**. A etapa seguinte para um servidor completo é mover movimento, colisões, gravidade, pousos, interações com mola/trampolim e resultado da fase para o loop do Durable Object, enviando ao cliente apenas comandos e snapshots validados. Isso exige testes de latência, reconexão e dois ou mais dispositivos antes de publicar.

## Patch do Worker
Consulte `workers/ratopolis-room-server-v1.56.0-shaman-authority.patch.md`. Não substitua o Worker ativo por uma cópia parcial; aplique a alteração somente após revisão e teste isolado.

## Testes obrigatórios
- Dois celulares na mesma sala; o Shaman deve ser idêntico nos dois.
- Dois jogadores clicam para ser Shaman ao mesmo tempo; somente um é aceito.
- Ninguém se candidata; após 15 s o servidor sorteia exatamente um.
- Jogador não-Shaman tenta enviar `shamanObjects`; o Worker remove esses campos.
- Shaman sai/desconecta; substituto é selecionado e o antigo perde a autoridade.
- Reentrada/reconexão não duplica jogadores nem objetos.
- Validar tábuas, caixas, bigornas, canhões, molas e trampolins; não reintroduzir balão sem aprovação.
