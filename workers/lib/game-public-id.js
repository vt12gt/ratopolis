const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomSuffix(length = 7) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}

/**
 * Allocate a short public ID for a game database that owns game_users.
 * RS = RativaSnack, RP = Rativapolis. RV (Portal) needs its own registry
 * migration and must not be allocated through this game-database helper.
 * The database UNIQUE constraint remains the final collision guard.
 * Never use a public ID as a password, bearer token, or authorization proof.
 */
export async function generatePublicGameId(db, prefix) {
  if (!["RS", "RP"].includes(prefix)) throw new Error("invalid_game_prefix");
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = prefix + "-" + randomSuffix();
    const exists = await db.prepare("SELECT 1 AS found FROM game_users WHERE public_id = ? LIMIT 1").bind(candidate).first();
    if (!exists) return candidate;
  }
  throw new Error("public_id_allocation_retry_exhausted");
}
