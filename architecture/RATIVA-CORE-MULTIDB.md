# Rativa Core — arquitetura multi-D1

## Decisão de identidade (fonte de verdade)

O cadastro e o login são feitos uma única vez no **Rativa Games Portal**. Não existem cadastros, senhas ou sessões independentes para Snack e Polis.

- `PORTAL_DB` é a autoridade de identidade: conta, senha, sessão, status, papel, nickname e ID público principal `RV-`.
- `SNACK_DB` e `POLIS_DB` guardam somente os dados próprios de cada jogo e o vínculo ao identificador interno estável da conta do Portal (`portal_user_id`).
- O nickname oficial é sempre lido do Portal. Os jogos podem manter uma cópia de leitura/cache para consultas e rankings, mas ela deve ser sincronizada a partir do Portal e nunca usada para autenticar ou renomear a conta.
- O jogador usa o mesmo nickname nos dois servidores. Alterações de nickname no Portal devem ser propagadas aos perfis dos dois jogos sem recriar contas nem apagar progresso.
- Cada jogo mantém seu ID público independente (`RS-` e `RP-`), níveis, XP, moedas, recordes, inventário, conquistas e rankings.
- `RV-`, `RS-` e `RP-` são identificadores públicos, não senhas, tokens ou prova de autenticação.

## Topologia

- Portal: D1 atual `ratopolis-dev-v31`, binding `PORTAL_DB`.
- Snack: D1 de desenvolvimento `rativasnack-dev-isolated`, binding `SNACK_DB`.
- Polis: D1 de desenvolvimento `rativapolis-dev-isolated`, binding `POLIS_DB`.
- Core: Worker `rativa-core-dev`.

Não há JOIN nem transação SQL entre D1s. Cada serviço consulta/escreve seu próprio banco. Operações que envolvem mais de uma D1 precisam ser idempotentes, auditáveis e tolerantes a repetição.

## Autenticação e autorização

1. O usuário cria a conta e faz login exclusivamente no Portal.
2. O Portal emite o bearer de sessão. A validação é server-side contra `ratopolis_sessions` e `ratopolis_users` no `PORTAL_DB` (hash SHA-256 Base64URL do token, sessão não expirada e usuário ativo).
3. O cliente envia esse mesmo bearer ao Core/servidor do jogo. Nenhum jogo aceita nickname, ID público ou papel enviado pelo navegador como prova de identidade.
4. O Core valida a sessão central e devolve a identidade oficial (nickname e papel) mais os IDs públicos de jogo vinculados. O servidor de jogo usa o `portal_user_id` validado para localizar o perfil correspondente no seu banco.
5. Senhas, hashes de senha e sessões não são copiados para Snack/Polis. As tabelas legadas `game_credentials` e `game_sessions` nas D1s novas são apenas artefatos iniciais ainda não utilizados; devem ser aposentadas em migração posterior, depois de confirmar que nenhum código as consulta.
6. Suspensão, banimento, expiração e revogação no Portal devem bloquear o acesso aos dois jogos na próxima validação de sessão.

## Vínculo e migração de perfis

- `portal_user_id` é o UUID interno da conta central; não é o ID público RV e não deve ser inferido de IDs novos gerados nas D1s dos jogos.
- O vínculo dos perfis migrados deve ser feito por mapeamento explícito e auditado entre o `legacy_user_id` preservado na cópia e o ID da conta Portal correspondente. Não assumir que valores legados são iguais aos novos UUIDs do Portal.
- Snack tem 2 perfis migrados; Polis tem 19 contas/perfis. A migração só pode preencher `portal_user_id` após validar cada correspondência, rejeitando vínculos ambíguos ou duplicados.
- O nickname da cópia de perfil é um espelho para leitura/ranking. A identidade central do Portal prevalece em caso de divergência.
- Não apagar nem sobrescrever os dados originais do Portal ou dos jogos durante o vínculo.

## IDs públicos

- Portal: `RV-` (registro central ainda precisa de migração própria).
- RativaSnack: `RS-`.
- Rativapolis: `RP-`.
- IDs públicos são curtos, imutáveis, únicos dentro do respectivo produto e gerados exclusivamente no servidor.
- `workers/lib/game-public-id.js` gera RS/RP com aleatoriedade criptográfica e verificação de colisão; UNIQUE no banco é a proteção final. O chamador deve tratar colisões concorrentes com retentativa limitada.
- O ID público principal RV ainda não foi ativado.

## Estado desta entrega (desenvolvimento)

- As três D1s estão isoladas e os dados legados foram copiados sem alterar a origem.
- Core possui health check, busca administrativa somente leitura e rota `GET /api/core/me` para identidade central.
- Worker `rato-snack-api-dev` foi adaptado e implantado em desenvolvimento com `DB` apontando para a D1 isolada Snack e `PORTAL_DB` para a identidade central. Mantém o agendamento semanal existente.
- A autenticação do Snack valida o bearer no Portal, localiza/cria o perfil do jogo por `portal_user_id` e sincroniza nickname central; ranking consulta `game_users` local.
- Migrações `0003_portal_identity_link.sql` aplicadas nas duas D1s de desenvolvimento.
- Vínculos conferidos: 2/2 perfis Snack e 19/19 perfis Polis; nenhuma correspondência ausente, duplicada ou nickname divergente.
- Core `rativa-core-dev` implantado com os três bindings de desenvolvimento.
- Nenhum Worker de produção teve binding alterado nesta etapa. O Worker principal `ratopolis-api-dev-v30` ainda concentra autenticação/Portal e lógica de Polis; a separação do backend Polis é a próxima etapa.

## Dados migrados em desenvolvimento

- Snack: 2 contas com perfil, 2 perfis, 6 itens de inventário e 1 ciclo de ranking.
- Polis: 19 contas, 19 perfis, 51 eventos de recompensa, 5 cenários, 6 versões, 1 revisão, 45 itens de registro, 31 itens de catálogo e 1 presente.
- `PRAGMA foreign_key_check`: zero violações após a cópia inicial e novamente após as migrações/vínculos nas duas D1s.
- Contagens após vínculo: Snack 2 usuários, 2 perfis, 6 itens de inventário e 1 ciclo de ranking; Polis 19 usuários, 19 perfis, 51 eventos de recompensa e 5 cenários.

## Próximas etapas obrigatórias antes de produção

1. Separar o Worker principal `ratopolis-api-dev-v30`: manter cadastro/login e dados de identidade no Portal; mover perfil, progresso, moedas, VIP, inventário, cenários e recompensas de Polis para `POLIS_DB` por meio de um serviço de jogo autenticado pela sessão central.
2. Adaptar as rotas Polis para resolver `portal_user_id` em `game_users` e usar o UUID local do perfil em todas as tabelas do jogo, sem alterar IDs de auditoria/identidade do Portal indevidamente.
3. Implementar sincronização idempotente do nickname central no perfil Polis e propagar alterações aos snapshots/rankings conforme a regra de cada ranking.
4. Concluir testes integrados no Snack e no Polis: login único, expiração/revogação, banimento, nickname alterado, perfil ausente, IDs públicos, rankings, inventário, moedas e progresso.
5. Revisar logs, CORS, rate limits, integridade referencial e idempotência; executar `PRAGMA foreign_key_check` em cada D1.
6. Só então preparar cutover com backup, métricas, rollback e mudança controlada de bindings. Não publicar produção antes da homologação integrada.

## Endpoints Core

- `GET /health` e `GET /api/core/health`: conectividade das três D1s.
- `GET /api/core/me`: exige bearer válido do Portal; retorna identidade oficial e IDs públicos dos perfis vinculados.
- `GET /api/core/admin/search?q=<termo>`: exige sessão Portal válida e papel `spadm` ou `adm`; registra consulta na auditoria do Portal.

O Admin Geral mantém autorização exclusivamente no servidor. Consultas entre bancos são separadas. Escritas devem ocorrer no banco de origem e ser auditadas.


## Mapeamento técnico do Worker Polis legado (inspeção v39.9)

Inspeção do Worker de desenvolvimento `ratopolis-api-dev-v30` confirmou que ele ainda é um monólito Portal + Polis. A versão lida foi `v39.9-admin-role-special-staff-fix`.

### Rotas que pertencem aos dados de jogo Polis

- Identidade de jogo/perfil: `GET /api/profile/personal` (somente campos de jogo devem vir de POLIS_DB; nickname, email, papel e status oficiais continuam no Portal).
- Progresso e recompensas: `/api/rankings`, `/api/rankings/level`, `/api/progression/me`, `/api/progression/reward`, `/api/internal/competition/reward`, `/api/internal/rewards/grant`, `/api/players`.
- Loja, saldo, inventário e VIP: `/api/store/catalog`, `/api/store/inventory`, `/api/store/purchase`, `/api/store/equip`, `/api/store/me`, `/api/admin/store/catalog`, `/api/admin/store/transactions`, `/api/store/checkout`, `/api/store/webhook/mercadopago`, `/api/admin/items/catalog`.
- Recompensas, eventos e presentes: `/api/events`, `/api/admin/events`, `/api/daily-rewards/*`, `/api/admin/daily-rewards/config`, `/api/admin/gifts`, `/api/gifts/redeem`.
- Cenários: `/api/editor/*`, `/api/admin/scenario-staff`, `/api/admin/scenarios/*`, `/api/admin/scenario-*`.

### Rotas que permanecem no Portal

Cadastro/login/logout, emissão e revogação de sessão, `/api/me` como validação da sessão central, gestão de contas e papéis globais, auditoria central, privacidade/acesso e doações. Essas rotas não podem passar a consultar POLIS_DB por substituição global do binding.

### Bloqueios técnicos encontrados antes do cutover

1. A função legada `authenticate(request, env)` valida sessão em `ratopolis_sessions` e carrega usuário em `ratopolis_users` usando `env.DB`. Ela devolve o UUID do Portal; as tabelas de jogo exigem o UUID local de `game_users`.
2. A autenticação de jogo precisa validar bearer exclusivamente em `PORTAL_DB`, localizar `game_users.portal_user_id` em `POLIS_DB`, sincronizar nickname e devolver o ID local de jogo às rotas Polis.
3. Há SQL legado com JOINs entre tabelas do jogo e `ratopolis_users`. Esses JOINs entre D1s não são possíveis; devem ser separados em consultas e os campos centrais devem vir do Portal.
4. A auditoria deve ser classificada por domínio: ações globais de conta/permissão continuam no Portal; ações de jogo/cenários/loja podem ser registradas na auditoria Polis e, quando administrativas, correlacionadas com o ator central.
5. Rotas de pagamento/webhook e operações administrativas exigem idempotência e validação de permissões antes de mover qualquer escrita. Não basta trocar `env.DB` por `env.POLIS_DB`.

### Estratégia aprovada para a próxima implementação

- Manter `ratopolis-api-dev-v30` como autoridade de cadastro, sessão e administração global.
- Implementar o serviço Polis separado, com bindings `PORTAL_DB` e `POLIS_DB`, autenticação central e resolução de perfil local por `portal_user_id`.
- Migrar grupos de rotas por domínio, começando por leitura de perfil/progresso/rankings; depois recompensas, loja/inventário/VIP, eventos/presentes e editor de cenários.
- Manter contratos JSON atuais para não exigir mudança simultânea no cliente.
- Só apontar o cliente para o novo serviço depois de testes de integração e validação das rotas equivalentes. Nenhum binding de produção deve ser alterado nesta fase.


## Primeira entrega de código do serviço Rativapolis (desenvolvimento)

Foi criado `workers/rativapolis-api-dev.js` e implantado como Worker separado `rativapolis-api-dev`. Ele não substitui nem altera o Worker Portal legado.

Bindings confirmados no Worker:
- `PORTAL_DB` → `ratopolis-dev-v31` (identidade/sessões centrais).
- `POLIS_DB` → `rativapolis-dev-isolated` (perfis e dados do jogo).

### Endpoints iniciais

- `GET /health` e `GET /api/rativapolis/health`: diagnóstico de conectividade e contagem de contas/perfis.
- `GET /api/rativapolis/profile`, `/api/rativapolis/profile/personal` e `/api/rativapolis/me`: perfil de jogo, com nickname e papel lidos do Portal.
- `GET /api/rativapolis/progression/me`: nível, XP, VIP e moedas do perfil Polis.
- `GET /api/rativapolis/rankings` e `/api/rativapolis/rankings/level`: ranking público por nível/XP, paginado.
- `GET /api/rativapolis/players`: lista pública de jogadores ativos.

### Regras implementadas

- Bearer é validado por hash SHA-256 contra sessão ativa no Portal.
- Perfil local é localizado por `portal_user_id`; não há fallback por nickname, e-mail ou ID legado.
- Nickname local é sincronizado a partir do Portal.
- As consultas e escritas de perfil usam somente `POLIS_DB`; nenhuma senha ou sessão é copiada para a D1 Polis.
- O ranking usa exclusivamente `game_users` e `ratopolis_profiles` da D1 Polis.

### Limites desta primeira entrega

- Esta versão inicial é somente leitura para dados de jogo (a sincronização do nickname e a criação idempotente de perfil vazio são as únicas escritas de perfil).
- Recompensas, loja, inventário, VIP pago, eventos, presentes e editor de cenários ainda não foram movidos.
- O cliente do jogo ainda não foi apontado para o novo Worker; o Worker legado continua servindo o fluxo atual.
- O deploy foi aceito pelo Cloudflare e os dois bindings foram confirmados pela configuração do Worker. O teste HTTP público de runtime não pôde ser concluído neste ambiente; health e endpoints precisam de smoke test externo antes de qualquer troca do cliente.
- Nenhuma configuração de produção foi alterada.

Próxima etapa: smoke tests autenticados e integração do cliente de teste com os endpoints de perfil/progresso/ranking; em seguida, implementar recompensas e os demais domínios com idempotência e auditoria.


## Compatibilidade de leitura com rotas legadas (desenvolvimento)

Em 2026-11-09, o Worker `rativapolis-api-dev` recebeu aliases de leitura para reduzir a mudança simultânea no cliente:
- `GET /api/profile` → perfil do jogador no Polis, com nickname/role/email/status vindos do Portal e progressão do banco Polis.
- `GET /api/progression/me` → mesmo contrato legado `{ ok, progresso }`, consultando o perfil local Polis.
- `GET /api/rankings` → ranking geral ordenado por XP e depois nível.
- `GET /api/rankings/level` → ranking por nível e XP.
- Os caminhos novos `/api/rativapolis/*` continuam disponíveis.

As respostas mantêm as chaves legadas `jogador`, `progresso`, `jogadores`, `pagina`, `limite`, `total` e `total_paginas`. Os IDs retornados pelo serviço novo são IDs públicos RP do jogo, não UUIDs centrais do Portal.

O deploy atualizado de desenvolvimento foi aceito em 2026-11-09 e os bindings foram conferidos novamente: `PORTAL_DB` → `ratopolis-dev-v31`; `POLIS_DB` → `rativapolis-dev-isolated`.

Limites: o teste HTTP de runtime continua bloqueado pelo ambiente de execução (requisições ao domínio workers.dev são negadas antes de chegar ao Worker). A rota privada `/api/profile/personal` que trata nome completo/data de nascimento/WhatsApp não foi copiada para o serviço de jogo; continua sendo dado privado do Portal. O cliente do jogo ainda não foi alterado nem conectado. Antes de integrar, localizar o frontend correto e conferir todos os endpoints chamados por ele, especialmente rotas POST de recompensas, loja, inventário, cenários e autenticação. Nenhuma configuração de produção foi alterada.


## Localização do cliente Rativapolis no repositório unificado

O repositório único é `vt12gt/RativaGames`; não existe dependência de um repositório separado `ratopolis`. A árvore da branch principal foi conferida em 2026-11-09. O cliente de jogo atualmente identificado é `ratopolis_v1.56.0.html` na raiz do repositório (574 KB). Também existem protótipos antigos `ratopolis_v1.53.6_*.html`, a cópia `ratopolis_v1.56.0_teste_matchmaking.html`, a pasta administrativa `Admin/RativaPolis/` e o Portal em `index.html`.

O cliente v1.56.0 ainda aponta `PROGRESSION_API` para `ratopolis-api-dev-v30` e envia recompensas por `POST /api/progression/reward`, além de consultar `GET /api/progression/me`. Portanto, não se deve alterar apenas a URL para `rativapolis-api-dev`: a versão atual desse Worker tem a leitura de progressão, mas ainda não tem a escrita de recompensas necessária. A migração segura seguinte é implementar e validar a gravação idempotente de recompensas na D1 Polis, preservando o formato JSON e os limites de segurança do cliente; só então conectar uma cópia de teste do HTML, mantendo o arquivo principal intacto.
