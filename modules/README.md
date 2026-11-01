# Ratópolis — quatro módulos independentes

Esta pasta contém as quatro fronteiras iniciais do multiplayer. Nesta entrega,
os módulos são criados separadamente e **ainda não estão conectados** ao Worker
de produção, ao login, ao matchmaking, aos mapas oficiais ou ao HTML v1.55.11.

## Módulos

- `server/`: autoridade de salas, jogadores, fases e snapshots.
- `request/`: protocolo versionado, validação de comandos e serialização.
- `resource/`: registro e validação de mapas/recursos. Não inventa o mapa oficial.
- `client/`: fronteira de apresentação, controles e transporte; não decide física.

## Contratos obrigatórios na futura integração

1. A identidade entregue ao Server vem exclusivamente da sessão Ratópolis já verificada.
2. ID e NickName não são aceitos de payloads de movimento.
3. A física e o estado oficial são calculados no servidor.
4. O Request valida versão, tamanho e formato antes de encaminhar comandos.
5. Todos os clientes recebem snapshots do mesmo estado autoritativo.
6. Recursos de progressão do jogo ficam separados por jogo; não reutilizar XP/moedas
   de Ratópolis no Rato Snack.
7. Não alterar Worker/produção nem o arquivo oficial enquanto a integração não
   tiver testes e validação isolada.

## Estado desta entrega

Os quatro módulos são bases independentes e importáveis. A integração com os
módulos existentes em `src/` será feita depois, um limite de responsabilidade
por vez. O mapa `test_fixture` continua sendo apenas fixture de desenvolvimento.
