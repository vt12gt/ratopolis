# RATÓPOLIS Store API integration contract

Status: schema and initial catalog seed are committed; API routes are not deployed by this document.

## Required routes

- `GET /api/store/catalog` — authenticated player; return active items with server-owned code, name, description, category, price and payload.
- `GET /api/store/inventory` — authenticated player; return persistent inventory and coin balance from D1.
- `POST /api/store/purchase` — authenticated player; body requires `itemCode` and a client-generated `idempotencyKey`. Never accept price, balance, user ID or granted item payload from the client.
- `POST /api/store/equip` — authenticated player; body contains `itemCode`; require a completed inventory record before equipping.
- `GET /api/admin/store/catalog` and `POST /api/admin/store/catalog` — authorized staff only; validate role permissions server-side.
- `GET /api/admin/store/transactions` — authorized staff only; paginated audit view, no secrets.

## Purchase invariants

1. Resolve player ID exclusively from the validated bearer session.
2. Validate active catalog row and bounded quantity (default 1).
3. Use D1 batch/transaction-safe conditional update to debit coins only when `coins >= total`; verify exactly one profile row changed.
4. Use a unique `(user_id, idempotency_key)` and unique purchase/ledger transaction IDs. Repeated request returns the original purchase, never grants twice.
5. Write purchase, ledger row and inventory upsert as one atomic operation. On any failure, no partial debit or item grant may remain.
6. Return the authoritative balance and inventory from the server. Do not treat localStorage or client-side coins as authoritative.
7. Add a rate limit and validate request size and string lengths. Never expose emails or staff-only fields in public catalog responses.

## Compatibility

The current HTML game still contains local-only `coins` and `ownedHats` state. Its shop must not call the new purchase API until account-token integration is active and inventory/equipment can be loaded from the server. Keep paid VIP checkout on its existing separate Mercado Pago routes. Do not seed reward-only hats as purchasable products.

## Deployment checklist

- Apply `migrations/0001_store.sql` to the intended D1 database.
- Integrate routes into the existing Worker while preserving all existing auth, progression, VIP and webhook routes.
- Deploy and verify catalog GET, insufficient-funds rejection, successful purchase, repeated idempotency key, inventory persistence after relogin, and staff permission denial.
- Only then connect the in-game shop and mark the admin diagnostic as live.
