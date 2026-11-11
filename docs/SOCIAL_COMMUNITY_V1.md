# RativaGames — Comunidade Social V1

## Direção aprovada
- O RativaGames será uma rede social gamer; **não haverá fórum, tópicos ou categorias de discussão**.
- Acesso à comunidade somente com a conta autenticada RativaGames já existente.
- Uma única identidade e sessão para portal, RativaPolis e RativaSnack.
- Preservar jogos, rádio, doações, rankings, perfis e painéis administrativos atuais.
- Interface mobile-first, compatível com a PWA e com o tema roxo/dourado existente.

## Etapas de implementação
1. **Feed social:** publicações, reações, comentários, compartilhamento, denúncia e exclusão/moderação.
2. **Relacionamentos:** perfis públicos, seguir/deixar de seguir, solicitações e amizades, bloqueio e mensagens privadas. Cada ação deve ser validada e persistida no servidor.
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

## Estado da implementação — 11/11/2026

- [x] Branch isolada `feature/social-community`; portal oficial preservado.
- [x] Worker do chat/comunidade localizado no próprio repositório.
- [x] Ticket e publicação exigem conta autenticada, com validação no servidor.
- [x] Reações e comentários persistidos no Durable Object.
- [x] Exclusão pelo autor e moderação autorizada.
- [x] Denúncias persistidas, com prevenção de duplicidade e auditoria.
- [x] Painel administrativo com fila de denúncias do feed.
- [x] Worker de preview implantado na Cloudflare, versão 38, sem alterar a branch `main`.
- [x] Portal de preview implantado na Cloudflare, versão 6, servindo o `index.html` e os assets da branch de testes.
- [ ] Portal de preview validado no navegador com a nova interface.
- [ ] Testes reais em dois dispositivos/contas e reconexão.
- [ ] Testes de regressão de chat, voz, rádio, jogos e administração.
- [ ] Implementar amigos, seguidores, grupos e notificações sociais.

**Importante:** o Worker está implantado somente no endpoint de preview. O portal oficial e a branch `main` permanecem sem alterações. Não considerar o feed aprovado para lançamento até concluir os testes de navegador e dois dispositivos.

## Próxima etapa
Validar o portal de preview com o Worker versão 38 e executar o roteiro de aceite descrito em `docs/SOCIAL_FEED_BACKEND_INTEGRATION.md`.
