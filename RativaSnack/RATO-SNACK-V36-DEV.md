# Rato Snack v36 — integração DEV

O HTML v36 foi adicionado ao repositório sem substituir o arquivo principal `Index.html`.

## Abrir o jogo
- GitHub: https://github.com/vt12gt/Ratosnak/blob/main/rato-snack-v36.html
- GitHub Pages (se a publicação do repositório estiver ativa na branch `main`): https://vt12gt.github.io/Ratosnak/rato-snack-v36.html

## Importante: limite do GitHub Pages
GitHub Pages hospeda arquivos estáticos. Ele não executa o servidor Node.js nem hospeda o WebSocket multiplayer. Portanto, o HTML já está no GitHub, mas o multiplayer online só ficará operacional depois de hospedar o `server.js` em um serviço Node.js com HTTPS/WSS público.

## Variáveis do servidor Node.js
Configure no serviço que hospedará o servidor:
```env
PORT=8787
RATOPOLIS_API_URL=https://ratopolis-api-dev-v30.juniorgmj69.workers.dev
RATO_SNACK_API_URL=https://rato-snack-api-dev.juniorgmj69.workers.dev
```

O servidor Node deve disponibilizar `/api/login`, `/api/me`, `/api/rato-snack/*` e `/ws`. No HTML, o campo de endereço do servidor multiplayer deve receber a URL HTTPS pública desse servidor, não a URL do GitHub Pages e não a URL do Worker de perfil.

## Ambiente
- API exclusiva Rato Snack: https://rato-snack-api-dev.juniorgmj69.workers.dev/health
- Banco: `ratopolis-dev-v31` (DEV)
- O `Index.html` original e os demais arquivos existentes não foram substituídos.
- O modo offline continua local e independente.
- Não usar esta integração DEV como versão de produção sem os testes ponta a ponta em dois dispositivos.
