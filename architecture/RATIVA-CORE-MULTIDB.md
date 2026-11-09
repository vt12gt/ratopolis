# Rativa Core — arquitetura multi-D1

## Estado desta entrega

Esta é a fundação isolada de desenvolvimento. Nenhum Worker de produção foi alterado, nenhum usuário foi movido e nenhum progresso foi apagado ou copiado. Os bancos novos começam vazios e não recebem tráfego dos jogos atuais.

## Topologia

- **Portal D1 atual**: continua sendo a fonte de autenticação/identidade do portal durante a transição.
- **RativaSnack D1 (dev isolado)**: `4d187792-dcfb-4694-8d1c-d57f2272b626`.
- **Rativapolis D1 (dev isolado)**: `2d503299-0f3c-4370-97d2-bd6c8608c037`.
- **Rativa Core**: futura API de orquestração, com três bindings D1 independentes. Ela consulta cada banco separadamente e combina respostas na camada de aplicação; não tenta fazer JOIN/transação SQL entre bancos.

## Situação encontrada antes da mudança

Os Workers `ratopolis-api-dev-v30` e `rato-snack-api-dev` estavam ambos ligados ao mesmo D1 `ratopolis-dev-v31`. O banco contém tabelas `ratopolis_users`, `ratopolis_sessions`, `rato_snack_profiles`, `rato_snack_records`, `rato_snack_inventory`, `rato_snack_achievements` e tabelas de ranking do Snack. Portanto, a separação ainda não estava implementada. O Worker do Snack depende hoje da identidade/sessão do Portal, e as tabelas do Snack possuem FKs para `ratopolis_users`.

## Regras de identidade

- Portal: prefixo `RV-`.
- RativaSnack: prefixo `RS-`.
- Rativapolis: prefixo `RP-`.
- IDs públicos são curtos, únicos dentro do jogo, imutáveis e gerados exclusivamente no servidor.
- O ID público é identificador, nunca senha, token de sessão ou prova de autenticação.
- Cada jogo terá credenciais, sessões e perfil próprios.
- Nicknames podem coincidir entre jogos; progresso, moedas, níveis, recordes, inventário e ranking não podem ser compartilhados.
- UUIDs internos existentes permanecem preservados. O campo `legacy_user_id` permite migração rastreável sem reescrever os IDs internos atuais.

## Migração segura

1. Manter os Workers atuais e a D1 compartilhada sem alterações durante a preparação.
2. Criar e validar os schemas isolados em desenvolvimento.
3. Criar snapshots/backup verificáveis do banco atual antes de qualquer migração de dados.
4. Migrar os dados de cada jogo com scripts idempotentes e contagem/checagem de integridade. Não mover tabelas do Portal para os bancos de jogo.
5. Migrar o progresso legado por vínculo explícito e auditado; não copiar credenciais do Portal para o Snack ou Polis. A primeira autenticação independente deve usar fluxo próprio de criação/recuperação de conta.
6. Testar registro, login, sessões, unicidade concorrente de IDs, ranking, inventário, recordes e recuperação.
7. Só depois trocar bindings/rotas dos Workers de jogo, com plano de rollback. Não publicar a mudança de produção antes de aprovação dos testes.

## Camada Rativa Core

A camada central terá bindings nomeados `PORTAL_DB`, `SNACK_DB` e `POLIS_DB`. Endpoints administrativos deverão:
- pesquisar nickname/ID nos três bancos, retornando origem do registro;
- consultar dados de cada jogo no respectivo banco;
- registrar auditoria administrativa com ator, ação, alvo, origem e timestamp;
- nunca fazer JOIN entre bancos nem permitir que uma escrita em um jogo altere progresso de outro;
- aplicar autorização no servidor e limitar consultas administrativas a papéis autorizados.

## Migrações SQL

- `migrations/snack/0001_identity.sql`
- `migrations/polis/0001_identity.sql`

As migrações criam somente tabelas-base de identidade e sessão nos bancos novos. Não alteram o banco compartilhado atual.
