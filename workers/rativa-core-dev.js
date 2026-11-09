const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" || !["/health", "/api/core/health"].includes(url.pathname)) {
      return json({ ok: false, error: "not_found" }, 404);
    }

    try {
      const checks = await Promise.all([
        env.PORTAL_DB.prepare("SELECT COUNT(*) AS total FROM ratopolis_users").first(),
        env.SNACK_DB.prepare("SELECT COUNT(*) AS total FROM game_users").first(),
        env.POLIS_DB.prepare("SELECT COUNT(*) AS total FROM game_users").first()
      ]);

      return json({
        ok: true,
        service: "rativa-core-dev",
        mode: "read-only-foundation",
        databases: {
          portal: { connected: true, users: Number(checks[0]?.total || 0) },
          snack: { connected: true, users: Number(checks[1]?.total || 0) },
          polis: { connected: true, users: Number(checks[2]?.total || 0) }
        },
        note: "Health check only. No cross-database writes or production routing."
      });
    } catch {
      return json({ ok: false, error: "database_check_failed" }, 503);
    }
  }
};
