# RATÓPOLIS Store API integration contract

Status (2026-10-27): migration applied to the development D1 database; 15 catalog items seeded; store API routes deployed to `ratopolis-api-dev-v30`; the game HTML now calls catalog, purchase, inventory, and equip routes. Authenticated end-to-end purchase tests are still pending. Worker source is versioned at [`workers/ratopolis-api-dev-v30.js`](../workers/ratopolis-api-dev-v30.js).

## Required routes

- `GET /api/store/catalog` — public read-only catalog; return active items with server-owned code, name, description, category, price and payload.
- `GET /api/store/inventory` — authenticated player; return persistent inventory and coin balance from D1.
- `POST /api/store/purchase` — authenticated player; body requires `itemCode` and a client-generated `idempotencyKey`. Never accept price, balance, user ID or granted item payload from the client.
- `POST /api/store/equip` — authenticated player; body contains `itemCode`; require a completed inventory record before equipping.
- `GET /api/admin/store/catalog` and `POST /api/admin/store/catalog` — authorized staff only; validate role permissions server-side.
- `GET /api/admin/store/transactions` — authorized staff only; paginated audit view, no secrets.

## Purchase invariants

1. Resolve player ID exclusively from the validated bearer session.
2. Validate active catalog row and bounded quantity (default 1).
3. Use D1 batch/transaction-safe conditional update to debit coins only when `coins >= total`; verify exactly one profile row changed.
4. Use a unique `(user_id, idempotency_key)` and unique purchase/ledger transaction IDs. Repeated request returns the original purchase, never grants twice. The route also limits each account to 10 purchases per rolling minute.
5. Write purchase, ledger row and inventory grant in one D1 batch. Duplicate inventory constraints cause the batch to roll back, preventing a partial debit or item grant.
6. Return the authoritative balance and inventory from the server. Do not treat localStorage or client-side coins as authoritative.
7. Add a rate limit and validate request size and string lengths. Never expose emails or staff-only fields in public catalog responses.

## Compatibility

The game retains local progress for offline play, but new cosmetic purchases now require the authenticated portal session and the server catalog/inventory. The server balance is authoritative for purchases; local-only coins cannot authorize a purchase. Existing local-only cosmetic unlocks are not automatically trusted as server inventory. Keep paid VIP checkout on its separate Mercado Pago routes. Reward-only hats are not sold.

## Deployment checklist

- Apply `migrations/0001_store.sql` to the intended D1 database.
- Integrate routes into the existing Worker while preserving all existing auth, progression, VIP and webhook routes.
- Deploy and verify catalog GET, insufficient-funds rejection, successful purchase, repeated idempotency key, inventory persistence after relogin, and staff permission denial.
- Only then connect the in-game shop and mark the admin diagnostic as live.


## Eventos e calendário diário (v1)

A migration `migrations/0002_events_daily_rewards.sql` foi aplicada ao D1 de desenvolvimento. Ela cria `ratopolis_events`, `ratopolis_daily_reward_config` e `ratopolis_daily_reward_claims`.

### Rotas
- `GET /api/events`: eventos com status `Publicado`, para o jogo.
- `GET /api/admin/events`: lista de eventos para a equipe autenticada (GM ou superior).
- `POST /api/admin/events`: cria ou atualiza um evento. O servidor valida nome, datas, status e limites de moedas/XP. GM ou superior.
- `GET /api/daily-rewards/config`: configuração pública do calendário.
- `POST /api/admin/daily-rewards/config`: salva calendário de 7, 14 ou 30 dias; requer ADM ou SpAdmin.
- `GET /api/daily-rewards/status`: configuração e resgates do jogador autenticado.
- `POST /api/daily-rewards/claim`: calcula o dia pelo relógio UTC do servidor e credita a recompensa uma única vez por conta/dia. A escrita do resgate, registro de recompensa, saldo XP/moedas e item de inventário (quando configurado) ocorre em um D1 batch.

### Interface
- Painel administrativo: [Eventos e recompensas](https://vt12gt.github.io/ratopolis/ratopolis_admin_v65_3_1_integracao_cenarios_auditoria.html)
- Jogo: [RATÓPOLIS v1.53](https://vt12gt.github.io/ratopolis/ratopolis_v1.53.0_login_obrigatorio_sem_convites.html)

### Limitações e validação pendente
- A configuração e o resgate diário são executados pelo servidor; itens especiais são gravados no inventário pelo código do item configurado.
- Eventos exibem descrição e recompensa anunciada, mas **a recompensa de participação do evento ainda não é concedida automaticamente**; isso exige regras de conclusão/participação próprias.
- A estrutura e as tabelas foram verificadas via Cloudflare D1. A navegação de ponta a ponta com uma sessão real de ADM/jogador ainda precisa ser testada: criar/publicar evento, conferir no jogo, resgatar uma recompensa, tentar resgatar de novo e conferir saldo/inventário.


## Gifts resgatáveis e catálogo de itens (v1)

Migration: `migrations/0003_gifts_item_registry.sql`. Ela cria o cadastro real de gifts, histórico de resgates e registro de cosméticos/títulos existentes no jogo. O cadastro de gifts começa vazio de propósito; nenhum gift fictício ou de teste é inserido.

- `GET /api/admin/gifts`: lista os gifts salvos, recompensas, autor, validade, estado e contagem de resgates; exige ADM/SpAdmin.
- `POST /api/admin/gifts`: cria ou atualiza um gift com código, descrição, moedas, XP, item, quantidade, limite de resgates, expiração e status; exige ADM/SpAdmin.
- `GET /api/admin/items/catalog`: lista os cosméticos e títulos registrados no jogo, incluindo preço quando o item também existe na loja; exige ADM/SpAdmin.
- `POST /api/gifts/redeem`: jogador autenticado resgata o código. O servidor valida status, expiração, limite e resgate único por conta; credita moedas/XP e grava o item no inventário em lote D1.
- O jogo tem o botão **RESGATAR GIFT** no menu e envia o código ao servidor. O saldo é atualizado por meio da progressão do servidor quando disponível.

A tabela de itens registra 23 cosméticos e 6 títulos que já aparecem nas listas de itens/títulos do jogo. O catálogo pode ser ampliado junto com novos itens reais. A publicação do Worker e a criação das tabelas foram realizadas; é necessário fazer um resgate real com conta de jogador para validar a experiência completa na interface.
