# RativaGames — Comunidade Social V1

## Direção aprovada
- O RativaGames será uma rede social gamer; **não haverá fórum, tópicos ou categorias de discussão**.
- Acesso à comunidade somente com a conta autenticada RativaGames já existente.
- Uma única identidade e sessão para portal, RativaPolis e RativaSnack.
- Preservar jogos, rádio, doações, rankings, perfis e painéis administrativos atuais.
- Interface mobile-first, compatível com a PWA e com o tema roxo/dourado existente.

## Etapas de implementação
1. **Feed social:** publicações, reações, comentários, compartilhamento, denúncia e exclusão/moderação. O feed atual e o envio `feed_post` pelo chat Worker são ponto de partida; validar persistência, histórico, autoria e expiração antes de ampliar.
2. **Relacionamentos:** perfis públicos, seguir/deixar de seguir, solicitações e amizades, bloqueio e mensagens privadas. Não simular ações no navegador: cada ação precisa ser validada e persistida no servidor.
3. **Integração:** eventos de jogos, XP, níveis, títulos e conquistas publicados como atividades verificadas; notificações dentro do portal.
4. **Administração:** fila de denúncias, remoção/ocultação de conteúdo, suspensão de contas, trilha de auditoria e permissões separadas por função.

## Regras de segurança
- Não aceitar nickname, ID, papel ou autoria enviados pelo cliente como prova de identidade. O servidor deriva a identidade do token de sessão.
- Toda rota social privada exige token válido da conta RativaGames; convidados não podem ler nem publicar na comunidade.
- Validar tamanho e tipo de conteúdo no servidor; escapar conteúdo na renderização; aplicar limites de frequência e proteção contra spam.
- Bloqueio impede interação e mensagens entre as contas bloqueadas.
- Denúncias e ações administrativas devem gerar registros de auditoria imutáveis.
- Nunca expor e-mail, nome completo, data de nascimento, WhatsApp, token ou dados privados nos perfis públicos.
- Não criar uma segunda tabela de usuários/contas: relacionar recursos sociais ao identificador interno da conta RativaGames.

## Contrato de API a implementar no backend
Todas as rotas abaixo devem autenticar a sessão existente e aplicar autorização no servidor.

- `GET /api/social/feed?cursor=...`
- `POST /api/social/posts`
- `DELETE /api/social/posts/:postId` (autor ou moderador autorizado)
- `GET /api/social/posts/:postId/comments`
- `POST /api/social/posts/:postId/comments`
- `POST /api/social/posts/:postId/reactions`
- `DELETE /api/social/posts/:postId/reactions`
- `POST /api/social/posts/:postId/reports`
- `GET /api/social/users/:publicId`
- `GET /api/social/users/:publicId/followers`
- `GET /api/social/users/:publicId/following`
- `POST /api/social/users/:publicId/follow`
- `DELETE /api/social/users/:publicId/follow`
- `POST /api/social/friend-requests`
- `POST /api/social/friend-requests/:requestId/accept`
- `POST /api/social/friend-requests/:requestId/decline`
- `GET /api/social/friends`
- `POST /api/social/blocks/:publicId`
- `DELETE /api/social/blocks/:publicId`
- `GET /api/social/notifications`
- `POST /api/social/notifications/:notificationId/read`

## Critérios de aceite
- Visitante sem login é encaminhado à tela de entrar; nenhuma resposta social privada é exibida.
- O login existente libera a comunidade sem novo cadastro e sem nova senha.
- Publicações, comentários, reações, amizades e notificações continuam disponíveis em outro aparelho após novo login.
- Ações recusadas pelo servidor mostram erro claro e não alteram a interface como se tivessem sido concluídas.
- RativaPolis, RativaSnack, rádio, doações, ranking e administração continuam funcionando sem regressão.
- Nenhum recurso de fórum é adicionado.
