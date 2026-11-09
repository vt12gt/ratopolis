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
- `PRAGMA foreign_key_check`: zero violações após a cópia inicial.

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
