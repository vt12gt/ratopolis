# RativaGames — integração do feed social (fase 1)

## Estado confirmado no portal

Arquivo analisado: `index.html`, branch `feature/social-community`.

O portal já possui um mural conectado ao Worker de comunidade:
- Conexão autenticada por `POST /api/ticket`, enviando o token RativaGames no cabeçalho Authorization.
- O evento `ready` pode entregar `feedHistory`.
- O cliente já entende os eventos WebSocket `feed_history` e `feed_post`.
- Publicação é enviada como `{ type: "feed_post", text }`.
- O cliente filtra posts por `expiresAt` e atualmente a interface informa expiração em 12 horas.
- O envio do post exige sessão RativaGames ativa no cliente.
- O mesmo Worker também atende chat, mensagens privadas, presença, voz, avatares e ferramentas de moderação.

## Limite técnico encontrado

O endereço do Worker está configurado no portal como:
`https://ratopolis-community-chat-preview.juniorgmj69.workers.dev`

O código-fonte desse Worker não está entre os repositórios GitHub atualmente acessíveis nesta integração. O repositório `vt12gt/RativaGames` contém o cliente, não a implementação do Worker. Portanto, não é seguro adicionar botões de curtir/comentar/compartilhar que apenas alterem a tela: sem persistência no servidor, as interações desapareceriam ao recarregar e poderiam ser falsificadas pelo navegador.

## Contrato mínimo necessário no Worker

Manter os eventos atuais sem quebra e acrescentar operações autenticadas:

- `feed_react`: `{ type, postId, reaction }`; servidor valida sessão, grava/remova a reação por jogador e transmite `feed_reaction`.
- `feed_comment`: `{ type, postId, text }`; servidor valida sessão, tamanho, existência/expiração do post e bloqueios, grava e transmite `feed_comment`.
- `feed_comments`: `{ type, postId }`; servidor retorna comentários persistidos.
- `feed_delete`: `{ type, postId }`; servidor permite autor ou equipe autorizada e registra auditoria.
- `feed_report`: `{ type, postId, reason }`; servidor registra denúncia.
- Histórico deve devolver reações agregadas, reação do jogador atual, contagem/comentários e metadados de autoria.

Regras obrigatórias:
1. O servidor deriva o autor exclusivamente do token/sessão validado; nunca confia em `playerId`, nickname ou role enviados pelo navegador.
2. Reações e comentários persistem entre dispositivos e recarregamentos.
3. Validar limites, texto, rate limit, bloqueios e expiração no servidor.
4. Manter feed e chat separados.
5. Preservar o login/conta RativaGames existente; não criar outra tabela de contas.
6. Ações administrativas devem gerar trilha de auditoria.
7. Não alterar o prazo atual de 12 horas sem decisão explícita.

## Próximo passo de implementação

Disponibilizar o repositório ou o código-fonte do Worker que atende `ratopolis-community-chat-preview.juniorgmj69.workers.dev`. Com ele, implementar primeiro persistência de reações e comentários, depois integrar os controles no `index.html` e validar em dois dispositivos com a mesma publicação.

## Testes de aceite

- Publicar com uma conta existente.
- Ver a mesma publicação em outro dispositivo autenticado.
- Curtir e comentar em um dispositivo e confirmar os dados no outro após recarregar.
- Confirmar que visitante não consegue publicar, reagir ou comentar.
- Confirmar que chat, mensagens privadas, voz, rádio, jogos, login e administração continuam funcionando.
- Confirmar que falhas do Worker aparecem como erro real; nunca mostrar sucesso antes da confirmação do servidor.
