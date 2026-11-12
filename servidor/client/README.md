# Cliente RativaSnack

Este diretório mantém uma cópia integral do cliente online.

O gateway `../Server/proxy.js` foi criado para encaminhar HTTP e WebSocket ao backend atual, preservando o protocolo de autenticação e salas. Depois do deploy no Render, a URL do gateway poderá ser configurada em uma cópia de teste do cliente, sem mexer no arquivo principal `RativaSnack/Online.html`.

O gateway continua dependendo do backend atual (`rato-snack-multiplayer.onrender.com`); ele não é um substituto autônomo nem altera a simulação do jogo.
