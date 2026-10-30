# Checklist de validação do RATÓPOLIS

Use esta lista antes de arquivar versões HTML antigas ou integrar a limpeza em `main`. Marque cada item somente após testar no ambiente publicado e, quando aplicável, em uma conta de teste.

## 1. Publicação e navegação

- [ ] Confirmar no GitHub Pages qual branch e pasta são publicadas.
- [ ] Abrir o portal oficial `index.html` e verificar se carrega sem erro.
- [ ] Abrir o jogo oficial `ratopolis_v1.52.0_shaman.html` pelo fluxo normal do portal.
- [ ] Abrir o painel oficial `ratopolis_admin_v65_3_1_integracao_cenarios_auditoria.html` pelo link administrativo esperado.
- [ ] Verificar links externos, URLs compartilhadas e favoritos antes de mover qualquer HTML legado.
- [ ] Conferir o console do navegador e a aba Network para erros 404, JavaScript e requisições bloqueadas.

## 2. Conta e jogo

- [ ] Entrar e sair da conta de teste.
- [ ] Confirmar que a sessão e a identidade do jogador se comportam corretamente.
- [ ] Entrar nas salas disponíveis e verificar a contagem real de jogadores online.
- [ ] Testar movimentação e animações do personagem em desktop e celular.
- [ ] Verificar reconexão após atualizar a página ou perder conexão.

## 3. Chat e multiplayer

- [ ] Enviar mensagens no chat mundo com duas contas de teste.
- [ ] Confirmar que jogadores desconectados deixam de contar como online.
- [ ] Testar chat privado entre as duas contas.
- [ ] Confirmar as regras de retenção de mensagens esperadas; não usar dados reais de jogadores em testes.

## 4. Painel administrativo, loja e eventos

- [ ] Abrir o painel e verificar autenticação/permissões administrativas.
- [ ] Abrir e salvar um cenário de teste sem sobrescrever conteúdo de produção.
- [ ] Verificar catálogo da loja, compra de teste e saldo de moedas.
- [ ] Verificar evento ativo, calendário/recompensa diária e exibição no jogo.
- [ ] Confirmar que os dados são persistidos no ambiente correto e que não há erros nas chamadas da API.

## 5. Banco e infraestrutura

- [ ] Conferir que o Worker publicado corresponde ao ambiente pretendido.
- [ ] Conferir bindings e configuração de ambiente sem revelar valores secretos.
- [ ] Não executar migrations em produção como parte da limpeza.
- [ ] Confirmar que migrations existentes permanecem na ordem e com os nomes atuais.

## 6. Critério para arquivar HTML legado

Um arquivo só pode ser considerado candidato a arquivamento quando:

1. não é um dos três arquivos oficiais;
2. não é alvo de links internos, links construídos por JavaScript ou ferramentas;
3. não é necessário para URLs públicas, favoritos, Pages ou fluxos operacionais conhecidos;
4. as funções equivalentes foram testadas no arquivo oficial;
5. a mudança é feita em PR separado, movendo para `archive/` primeiro, sem exclusão em lote.

**Limite:** esta lista é um roteiro de validação. A existência deste documento não significa que os testes funcionais já foram executados.
