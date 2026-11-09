const ALLOWED_ORIGINS = new Set(["https://vt12gt.github.io", "https://ratopolis-cadastro-teste.pages.dev"]);
function makeHeaders(origin) {
  const h = {"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","vary":"Origin"};
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    h["access-control-allow-origin"] = origin;
    h["access-control-allow-headers"] = "Authorization, Content-Type";
    h["access-control-allow-methods"] = "GET, OPTIONS";
    h["access-control-max-age"] = "86400";
  }
  return h;
}
const json = (data, status = 200, origin = "") => new Response(JSON.stringify(data), {status, headers:makeHeaders(origin)});
const bearer = request => {
  const m = (request.headers.get("Authorization") || "").match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : "";
};
async function sha256(value) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  let binary = "";
  for (const b of new Uint8Array(d)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function authenticatePortal(request, env) {
  const token = bearer(request);
  if (!token || token.length < 20) return null;
  return env.PORTAL_DB.prepare("SELECT u.id,u.nickname,u.role,u.status FROM ratopolis_sessions s JOIN ratopolis_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status='active' LIMIT 1")
    .bind(await sha256(token), new Date().toISOString()).first();
}
async function authenticateAdmin(request, env) {
  const actor = await authenticatePortal(request, env);
  return actor && ["spadm", "adm"].includes(actor.role) ? actor : null;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ok:false,error:"origin_not_allowed"},403,origin);
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers:makeHeaders(origin)});
    if (request.method === "GET" && ["/health","/api/core/health"].includes(url.pathname)) {
      try {
        const [portal,snack,polis] = await Promise.all([
          env.PORTAL_DB.prepare("SELECT COUNT(*) AS total FROM ratopolis_users").first(),
          env.SNACK_DB.prepare("SELECT COUNT(*) AS total FROM game_users").first(),
          env.POLIS_DB.prepare("SELECT COUNT(*) AS total FROM game_users").first()
        ]);
        return json({ok:true,service:"rativa-core-dev",mode:"central-portal-identity-dev",databases:{
          portal:{connected:true,users:Number(portal?.total||0)},
          snack:{connected:true,users:Number(snack?.total||0)},
          polis:{connected:true,users:Number(polis?.total||0)}
        }},200,origin);
      } catch { return json({ok:false,error:"database_check_failed"},503,origin); }
    }
    if (request.method === "GET" && url.pathname === "/api/core/me") {
      const actor = await authenticatePortal(request,env);
      if (!actor) return json({ok:false,error:"portal_authentication_required"},401,origin);
      try {
        const [snack,polis] = await Promise.all([
          env.SNACK_DB.prepare("SELECT public_id FROM game_users WHERE portal_user_id=? AND status='active' LIMIT 1").bind(actor.id).first(),
          env.POLIS_DB.prepare("SELECT public_id FROM game_users WHERE portal_user_id=? AND status='active' LIMIT 1").bind(actor.id).first()
        ]);
        return json({ok:true,identity:{portal_user_id:actor.id,nickname:actor.nickname,role:actor.role,status:actor.status},
          games:{rativasnack:{public_id:snack?.public_id||null},rativapolis:{public_id:polis?.public_id||null}}},200,origin);
      } catch {
        return json({ok:false,error:"game_identity_link_not_ready",message:"As migrações e os vínculos de identidade dos jogos ainda não foram aplicados."},503,origin);
      }
    }
    if (request.method === "GET" && url.pathname === "/api/core/admin/search") {
      const actor = await authenticateAdmin(request,env);
      if (!actor) return json({ok:false,error:"admin_authentication_required"},401,origin);
      const q = (url.searchParams.get("q") || "").trim().slice(0,64);
      if (q.length < 2) return json({ok:false,error:"query_too_short"},400,origin);
      const pattern = "%" + q + "%";
      try {
        const [portal,snack,polis] = await Promise.all([
          env.PORTAL_DB.prepare("SELECT id AS internal_id,nickname,role,status,created_at FROM ratopolis_users WHERE nickname LIKE ? OR id LIKE ? ORDER BY nickname LIMIT 20").bind(pattern,pattern).all(),
          env.SNACK_DB.prepare("SELECT id AS internal_id,public_id,nickname,status,created_at FROM game_users WHERE nickname LIKE ? OR public_id LIKE ? OR id LIKE ? ORDER BY nickname LIMIT 20").bind(pattern,pattern,pattern).all(),
          env.POLIS_DB.prepare("SELECT id AS internal_id,public_id,nickname,status,created_at FROM game_users WHERE nickname LIKE ? OR public_id LIKE ? OR id LIKE ? ORDER BY nickname LIMIT 20").bind(pattern,pattern,pattern).all()
        ]);
        await env.PORTAL_DB.prepare("INSERT INTO ratopolis_audit_logs (id,actor_user_id,action,target_user_id,details,created_at) VALUES (?, ?, ?, NULL, ?, ?)")
          .bind(crypto.randomUUID(),actor.id,"rativa_core_player_search",JSON.stringify({query:q,counts:{portal:portal.results.length,snack:snack.results.length,polis:polis.results.length}}),new Date().toISOString()).run();
        return json({ok:true,query:q,results:{
          portal:portal.results.map(x=>({...x,game:"portal"})),
          snack:snack.results.map(x=>({...x,game:"rativasnack"})),
          polis:polis.results.map(x=>({...x,game:"rativapolis"}))
        }},200,origin);
      } catch { return json({ok:false,error:"search_failed"},503,origin); }
    }
    return json({ok:false,error:"not_found"},404,origin);
  }
};
