# Ratópolis — preparação de teste online

## Estado seguro do teste

- Branch: `test/auto-matchmaking-online`
- Pull request: https://github.com/vt12gt/ratopolis/pull/4
- Arquivo do jogo alterado: `ratopolis_v1.52.0_shaman.html`
- A alteração não foi mesclada em `main`.
- Nenhum Worker foi alterado ou publicado.
- O teste real de HTTP/WebSocket ainda precisa ser executado num navegador com duas contas válidas.

## Objetivo

Validar matchmaking automático exclusivamente pelo servidor, sem fallback para partida local, priorizando uma sala pública ocupada que ainda tenha vaga. A tela não deve exigir que o jogador escolha manualmente uma sala.

## Achado no Worker `ratopolis-room-server-v1`

O endpoint `/api/rooms/match` já escolhe uma sala pública disponível e prioriza uma sala com jogadores. Porém, no Durable Object `Room`, o handler `POST /join` só define `shamanId` quando o cliente envia `role: "shaman"`. O endpoint de matchmaking chama `/join` sem esse campo. Quando não existe Shaman válido, o código mantém `shamanId = null` e `shamanPending = true`.

O handler `POST /role` também não corrige isso: quando não encontra Shaman válido, retorna `noShamanSelected: true`. Isso pode deixar a sala sem Shaman no início da partida. A correção deve ser feita no código do Worker e testada antes de qualquer publicação.

## Correção de servidor recomendada — não aplicada

1. Em `POST /join`, dentro da transação, depois de inserir/atualizar o jogador:
   - Se existir um Shaman válido, preservá-lo.
   - Se não existir Shaman válido, atribuir o papel a um único jogador ativo de forma atômica e definir `shamanPending = false`.
   - Se o cliente pedir `role: "shaman"`, aceitar o pedido apenas quando não houver Shaman válido ou quando o pedido for do Shaman atual.
   - Não aceitar que um segundo jogador substitua um Shaman válido.
2. Em `POST /role`, após remover jogadores expirados, fazer uma recuperação defensiva: se restarem jogadores e não houver Shaman válido, escolher um jogador ativo dentro da mesma transação, definir `shamanId` e limpar `shamanPending` antes de montar a resposta.
3. Quando o Shaman sair, manter a transferência já existente para um jogador restante; se a sala ficar vazia, limpar o estado do Shaman.
4. Manter a escolha autoritativa no servidor. O cliente não pode declarar sozinho que é Shaman.

## Roteiro de validação com duas contas

### A. Matchmaking
- [ ] Abrir o jogo com a conta A e clicar em **JOGAR** uma vez.
- [ ] Confirmar que o cliente chama `/api/rooms/match` e recebe um código de sala do servidor.
- [ ] Abrir a conta B e clicar em **JOGAR**.
- [ ] Confirmar que B prioriza uma sala ocupada com vaga.
- [ ] Confirmar que ambas as contas recebem o mesmo código e aparecem na lista de jogadores.
- [ ] Confirmar que a interface não pede seleção manual de sala.
- [ ] Simular falha do endpoint: deve mostrar erro de conexão, sem iniciar partida local.

### B. Shaman
- [ ] Entrar com A numa sala vazia: deve existir exatamente um Shaman.
- [ ] Entrar com B: A continua sendo o único Shaman.
- [ ] Consultar o estado da sala e confirmar um único `shamanId`.
- [ ] Sair com A: B deve assumir o Shaman conforme a regra do servidor.
- [ ] Fazer A reconectar: não pode criar um segundo Shaman.
- [ ] Repetir entradas simultâneas para verificar que a atribuição transacional não cria dois Shamans.
- [ ] Expirar/remover um jogador antigo e confirmar que o estado recupera um Shaman válido.

### C. Sessão e rede
- [ ] Conta sem sessão válida: erro de autenticação explícito, sem fallback offline.
- [ ] A mesma conta em duas salas: a segunda entrada deve ser recusada pelo bloqueio de sessão.
- [ ] WebSocket: confirmar atualização de presença e remoção do jogador ao sair.
- [ ] Conferir logs do Worker para erros de autenticação e falhas de Durable Object.

## Critério para liberar

Não mesclar o PR nem publicar o Worker até que os testes de duas contas, Shaman único, reconexão, saída e falha de rede tenham sido executados e registrados. Testes estáticos não substituem os testes reais de navegador e servidor.
