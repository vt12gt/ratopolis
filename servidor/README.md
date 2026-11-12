# RativaSnack — servidor e gateway de compatibilidade

## Estrutura
- `Server/proxy.js`: gateway de compatibilidade HTTP + WebSocket.
- `Server/server.js`: protótipo de simulação autoritativa independente (não é o backend do jogo atual).
- `Server/package.json`: dependências e comandos Node.
- `shared/sim.js`: simulação experimental.
- `client/index.html`: cópia preservada do cliente.

## Como o gateway funciona
O cliente online atual usa autenticação, emissão de ticket em `/api/ws-ticket`, conexão em `/ws?ticket=...` e um protocolo de salas (`play`, `joined`, `roster`, `start`, `peer_join`, `in`, `st` etc.). O protótipo antigo desta pasta não implementava isso.

O novo `proxy.js` encaminha as requisições HTTP e o WebSocket para o backend atual, preservando os tickets e mensagens sem reinterpretá-los. Assim, o jogo continua usando o protocolo que já conhece, incluindo salas, sinalização, voz, staff, ranking e salvamento — sem tentar substituir o backend por uma simulação incompatível.

## Configuração no Render
Crie um serviço Web Service apontando para este repositório e configure:
- **Root Directory:** `servidor/Server`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment:** `Node`
- **Environment Variable:** `RATIVA_UPSTREAM_URL=https://rato-snack-multiplayer.onrender.com`

O Render fornece `PORT` automaticamente. Não coloque tokens, senhas ou chaves no código.

## Como apontar um cliente para o gateway
Depois de publicar o serviço e copiar a URL HTTPS gerada pelo Render, a constante `RATO_SERVER_URL` do cliente de teste deve apontar para essa URL. A URL do WebSocket é derivada automaticamente pelo cliente.

**Não altere o `RativaSnack/Online.html` principal antes de testar.** Primeiro use uma cópia de teste, faça login, entre numa sala e valide dois aparelhos. O gateway é um intermediário compatível, não um novo servidor de simulação: ele ainda depende do backend atual estar disponível.

## Testes e limitações
A estrutura e o código foram preparados no GitHub, mas ainda não foi feito deploy no Render nem teste real com dois celulares. O gateway só deve ser considerado pronto para uso depois de validar login, ticket, entrada/saída de sala, reconexão, mensagens de jogo e persistência.
