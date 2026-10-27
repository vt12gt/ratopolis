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
