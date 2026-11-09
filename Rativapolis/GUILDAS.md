# Sistema de Guildas — RativaPolis

## Implantação de desenvolvimento

- API: `https://rativapolis-guilds-dev.juniorgmj69.workers.dev`
- Worker: `rativapolis-guilds-api-v1`
- Banco: `rativapolis-dev-isolated` (binding `POLIS_DB`)
- Identidade: sessão do portal RativaGames; jogador vinculado por `game_users`.
- Economia: saldo existente em `ratopolis_profiles.coins`; a interface o apresenta como queijo.
- Cliente de teste: `Rativapolis/ratopolis_v1.56.0_guildas_teste.html`.

## Rotas

### GET
- `/api/guilds/me` — perfil da guilda, membros, convites, solicitações, missões, extrato, doadores, loja e conquistas.
- `/api/guilds/ranking?page=1&limit=20` — ranking global.
- `/api/guilds/search?q=` — pesquisa de guildas.

### POST
- `/api/guilds/create`
- `/api/guilds/apply`
- `/api/guilds/application/respond`
- `/api/guilds/invite`
- `/api/guilds/invite/respond`
- `/api/guilds/member/role`
- `/api/guilds/member/remove`
- `/api/guilds/leave`
- `/api/guilds/transfer`
- `/api/guilds/close`
- `/api/guilds/donate`
- `/api/guilds/bank/withdraw`
- `/api/guilds/shop/buy`
- `/api/guilds/bulletin`

Todas as rotas privadas exigem o token de sessão do portal.

## Regras atuais

- Níveis 1–50; 1.000 XP acumulados por nível.
- Limite inicial de 30 membros; +5 vagas a cada 5 níveis, até 80.
- Doações usam chave de idempotência; descontam queijo pessoal e creditam o banco coletivo em uma operação segura.
- Cada 100 queijos doados concede +1 CP individual, limitado a 100 CP por membro/dia; a guilda recebe 1 XP por 100 queijos, limitado a 250 XP/dia por membro.
- Cada fase concluída e validada pelo servidor concede +2 CP ao membro da guilda; o limite atual de 10 recompensas de fase por dia limita esse ganho a 20 CP/dia.
- CP (pontos de contribuição) é uma pontuação individual de participação, não é queijo, não pode ser sacado e não substitui o XP da guilda.
- Missões diárias: 5 fases, 10 queijos coletados e 25 bolotas entregues.
- Missão semanal: arrecadar 1.000 queijos.
- A estrutura das missões existe no banco, mas a API independente v1 ainda não processa eventos de progresso.
- Conquistas são liberadas automaticamente por níveis e marcos de doações.
- Saques do banco: líder e vice-líder; o valor retorna ao saldo pessoal de queijo.
- Compras da loja são debitadas do banco e ficam registradas no patrimônio da guilda.

## Limites desta primeira versão

- O progresso multiplayer é compartilhado pelo servidor; o painel consulta o servidor a cada 8 segundos enquanto está aberto e atualiza imediatamente ao retornar à aba/janela. Ainda não há push instantâneo por WebSocket para mudanças de guilda.
- O carregamento foi otimizado: a primeira consulta não bloqueia a abertura quando já há dados em memória; o endpoint `/api/guilds/me` executa verificações independentes em paralelo e não processa filas pesadas durante a leitura.
- As compras da loja já debitam e registram itens, mas os cosméticos ainda precisam ser conectados ao renderizador/perfil visual do jogo.
- A API independente v1 já cobre identidade autenticada, consulta da guilda, busca, ranking, criação, convites, solicitações, cargos, remoção, saída, transferência, mural, doação, retirada e compra na loja. A interface de teste aponta para esse Worker.
- Missões ainda não recebem eventos de fases, queijo coletado, bolotas, monstros ou Bosses nesta nova API. Não distribuir CP/XP por esses eventos até existir uma integração de servidor verificável. Presença online também não está ligada.
- A API independente de guildas usa o Worker `rativapolis-guilds-dev` (versão `rativapolis-guilds-api-v1`), separado do Worker de identidade e progressão do jogo.
- A interface mantém os dados em memória ao reabrir o painel, atualiza em segundo plano e consulta a API em intervalo de 8 segundos enquanto a guilda está aberta.
- O painel de teste e a API independente foram publicados no ambiente de desenvolvimento. Ainda faltam testes ponta a ponta com contas reais, concorrência financeira e validação de todas as rotas antes de qualquer uso oficial.

## Migração

`migrations/0001_guilds.sql` registra a estrutura inicial das tabelas e índices. `migrations/0002_guild_contribution_points.sql` adiciona o CP individual e o histórico idempotente de pontos. As migrações dependem das tabelas existentes `game_users` e `ratopolis_profiles`.
