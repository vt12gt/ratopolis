# RativaSnack — estrutura do servidor

## Pastas
- `Server/server.js`: servidor WebSocket.
- `Server/package.json`: dependências e comandos Node.
- `shared/sim.js`: simulação compartilhada.
- `client/index.html`: cliente HTML atual.

## Rodar o servidor experimental
No terminal, entre em `servidor/Server` e execute:

```bash
npm install
npm start
```

A porta usa `process.env.PORT` (padrão 8080).

## Atenção: integração do cliente
O `client/index.html` foi preservado integralmente. Ele ainda usa o serviço multiplayer existente em `rato-snack-multiplayer.onrender.com`, com autenticação, ticket e protocolo de salas próprio. O servidor WebSocket desta pasta é um protótipo separado e **ainda não é compatível com esse protocolo**. Não troque a URL do cliente por este servidor até concluir a adaptação do protocolo e testar em dois aparelhos.

O módulo compartilhado é carregado pelo servidor por `../shared/sim.js`.
