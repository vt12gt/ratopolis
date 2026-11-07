const VERSION = "v39.2-progression-reward-dev";
const ENVIRONMENT = "development";
const SESSION_DAYS = 7;
const PBKDF2_ITERATIONS = 100000;
const TERMS_VERSION = "2026-11-06";
const PRIVACY_VERSION = "2026-11-06";
const SPADMIN_EMAIL = "juniorgmj666@gmail.com";
const ROLES = ["spadm", "adm", "gm", "mod", "editor", "divulgador", "locutor", "player"];
const ROLE_RANK = { spadm: 5, adm: 4, gm: 3, mod: 2, editor: 1.5, divulgador: 1.25, locutor: 1.1, player: 1 };
const ALLOWED_ORIGINS = new Set([
  "http://localhost:8158",
  "https://ratopolis-cadastro-teste.pages.dev",
  "https://vt12gt.github.io"
]);

export default {
  async fetch(request, env) {
    let etapaAtual = "inicio";
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method.toUpperCase();
    const origin = request.headers.get("Origin") || "";
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Vary": "Origin"
    };
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Credentials"] = "true";
      headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
      headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Bootstrap-Secret";
      headers["Access-Control-Max-Age"] = "86400";
    }
    const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });

    try {
      if (origin && !ALLOWED_ORIGINS.has(origin)) return reply({ ok: false, erro: "Origem nao autorizada." }, 403);
      if (method === "OPTIONS") return new Response(null, { status: 204, headers });
      if (!env.DB) return reply({ ok: false, erro: "Vinculo D1 DB nao configurado." }, 500);

      if (path === "/" && method === "GET") return reply({ ok: true, projeto: "Ratopolis API", versao: VERSION, ambiente: ENVIRONMENT });
      if (path === "/health" && method === "GET") return reply({ ok: true, projeto: "Ratopolis", versao: VERSION, ambiente: ENVIRONMENT });

      // Registros de IP: consulta exclusiva do SpAdmin, com auditoria da visualizacao.
      if (path === "/api/admin/privacy/access-logs" && method === "GET") {
        etapaAtual = "consulta restrita dos registros de acesso";
        const actor = await authenticate(request, env);
        if (!actor) return reply({ ok: false, erro: "Autenticacao necessaria ou sessao invalida." }, 401);
        if (actor.role !== "spadm") return reply({ ok: false, erro: "Acesso restrito ao SpAdmin." }, 403);
        const pageInput = Number.parseInt(url.searchParams.get("page") || "1", 10);
        const limitInput = Number.parseInt(url.searchParams.get("limit") || "50", 10);
        const page = Number.isFinite(pageInput) ? Math.max(1, Math.min(pageInput, 100000)) : 1;
        const limit = Number.isFinite(limitInput) ? Math.max(1, Math.min(limitInput, 100)) : 50;
        const offset = (page - 1) * limit;
        const totalRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM ratopolis_access_logs").first();
        const logs = await env.DB.prepare("SELECT l.id, l.user_id, u.nickname, l.event_type, l.ip_address, l.user_agent, l.created_at, l.expires_at FROM ratopolis_access_logs l LEFT JOIN ratopolis_users u ON u.id = l.user_id ORDER BY l.created_at DESC LIMIT ? OFFSET ?").bind(limit, offset).all();
        const at = new Date().toISOString();
        await env.DB.prepare("INSERT INTO ratopolis_audit_logs (id, actor_user_id, action, target_user_id, details, created_at) VALUES (?, ?, 'privacy_access_logs_viewed', NULL, ?, ?)").bind(crypto.randomUUID(), actor.id, JSON.stringify({ page, limit }), at).run();
        return reply({ ok: true, pagina: page, limite: limit, total: Number(totalRow?.total || 0), registros: logs.results });
      }

      if (path === "/db-check" && method === "GET") {
        etapaAtual = "verificacao do banco";
        const result = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
        const tabelas = result.results.map(item => item.name);
        const esperadas = ["ratopolis_users", "ratopolis_profiles", "ratopolis_credentials", "ratopolis_sessions", "ratopolis_audit_logs", "ratopolis_reward_events", "ratopolis_scenarios", "ratopolis_scenario_versions", "ratopolis_scenario_staff", "ratopolis_scenario_reviews"];
        const contagens = {};
        for (const tabela of esperadas) {
          if (tabelas.includes(tabela)) {
            const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM "${tabela}"`).first();
            contagens[tabela] = count.total;
          }
        }
        return reply({ ok: true, versao: VERSION, tabelas, tabelas_esperadas: esperadas, tabelas_ausentes: esperadas.filter(nome => !tabelas.includes(nome)), contagens });
      }

      // Ranking geral e ranking por nivel/XP — mantem formato estavel.
      if ((path === "/api/rankings" || path === "/api/rankings/level") && method === "GET") {
        etapaAtual = "consulta dos rankings";
        const pageInput = Number.parseInt(url.searchParams.get("page") || "1", 10);
        const limitInput = Number.parseInt(url.searchParams.get("limit") || "20", 10);
        const page = Number.isFinite(pageInput) ? Math.max(1, Math.min(pageInput, 100000)) : 1;
        const limit = Number.isFinite(limitInput) ? Math.max(1, Math.min(limitInput, 100)) : 20;
        const offset = (page - 1) * limit;
        const rankingPorNivel = path === "/api/rankings/level";
        const orderBy = rankingPorNivel
          ? "p.level DESC, p.xp DESC, u.nickname COLLATE NOCASE ASC"
          : "p.xp DESC, p.level DESC, u.nickname COLLATE NOCASE ASC";
        const totalResult = await env.DB.prepare(`SELECT COUNT(*) AS total FROM ratopolis_users u INNER JOIN ratopolis_profiles p ON p.user_id = u.id WHERE u.status = 'active'`).first();
        const total = totalResult?.total ?? 0;
        const result = await env.DB.prepare(`SELECT u.id, u.nickname, p.level, p.xp FROM ratopolis_users u INNER JOIN ratopolis_profiles p ON p.user_id = u.id WHERE u.status = 'active' ORDER BY ${orderBy} LIMIT ? OFFSET ?`).bind(limit, offset).all();
        const jogadores = result.results.map((jogador, index) => ({ posicao: offset + index + 1, id: jogador.id, nickname: jogador.nickname, level: jogador.level, xp: jogador.xp }));
        return reply({ ok: true, ranking: rankingPorNivel ? "nivel" : "geral", pagina: page, limite: limit, total, total_paginas: Math.ceil(total / limit), jogadores });
      }

      // Progresso da conta autenticada. XP e moedas nunca sao alterados por esta rota.
      if (path === "/api/progression/me" && method === "GET") {
        etapaAtual = "consulta da progressao";
        const actor = await authenticate(request, env);
        if (!actor) return reply({ ok: false, erro: "Autenticacao necessaria ou sessao invalida." }, 401);
        const profile = await env.DB.prepare("SELECT level, xp, vip_level, coins FROM ratopolis_profiles WHERE user_id = ?").bind(actor.id).first();
        if (!profile) return reply({ ok: false, erro: "Perfil nao encontrado." }, 404);
        const level = Math.max(1, Math.min(50, Number(profile.level) || 1));
        const xp = Math.max(0, Number(profile.xp) || 0);
        const nextLevelXp = level >= 50 ? null : level * 100;
        return reply({ ok: true, progresso: { level, xp, vip_level: profile.vip_level, coins: profile.coins, max_level: 50, xp_proximo_nivel: nextLevelXp, xp_restante: nextLevelXp === null ? 0 : Math.max(0, nextLevelXp - xp) } });
      }

      // Recompensa de fase autenticada: valores calculados no servidor, limite de 10 eventos/dia UTC.
      if (path === "/api/progression/reward" && method === "POST") {
        etapaAtual = "recompensa de fase autenticada";
        const actor = await authenticate(request, env);
        if (!actor) return reply({ ok: false, erro: "Entre na sua conta para salvar o progresso." }, 401);
        let body;
        try { body = await readJson(request); } catch { return reply({ ok: false, erro: "JSON invalido." }, 400); }
        const eventId = typeof body.event_id === "string" ? body.event_id.trim() : "";
        const phase = body.phase, cheeses = body.cheeses, acorns = body.acorns, lives = body.lives;
        if (!eventId || eventId.length > 128 || !/^[a-zA-Z0-9._:-]+$/.test(eventId)) return reply({ ok: false, erro: "event_id invalido." }, 400);
        if (!Number.isSafeInteger(phase) || phase < 1 || phase > 12 ||
            !Number.isSafeInteger(cheeses) || cheeses < 0 || cheeses > 4 ||
            !Number.isSafeInteger(acorns) || acorns < 0 || acorns > 12 ||
            !Number.isSafeInteger(lives) || lives < 0 || lives > 3) {
          return reply({ ok: false, erro: "Dados da fase fora dos limites permitidos." }, 400);
        }
        const existing = await env.DB.prepare("SELECT event_id, user_id, event_type FROM ratopolis_reward_events WHERE event_id = ? LIMIT 1").bind(eventId).first();
        if (existing) {
          if (existing.user_id !== actor.id || existing.event_type !== "phase_complete") return reply({ ok: false, erro: "event_id ja utilizado." }, 409);
          const p = await env.DB.prepare("SELECT level, xp, vip_level, coins FROM ratopolis_profiles WHERE user_id = ?").bind(actor.id).first();
          return reply({ ok: true, duplicado: true, progresso: p });
        }
        const dayStart = new Date();
        dayStart.setUTCHours(0, 0, 0, 0);
        const daily = await env.DB.prepare("SELECT COUNT(*) AS total FROM ratopolis_reward_events WHERE user_id = ? AND event_type = 'phase_complete' AND created_at >= ?").bind(actor.id, dayStart.toISOString()).first();
        if (Number(daily?.total || 0) >= 10) return reply({ ok: false, erro: "Limite diario de recompensas de fase atingido. Tente novamente amanha." }, 429);
        const xpAwarded = 22 + cheeses * 5 + acorns * 8 + lives * 3;
        const coinsAwarded = 10 + cheeses * 2 + acorns * 3 + lives * 2;
        const createdAt = new Date().toISOString();
        try {
          await env.DB.batch([
            env.DB.prepare("INSERT INTO ratopolis_reward_events (event_id, user_id, event_type, xp_awarded, coins_awarded, created_at) VALUES (?, ?, 'phase_complete', ?, ?, ?)").bind(eventId, actor.id, xpAwarded, coinsAwarded, createdAt),
            env.DB.prepare("UPDATE ratopolis_profiles SET xp = xp + ?, coins = coins + ?, level = MAX(level, MIN(50, CAST((xp + ?) / 100 AS INTEGER) + 1)) WHERE user_id = ?").bind(xpAwarded, coinsAwarded, xpAwarded, actor.id),
            env.DB.prepare("INSERT INTO ratopolis_audit_logs (id, actor_user_id, action, target_user_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), actor.id, "game_phase_reward", actor.id, JSON.stringify({event_id:eventId, phase, cheeses, acorns, lives, xp_awarded:xpAwarded, coins_awarded:coinsAwarded}), createdAt)
          ]);
        } catch (e) {
          const raced = await env.DB.prepare("SELECT event_id FROM ratopolis_reward_events WHERE event_id = ? LIMIT 1").bind(eventId).first();
          if (raced) return reply({ ok: false, erro: "Recompensa ja processada ou evento duplicado." }, 409);
          throw e;
        }
        const p = await env.DB.prepare("SELECT level, xp, vip_level, coins FROM ratopolis_profiles WHERE user_id = ?").bind(actor.id).first();
        return reply({ ok: true, duplicado: false, recompensa: { xp: xpAwarded, coins: coinsAwarded }, progresso: p }, 201);
      }

      // Bonus de competicao validado pelo servidor de salas; nunca aceitar chamada direta do navegador.
      if (path === "/api/internal/competition/reward" && method === "POST") {
        etapaAtual = "bonus de competicao online";
        if (!env.COMPETITION_SECRET) return reply({ ok: false, erro: "Secret de competicao nao configurado." }, 503);
        const supplied = request.headers.get("X-Competition-Secret") || "";
        if (!constantTimeEqual(supplied, env.COMPETITION_SECRET)) return reply({ ok: false, erro: "Autorizacao de competicao invalida." }, 403);
        let body; try { body = await readJson(request); } catch { return reply({ ok: false, erro: "JSON invalido." }, 400); }
        const eventId = typeof body.event_id === "string" ? body.event_id.trim() : "";
        const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
        const room = typeof body.room === "string" ? body.room.trim().toUpperCase() : "";
        const phase = Number(body.phase), rank = Number(body.rank);
        if (!/^[A-Z0-9]{6}$/.test(room) || phase !== 12 || !Number.isInteger(rank) || rank < 1 || rank > 3 ||
            !userId || userId.length > 128 || !/^[a-zA-Z0-9._:-]{1,128}$/.test(eventId)) {
          return reply({ ok: false, erro: "Dados de classificacao invalidos." }, 400);
        }
        const existing = await env.DB.prepare("SELECT event_id, user_id, event_type FROM ratopolis_reward_events WHERE event_id = ? LIMIT 1").bind(eventId).first();
        if (existing) {
          if (existing.user_id !== userId || existing.event_type !== "competition_bonus") return reply({ ok: false, erro: "Evento de bonus ja utilizado." }, 409);
          const p = await env.DB.prepare("SELECT level, xp, vip_level, coins FROM ratopolis_profiles WHERE user_id = ?").bind(userId).first();
          return reply({ ok: true, duplicado: true, rank, progresso: p });
        }
        const profile = await env.DB.prepare("SELECT level, xp, vip_level, coins FROM ratopolis_profiles WHERE user_id = ? LIMIT 1").bind(userId).first();
        if (!profile) return reply({ ok: false, erro: "Perfil nao encontrado." }, 404);
        const xpAwarded = rank === 1 ? 150 : rank === 2 ? 100 : 60;
        const coinsAwarded = rank === 1 ? 100 : rank === 2 ? 60 : 30;
        const createdAt = new Date().toISOString();
        try {
          await env.DB.batch([
            env.DB.prepare("INSERT INTO ratopolis_reward_events (event_id, user_id, event_type, xp_awarded, coins_awarded, created_at) VALUES (?, ?, 'competition_bonus', ?, ?, ?)").bind(eventId, userId, xpAwarded, coinsAwarded, createdAt),
            env.DB.prepare("UPDATE ratopolis_profiles SET xp = xp + ?, coins = coins + ?, level = MAX(level, MIN(50, CAST((xp + ?) / 100 AS INTEGER) + 1)) WHERE user_id = ?").bind(xpAwarded, coinsAwarded, xpAwarded, userId),
            env.DB.prepare("INSERT INTO ratopolis_audit_logs (id, actor_user_id, action, target_user_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), userId, "online_competition_bonus", userId, JSON.stringify({event_id:eventId, room, phase, rank, xp_awarded:xpAwarded, coins_awarded:coinsAwarded}), createdAt)
          ]);
        } catch (e) {
          const raced = await env.DB.prepare("SELECT event_id FROM ratopolis_reward_events WHERE event_id = ? LIMIT 1").bind(eventId).first();
          if (raced) return reply({ ok: false, erro: "Bonus ja processado." }, 409);
          throw e;
        }
        const p = await env.DB.prepare("SELECT level, xp, vip_level, coins FROM ratopolis_profiles WHERE user_id = ?").bind(userId).first();
        return reply({ ok: true, duplicado: false, rank, recompensa: { xp: xpAwarded, coins: coinsAwarded }, progresso: p }, 201);
      }

      // Concessao interna de recompensas. Nunca chamar diretamente do navegador/jogo.
      // Requer DOIS secrets configurados no Worker e um event_id unico por recompensa.
      if (path === "/api/internal/rewards/grant" && method === "POST") {
        etapaAtual = "validacao da recompensa interna";
        if (!env.REWARD_SECRET || !env.PROGRESSION_SECRET) {
          return reply({ ok: false, erro: "Secrets internos de recompensa/progressao nao configurados." }, 503);
        }
        const rewardSecret = request.headers.get("X-Reward-Secret") || "";
        const progressionSecret = request.headers.get("X-Progression-Secret") || "";
        if (!constantTimeEqual(rewardSecret, env.REWARD_SECRET) || !constantTimeEqual(progressionSecret, env.PROGRESSION_SECRET)) {
          return reply({ ok: false, erro: "Autorizacao interna invalida." }, 403);
        }
        const body = await readJson(request);
        const eventId = typeof body.event_id === "string" ? body.event_id.trim() : "";
        const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
        const eventType = typeof body.event_type === "string" ? body.event_type.trim() : "";
        const xpAwarded = body.xp_awarded;
        const coinsAwarded = body.coins_awarded;
        if (!eventId || eventId.length > 128 || !userId || userId.length > 128 || !eventType || eventType.length > 64) {
          return reply({ ok: false, erro: "event_id, user_id e event_type sao obrigatorios e devem ter tamanho valido." }, 400);
        }
        if (!Number.isSafeInteger(xpAwarded) || xpAwarded < 0 || xpAwarded > 10000 || !Number.isSafeInteger(coinsAwarded) || coinsAwarded < 0 || coinsAwarded > 10000 || (xpAwarded === 0 && coinsAwarded === 0)) {
          return reply({ ok: false, erro: "Valores de XP/moedas invalidos (0 a 10000; pelo menos um deve ser maior que zero)." }, 400);
        }
        const user = await env.DB.prepare("SELECT id FROM ratopolis_users WHERE id = ? AND status = 'active' LIMIT 1").bind(userId).first();
        if (!user) return reply({ ok: false, erro: "Jogador ativo nao encontrado." }, 404);
        const profile = await env.DB.prepare("SELECT level, xp, coins FROM ratopolis_profiles WHERE user_id = ? LIMIT 1").bind(userId).first();
        if (!profile) return reply({ ok: false, erro: "Perfil do jogador nao encontrado." }, 404);
        const existing = await env.DB.prepare("SELECT event_id, user_id, event_type, xp_awarded, coins_awarded FROM ratopolis_reward_events WHERE event_id = ? LIMIT 1").bind(eventId).first();
        if (existing) {
          const same = existing.user_id === userId && existing.event_type === eventType && Number(existing.xp_awarded) === xpAwarded && Number(existing.coins_awarded) === coinsAwarded;
          if (!same) return reply({ ok: false, erro: "event_id ja utilizado com dados diferentes." }, 409);
          return reply({ ok: true, duplicado: true, mensagem: "Esta recompensa ja foi processada.", event_id: eventId, level: profile.level, xp: profile.xp, coins: profile.coins });
        }
        const createdAt = new Date().toISOString();
        try {
          // D1 batch e transacional: se o event_id colidir, o UPDATE tambem e revertido.
          await env.DB.batch([
            env.DB.prepare("INSERT INTO ratopolis_reward_events (event_id, user_id, event_type, xp_awarded, coins_awarded, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(eventId, userId, eventType, xpAwarded, coinsAwarded, createdAt),
            env.DB.prepare("UPDATE ratopolis_profiles SET xp = xp + ?, coins = coins + ?, level = MAX(level, MIN(50, CAST((xp + ?) / 100 AS INTEGER) + 1)) WHERE user_id = ?").bind(xpAwarded, coinsAwarded, xpAwarded, userId),
            env.DB.prepare("INSERT INTO ratopolis_audit_logs (id, actor_user_id, action, target_user_id, details, created_at) VALUES (?, NULL, ?, ?, ?, ?)").bind(crypto.randomUUID(), "reward_granted", userId, JSON.stringify({ event_id: eventId, event_type: eventType, xp_awarded: xpAwarded, coins_awarded: coinsAwarded }), createdAt)
          ]);
        } catch (writeError) {
          // Trata concorrencia: se outra requisicao processou o mesmo event_id, nunca paga duas vezes.
          const afterRace = await env.DB.prepare("SELECT event_id, user_id, event_type, xp_awarded, coins_awarded FROM ratopolis_reward_events WHERE event_id = ? LIMIT 1").bind(eventId).first();
          if (afterRace) {
            const same = afterRace.user_id === userId && afterRace.event_type === eventType && Number(afterRace.xp_awarded) === xpAwarded && Number(afterRace.coins_awarded) === coinsAwarded;
            if (!same) return reply({ ok: false, erro: "event_id ja utilizado com dados diferentes." }, 409);
            const fresh = await env.DB.prepare("SELECT level, xp, coins FROM ratopolis_profiles WHERE user_id = ?").bind(userId).first();
            return reply({ ok: true, duplicado: true, mensagem: "Esta recompensa ja foi processada.", event_id: eventId, level: fresh?.level ?? 1, xp: fresh?.xp ?? 0, coins: fresh?.coins ?? 0 });
          }
          throw writeError;
        }
        const updated = await env.DB.prepare("SELECT level, xp, coins FROM ratopolis_profiles WHERE user_id = ?").bind(userId).first();
        return reply({ ok: true, duplicado: false, mensagem: "Recompensa registrada.", event_id: eventId, jogador: { id: userId, level: updated?.level ?? 1, xp: updated?.xp ?? 0, coins: updated?.coins ?? 0 } }, 201);
      }

      if (path === "/api/players" && method === "GET") {
        etapaAtual = "busca dos jogadores";
        const result = await env.DB.prepare(`SELECT u.id, u.nickname, u.role, p.level, p.xp, p.vip_level, p.coins FROM ratopolis_users u LEFT JOIN ratopolis_profiles p ON p.user_id = u.id WHERE u.status = 'active' ORDER BY u.created_at DESC LIMIT 100`).all();
        return reply({ ok: true, jogadores: result.results });
      }

      if (path === "/api/register" && method === "POST") {
        etapaAtual = "leitura do cadastro";
        const body = await readJson(request);
        const nickname = normalizeNickname(body.nickname);
        const email = normalizeEmail(body.email);
        const password = body.password;
        const ageCategory = body.age_category;
        const termsVersion = body.terms_version;
        const privacyVersion = body.privacy_version;
        if (!nickname || nickname.length < 3 || nickname.length > 20 || !/^[a-zA-Z0-9_]+$/.test(nickname)) return reply({ ok: false, erro: "Nickname deve ter de 3 a 20 caracteres, usando letras, numeros ou underline." }, 400);
        if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ ok: false, erro: "Informe um e-mail valido." }, 400);
        if (typeof password !== "string" || password.length < 8 || password.length > 128) return reply({ ok: false, erro: "A senha deve ter entre 8 e 128 caracteres." }, 400);
        if (!["minor", "adult"].includes(ageCategory)) return reply({ ok: false, erro: "Informe se voce e menor ou maior de 18 anos." }, 400);
        if (body.terms_accepted !== true || body.privacy_accepted !== true || body.adult_presence_ack !== true) return reply({ ok: false, erro: "Leia e aceite os Termos, a Politica de Privacidade e o aviso sobre jogadores de diferentes idades." }, 400);
        if (termsVersion !== TERMS_VERSION || privacyVersion !== PRIVACY_VERSION) return reply({ ok: false, erro: "Os documentos foram atualizados. Recarregue a pagina e leia as versoes atuais." }, 409);
        etapaAtual = "verificacao de cadastro existente";
        const existing = await env.DB.prepare("SELECT id FROM ratopolis_users WHERE lower(nickname) = lower(?) OR lower(email) = lower(?) LIMIT 1").bind(nickname, email).first();
        if (existing) return reply({ ok: false, erro: "Nickname ou e-mail ja cadastrado." }, 409);
        etapaAtual = "ger --- TRUNCATED --- 106,470 chars