const VERSION = "v39.2-progression-reward-dev";
const ENVIRONMENT = "development";
const SESSION_DAYS = 7;
const PBKDF2_ITERATIONS = 100000;
const SPADMIN_EMAIL = "juniorgmj666@gmail.com";
const ROLES = ["spadm", "adm", "gm", "mod", "editor", "divulgador", "player"];
const ROLE_RANK = { spadm: 5, adm: 4, gm: 3, mod: 2, editor: 1.5, divulgador: 1.25, player: 1 };
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
        if (!nickname || nickname.length < 3 || nickname.length > 20 || !/^[a-zA-Z0-9_]+$/.test(nickname)) return reply({ ok: false, erro: "Nickname deve ter de 3 a 20 caracteres, usando letras, numeros ou underline." }, 400);
        if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ ok: false, erro: "Informe um e-mail valido." }, 400);
        if (typeof password !== "string" || password.length < 8 || password.length > 128) return reply({ ok: false, erro: "A senha deve ter entre 8 e 128 caracteres." }, 400);
        etapaAtual = "verificacao de cadastro existente";
        const existing = await env.DB.prepare("SELECT id FROM ratopolis_users WHERE lower(nickname) = lower(?) OR lower(email) = lower(?) LIMIT 1").bind(nickname, email).first();
        if (existing) return reply({ ok: false, erro: "Nickname ou e-mail ja cadastrado." }, 409);
        etapaAtual = "geracao das credenciais";
        const userId = crypto.randomUUID();
        const sessionId = crypto.randomUUID();
        const now = new Date();
        const createdAt = now.toISOString();
        const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86400000).toISOString();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const saltEncoded = toBase64url(salt);
        const passwordHashValue = await passwordHash(password, salt);
        const token = toBase64url(crypto.getRandomValues(new Uint8Array(32)));
        const tokenHash = await sha256(token);
        etapaAtual = "gravacao do cadastro no D1";
        await env.DB.batch([
          env.DB.prepare("INSERT INTO ratopolis_users (id, nickname, email, role, status, created_at) VALUES (?, ?, ?, 'player', 'active', ?)").bind(userId, nickname, email, createdAt),
          env.DB.prepare("INSERT INTO ratopolis_profiles (user_id, level, xp, vip_level, coins) VALUES (?, 1, 0, 0, 0)").bind(userId),
          env.DB.prepare("INSERT INTO ratopolis_credentials (user_id, password_hash, password_salt) VALUES (?, ?, ?)").bind(userId, passwordHashValue, saltEncoded),
          env.DB.prepare("INSERT INTO ratopolis_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)").bind(sessionId, userId, tokenHash, expiresAt),
          env.DB.prepare("INSERT INTO ratopolis_audit_logs (id, actor_user_id, action, target_user_id, details, created_at) VALUES (?, NULL, ?, ?, ?, ?)").bind(crypto.randomUUID(), "register", userId, JSON.stringify({ nickname }), createdAt)
        ]);
        return reply({ ok: true, mensagem: "Cadastro realizado com sucesso.", jogador: { id: userId, nickname, email, role: "player", status: "active", level: 1, xp: 0, vip_level: 0, coins: 0 }, token, expires_at: expiresAt }, 201);
      }

      if (path === "/api/login" && method === "POST") {
        etapaAtual = "leitura do login";
        const body = await readJson(request);
        const identifier = normalizeIdentifier(body.identifier);
        const password = body.password;
        if (!identifier || identifier.length > 254 || typeof password !== "string" || password.length === 0 || password.length > 128) return reply({ ok: false, erro: "Nickname, email ou senha incorretos." }, 401);
        etapaAtual = "busca da conta para login";
        const user = await env.DB.prepare("SELECT u.id, u.nickname, u.email, u.role, u.status, c.password_hash, c.password_salt FROM ratopolis_users u JOIN ratopolis_credentials c ON c.user_id = u.id WHERE lower(u.nickname) = lower(?) OR lower(u.email) = lower(?) LIMIT 1").bind(identifier, identifier).first();
        if (!user || user.status !== "active") return reply({ ok: false, erro: "Nickname, email ou senha incorretos." }, 401);
        if (typeof user.password_salt !== "string" || typeof user.password_hash !== "string") return reply({ ok: false, erro: "Credenciais da conta invalidas." }, 500);
        etapaAtual = "verificacao da senha";
        const hash = await passwordHash(password, fromBase64url(user.password_salt));
        if (!constantTimeEqual(hash, user.password_hash)) return reply({ ok: false, erro: "Nickname, email ou senha incorretos." }, 401);
        etapaAtual = "criacao da sessao";
        const sessionId = crypto.randomUUID();
        const token = toBase64url(crypto.getRandomValues(new Uint8Array(32)));
        const tokenHash = await sha256(token);
        const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
        const createdAt = new Date().toISOString();
        await env.DB.batch([
          env.DB.prepare("INSERT INTO ratopolis_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)").bind(sessionId, user.id, tokenHash, expiresAt),
          env.DB.prepare("INSERT INTO ratopolis_audit_logs (id, actor_user_id, action, target_user_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), user.id, "login", user.id, "{}", createdAt)
        ]);
        const profile = await env.DB.prepare("SELECT level, xp, vip_level, coins FROM ratopolis_profiles WHERE user_id = ?").bind(user.id).first();
        return reply({ ok: true, mensagem: "Login realizado com sucesso.", jogador: { id: user.id, nickname: user.nickname, email: user.email, role: user.role, status: user.status, level: profile?.level ?? 1, xp: profile?.xp ?? 0, vip_level: profile?.vip_level ?? 0, coins: profile?.coins ?? 0 }, token, expires_at: expiresAt });
      }


      // Ratopolis paid VIP store. The paid subscription is separate from profile.vip_level.
      if (path === "/api/store/webhook/mercadopago" && method === "POST") {
        etapaAtual = "webhook Mercado Pago";
        if (!env.MP_ACCESS_TOKEN) return reply({ ok: false, erro: "Pagamento nao configurado." }, 503);
        let notice;
        try { notice = await request.json(); } catch { return reply({ ok: false, erro: "Notificacao invalida." }, 400); }
        const paymentId = String(notice?.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id") || "").trim();
        if (!paymentId || !/^[0-9]{1,30}$/.test(paymentId)) return reply({ ok: true, ignorado: true });
        const paymentResponse = await fetch("https://api.mercadopago.com/v1/payments/" + encodeURIComponent(paymentId), {
          headers: { Authorization: "Bearer " + env.MP_ACCESS_TOKEN, Accept: "application/json" }
        });
        if (!paymentResponse.ok) return reply({ ok: false, erro: "Nao foi possivel confirmar o pagamento." }, 502);
        const payment = await paymentResponse.json();
        if (payment.status !== "approved") return reply({ ok: true, status: payment.status || "pending" });
        const orderId = String(payment.external_reference || "");
        if (!orderId) return reply({ ok: true, ignorado: true });
        const order = await env.DB.prepare("SELECT id, user_id, amount_cents, currency, status FROM ratopolis_store_orders WHERE id = ? AND provider = 'mercadopago'").bind(orderId).first();
        if (!order) return reply({ ok: true, ignorado: true });
        if (Number(payment.transaction_amount) !== 4.99 || payment.currency_id !== "BRL" ||
            Number(order.amount_cents) !== 499 || order.currency !== "BRL" ||
            (payment.external_reference && payment.external_reference !== order.id)) {
          return reply({ ok: false, erro: "Pagamento nao corresponde ao pedido." }, 409);
        }
        if (order.status === "approved") return reply({ ok: true, processado: true });
        if (order.status !== "pending") return reply({ ok: true, ignorado: true });
        const marker = new Date().toISOString() + "#" + crypto.randomUUID();
        await env.DB.batch([
          env.DB.prepare("UPDATE ratopolis_store_orders SET status = 'approved', provider_payment_id = ?, paid_at = ?, updated_at = ? WHERE id = ? AND status = 'pending' AND (provider_payment_id IS NULL OR provider_payment_id = ?)").bind(String(payment.id), marker, new Date().toISOString(), order.id, String(payment.id)),
          env.DB.prepare("INSERT INTO ratopolis_paid_vip (user_id, expires_at, last_order_id, updated_at) SELECT o.user_id, strftime('%Y-%m-%dT%H:%M:%fZ', max(julianday(COALESCE(v.expires_at, ?)), julianday(?)) + 30), o.id, ? FROM ratopolis_store_orders o LEFT JOIN ratopolis_paid_vip v ON v.user_id = o.user_id WHERE o.id = ? AND o.status = 'approved' AND o.paid_at = ? ON CONFLICT(user_id) DO UPDATE SET expires_at = excluded.expires_at, last_order_id = excluded.last_order_id, updated_at = excluded.updated_at").bind(new Date().toISOString(), new Date().toISOString(), new Date().toISOString(), order.id, marker)
        ]);
        return reply({ ok: true, processado: true });
      }

      if (path === "/api/store/checkout" && method === "POST") {
        etapaAtual = "checkout loja";
        const buyer = await authenticate(request, env);
        if (!buyer) return reply({ ok: false, erro: "Entre na sua conta para comprar VIP." }, 401);
        if (!env.MP_ACCESS_TOKEN) return reply({ ok: false, erro: "Pagamento nao configurado." }, 503);
        let body;
        try { body = await request.json(); } catch { return reply({ ok: false, erro: "Pedido invalido." }, 400); }
        if (body?.productCode !== "vip_30_days") return reply({ ok: false, erro: "Produto invalido." }, 400);
        const orderId = crypto.randomUUID();
        const idem = crypto.randomUUID();
        const nowIso = new Date().toISOString();
        await env.DB.prepare("INSERT INTO ratopolis_store_orders (id,user_id,product_code,amount_cents,currency,status,provider,idempotency_key,created_at,updated_at) VALUES (?,?,?,499,'BRL','pending','mercadopago',?,?,?)")
          .bind(orderId, buyer.id, "vip_30_days", idem, nowIso, nowIso).run();
        const prefBody = {
          items: [{ id: "ratopolis-vip-30d", title: "Ratopolis VIP - 30 dias", description: "Assinatura VIP por 30 dias", quantity: 1, currency_id: "BRL", unit_price: 4.99 }],
          external_reference: orderId,
          notification_url: new URL("/api/store/webhook/mercadopago", url.origin).toString(),
          back_urls: {
            success: "https://vt12gt.github.io/ratopolis/",
            pending: "https://vt12gt.github.io/ratopolis/",
            failure: "https://vt12gt.github.io/ratopolis/"
          },
          auto_return: "approved",
          statement_descriptor: "RATOPOLIS VIP"
        };
        const prefResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
          method: "POST",
          headers: { Authorization: "Bearer " + env.MP_ACCESS_TOKEN, "Content-Type": "application/json", "X-Idempotency-Key": idem },
          body: JSON.stringify(prefBody)
        });
        const pref = await prefResponse.json();
        if (!prefResponse.ok || !pref.id || !pref.init_point) {
          await env.DB.prepare("UPDATE ratopolis_store_orders SET status = 'rejected', updated_at = ? WHERE id = ? AND status = 'pending'").bind(new Date().toISOString(), orderId).run();
          return reply({ ok: false, erro: "Nao foi possivel iniciar o pagamento." }, 502);
        }
        await env.DB.prepare("UPDATE ratopolis_store_orders SET provider_preference_id = ?, updated_at = ? WHERE id = ?").bind(String(pref.id), new Date().toISOString(), orderId).run();
        return reply({ ok: true, orderId, checkoutUrl: pref.init_point, product: { code: "vip_30_days", price: 4.99, currency: "BRL", days: 30 } }, 201);
      }


      // Store de cosméticos com saldo, inventário e preços controlados no servidor.
      if (path === "/api/store/catalog" && method === "GET") {
        etapaAtual = "catalogo da loja";
        const catalog = await env.DB.prepare("SELECT code, name, description, category, price_coins, item_payload FROM ratopolis_store_catalog WHERE active = 1 ORDER BY sort_order ASC, id ASC").all();
        return reply({ ok: true, catalogo: catalog.results.map(item => ({ ...item, price_coins: Number(item.price_coins), payload: safeJson(item.item_payload, {}) })) });
      }

      if (path === "/api/store/inventory" && method === "GET") {
        etapaAtual = "inventario da loja";
        const actor = await authenticate(request, env);
        if (!actor) return reply({ ok: false, erro: "Entre na sua conta para consultar o inventario." }, 401);
        const profile = await env.DB.prepare("SELECT coins FROM ratopolis_profiles WHERE user_id = ? LIMIT 1").bind(actor.id).first();
        const result = await env.DB.prepare("SELECT i.item_code, i.quantity, i.equipped, i.acquired_at, c.name, c.description, c.category, c.price_coins, c.item_payload FROM ratopolis_store_inventory i LEFT JOIN ratopolis_store_catalog c ON c.code = i.item_code WHERE i.user_id = ? AND i.quantity > 0 ORDER BY i.acquired_at DESC, i.item_code ASC").bind(actor.id).all();
        return reply({ ok: true, coins: Number(profile?.coins || 0), inventario: result.results.map(item => ({ ...item, quantity: Number(item.quantity), equipped: !!item.equipped, price_coins: Number(item.price_coins || 0), payload: safeJson(item.item_payload, {}) })) });
      }

      if (path === "/api/store/purchase" && method === "POST") {
        etapaAtual = "compra de cosmetico";
        const actor = await authenticate(request, env);
        if (!actor) return reply({ ok: false, erro: "Entre na sua conta para comprar itens." }, 401);
        let body;
        try { body = await request.json(); } catch { return reply({ ok: false, erro: "Pedido invalido." }, 400); }
        const itemCode = typeof body?.itemCode === "string" ? body.itemCode.trim() : "";
        const idemKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
        if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(itemCode) || !/^[A-Za-z0-9._:-]{8,128}$/.test(idemKey)) {
          return reply({ ok: false, erro: "Informe itemCode e uma idempotencyKey valida." }, 400);
        }
        if (body.quantity !== undefined && body.quantity !== 1) return reply({ ok: false, erro: "Cosmeticos sao vendidos em unidades individuais." }, 400);
        const previous = await env.DB.prepare("SELECT purchase_id, item_code, quantity, unit_price_coins, total_price_coins, status, created_at FROM ratopolis_store_purchases WHERE user_id = ? AND idempotency_key = ? LIMIT 1").bind(actor.id, idemKey).first();
        if (previous) {
          if (previous.item_code !== itemCode) return reply({ ok: false, erro: "Esta idempotencyKey ja foi usada em outra compra." }, 409);
          const profile = await env.DB.prepare("SELECT coins FROM ratopolis_profiles WHERE user_id = ?").bind(actor.id).first();
          return reply({ ok: true, duplicado: true, compra: previous, coins: Number(profile?.coins || 0) });
        }
        const recentPurchases = await env.DB.prepare("SELECT COUNT(*) AS total FROM ratopolis_store_purchases WHERE user_id = ? AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 minute')").bind(actor.id).first();
        if (Number(recentPurchases?.total || 0) >= 10) return reply({ ok: false, erro: "Limite temporario de compras atingido. Aguarde um minuto." }, 429);
        const item = await env.DB.prepare("SELECT code, name, price_coins FROM ratopolis_store_catalog WHERE code = ? AND active = 1 LIMIT 1").bind(itemCode).first();
        if (!item) return reply({ ok: false, erro: "Item inexistente ou indisponivel." }, 404);
        const owned = await env.DB.prepare("SELECT quantity FROM ratopolis_store_inventory WHERE user_id = ? AND item_code = ? AND quantity > 0 LIMIT 1").bind(actor.id, itemCode).first();
        if (owned) return reply({ ok: false, erro: "Voce ja possui este cosmetico." }, 409);
        const profile = await env.DB.prepare("SELECT coins FROM ratopolis_profiles WHERE user_id = ? LIMIT 1").bind(actor.id).first();
        if (!profile) return reply({ ok: false, erro: "Perfil nao encontrado." }, 404);
        const price = Number(item.price_coins);
        const balance = Number(profile.coins || 0);
        if (balance < price) return reply({ ok: false, erro: "Moedas insuficientes.", coins: balance, price_coins: price, faltam: price - balance }, 409);
        const purchaseId = crypto.randomUUID();
        const transactionId = crypto.randomUUID();
        const now = new Date().toISOString();
        try {
          await env.DB.batch([
            env.DB.prepare("UPDATE ratopolis_profiles SET coins = coins - ? WHERE user_id = ? AND coins >= ?").bind(price, actor.id, price),
            env.DB.prepare("INSERT INTO ratopolis_store_purchases (purchase_id,user_id,item_code,quantity,unit_price_coins,total_price_coins,status,idempotency_key,created_at) SELECT ?,?,?,1,?,?, 'completed',?,? WHERE changes() = 1").bind(purchaseId, actor.id, item.code, price, price, idemKey, now),
            env.DB.prepare("INSERT INTO ratopolis_store_inventory (user_id,item_code,quantity,equipped,acquired_at,updated_at) SELECT ?,?,1,0,?,? WHERE EXISTS (SELECT 1 FROM ratopolis_store_purchases WHERE purchase_id = ?)").bind(actor.id, item.code, now, now, purchaseId),
            env.DB.prepare("INSERT INTO ratopolis_coin_ledger (transaction_id,user_id,event_type,amount,balance_before,balance_after,reference_id,note,created_at) SELECT ?,?,'store_purchase',?,p.coins + ?,p.coins,?,?,? FROM ratopolis_profiles p WHERE p.user_id = ? AND EXISTS (SELECT 1 FROM ratopolis_store_purchases WHERE purchase_id = ?)").bind(transactionId, actor.id, -price, price, price, purchaseId, "Compra: " + item.name, now, actor.id, purchaseId)
          ]);
        } catch (writeError) {
          const raced = await env.DB.prepare("SELECT purchase_id, item_code, quantity, unit_price_coins, total_price_coins, status, created_at FROM ratopolis_store_purchases WHERE user_id = ? AND idempotency_key = ? LIMIT 1").bind(actor.id, idemKey).first();
          if (raced && raced.item_code === itemCode) {
            const fresh = await env.DB.prepare("SELECT coins FROM ratopolis_profiles WHERE user_id = ?").bind(actor.id).first();
            return reply({ ok: true, duplicado: true, compra: raced, coins: Number(fresh?.coins || 0) });
          }
          const nowOwned = await env.DB.prepare("SELECT quantity FROM ratopolis_store_inventory WHERE user_id = ? AND item_code = ? AND quantity > 0 LIMIT 1").bind(actor.id, itemCode).first();
          if (nowOwned) return reply({ ok: false, erro: "Voce ja possui este cosmetico." }, 409);
          throw writeError;
        }
        const purchase = await env.DB.prepare("SELECT purchase_id, item_code, quantity, unit_price_coins, total_price_coins, status, created_at FROM ratopolis_store_purchases WHERE purchase_id = ? LIMIT 1").bind(purchaseId).first();
        if (!purchase) {
          const fresh = await env.DB.prepare("SELECT coins FROM ratopolis_profiles WHERE user_id = ?").bind(actor.id).first();
          return reply({ ok: false, erro: "Saldo insuficiente ou compra nao concluida.", coins: Number(fresh?.coins || 0), price_coins: price }, 409);
        }
        const fresh = await env.DB.prepare("SELECT coins FROM ratopolis_profiles WHERE user_id = ?").bind(actor.id).first();
        return reply({ ok: true, duplicado: false, compra: purchase, coins: Number(fresh?.coins || 0) }, 201);
      }

      if (path === "/api/store/equip" && method === "POST") {
        etapaAtual = "equipar cosmetico";
        const actor = await authenticate(request, env);
        if (!actor) return reply({ ok: false, erro: "Entre na sua conta para equipar itens." }, 401);
        let body;
        try { body = await request.json(); } catch { return reply({ ok: false, erro: "Pedido invalido." }, 400); }
        const itemCode = typeof body?.itemCode === "string" ? body.itemCode.trim() : "";
        if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(itemCode)) return reply({ ok: false, erro: "itemCode invalido." }, 400);
        const owned = await env.DB.prepare("SELECT item_code FROM ratopolis_store_inventory WHERE user_id = ? AND item_code = ? AND quantity > 0 LIMIT 1").bind(actor.id, itemCode).first();
        if (!owned) return reply({ ok: false, erro: "Este item nao esta no seu inventario." }, 404);
        const item = await env.DB.prepare("SELECT item_payload FROM ratopolis_store_catalog WHERE code = ? LIMIT 1").bind(itemCode).first();
        const payload = safeJson(item?.item_payload, {});
        if (payload.type !== "hat") return reply({ ok: false, erro: "Este tipo de item nao pode ser equipado aqui." }, 400);
        const now = new Date().toISOString();
        await env.DB.batch([
          env.DB.prepare("UPDATE ratopolis_store_inventory SET equipped = 0, updated_at = ? WHERE user_id = ?").bind(now, actor.id),
          env.DB.prepare("UPDATE ratopolis_store_inventory SET equipped = 1, updated_at = ? WHERE user_id = ? AND item_code = ? AND quantity > 0").bind(now, actor.id, itemCode)
        ]);
        return reply({ ok: true, equipado: itemCode, payload });
      }


      if (path === "/api/admin/store/catalog" && method === "GET") {
        etapaAtual = "catalogo administrativo da loja";
        const actor = await authenticate(request, env);
        if (!actor) return reply({ ok: false, erro: "Autenticacao necessaria." }, 401);
        if (!Number.isFinite(ROLE_RANK[actor.role]) || ROLE_RANK[actor.role] < ROLE_RANK.adm) return reply({ ok: false, erro: "Permissao insuficiente." }, 403);
        const result = await env.DB.prepare("SELECT id, code, name, description, category, price_coins, active, sort_order, item_payload, updated_at FROM ratopolis_store_catalog ORDER BY sort_order ASC, id ASC").all();
        return reply({ ok: true, catalogo: result.results.map(item => ({ ...item, price_coins: Number(item.price_coins), active: !!item.active, sort_order: Number(item.sort_order), payload: safeJson(item.item_payload, {}) })) });
      }

      if (path === "/api/admin/store/catalog" && method === "POST") {
        etapaAtual = "edicao administrativa do catalogo";
        const actor = await authenticate(request, env);
        if (!actor) return reply({ ok: false, erro: "Autenticacao necessaria." }, 401);
        if (!Number.isFinite(ROLE_RANK[actor.role]) || ROLE_RANK[actor.role] < ROLE_RANK.adm) return reply({ ok: false, erro: "Permissao insuficiente." }, 403);
        let body;
        try { body = await request.json(); } catch { return reply({ ok: false, erro: "JSON invalido." }, 400); }
        const code = typeof body?.code === "string" ? body.code.trim() : "";
        const name = typeof body?.name === "string" ? body.name.trim() : "";
        const description = typeof body?.description === "string" ? body.description.trim() : "";
        const category = typeof body?.category === "string" ? body.category : "cosmetic";
        const price = body?.price_coins;
        const active = body?.active === false || body?.active === 0 ? 0 : 1;
        const sortOrder = Number.isSafeInteger(body?.sort_order) ? body.sort_order : 100;
        const payload = body?.item_payload && typeof body.item_payload === "object" && !Array.isArray(body.item_payload) ? JSON.stringify(body.item_payload) : "{}";
        if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(code) || !name || name.length > 100 || description.length > 500 ||
            !["cosmetic","consumable","boost","bundle"].includes(category) || !Number.isSafeInteger(price) || price < 0 || price > 1000000 ||
            sortOrder < 0 || sortOrder > 100000) {
          return reply({ ok: false, erro: "Dados invalidos: confira codigo, nome, categoria, preco e ordem." }, 400);
        }
        const now = new Date().toISOString();
        await env.DB.prepare("INSERT INTO ratopolis_store_catalog (code,name,description,category,price_coins,item_payload,active,sort_order,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name, description=excluded.description, category=excluded.category, price_coins=excluded.price_coins, item_payload=excluded.item_payload, active=excluded.active, sort_order=excluded.sort_order, updated_at=excluded.updated_at")
          .bind(code,name,description,category,price,payload,active,sortOrder,now).run();
        await env.DB.prepare("INSERT INTO ratopolis_audit_logs (id,actor_user_id,action,target_user_id,details,created_at) VALUES (?,?,?,?,?,?)")
          .bind(crypto.randomUUID(),actor.id,"store_catalog_updated",null,JSON.stringify({code,price_coins:price,active:!!active}),now).run();
        return reply({ ok: true, mensagem: "Item do catalogo salvo.", code, price_coins: price, active: !!active });
      }

      if (path === "/api/admin/store/transactions" && method === "GET") {
        etapaAtual = "consulta administrativa das compras";
        const actor = await authenticate(request, env);
        if (!actor) return reply({ ok: false, erro: "Autenticacao necessaria." }, 401);
        if (!Number.isFinite(ROLE_RANK[actor.role]) || ROLE_RANK[actor.role] < ROLE_RANK.adm) return reply({ ok: false, erro: "Permissao insuficiente." }, 403);
        const pageRaw = Number.parseInt(url.searchParams.get("page") || "1", 10);
        const limitRaw = Number.parseInt(url.searchParams.get("limit") || "50", 10);
        const page = Number.isFinite(pageRaw) ? Math.max(1, Math.min(pageRaw, 100000)) : 1;
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 100)) : 50;
        const offset = (page - 1) * limit;
        const result = await env.DB.prepare("SELECT p.purchase_id, p.user_id, u.nickname, p.item_code, c.name AS item_name, p.quantity, p.unit_price_coins, p.total_price_coins, p.status, p.created_at FROM ratopolis_store_purchases p LEFT JOIN ratopolis_users u ON u.id = p.user_id LEFT JOIN ratopolis_store_catalog c ON c.code = p.item_code ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?").bind(limit,offset).all();
        const total = await env.DB.prepare("SELECT COUNT(*) AS total FROM ratopolis_store_purchases").first();
        return reply({ ok: true, pagina: page, limite: limit, total: Number(total?.total || 0), transacoes: result.results });
      }

      if (path === "/api/store/me" && method === "GET") {
        etapaAtual = "consulta VIP pago";
        const buyer = await authenticate(request, env);
        if (!buyer) return reply({ ok: false, erro: "Entre na sua conta para consultar o VIP." }, 401);
        const vip = await env.DB.prepare("SELECT expires_at, last_order_id FROM ratopolis_paid_vip WHERE user_id = ?").bind(buyer.id).first();
        const active = !!vip && Date.parse(vip.expires_at) > Date.now();
        return reply({ ok: true, vip: { active, expiresAt: vip?.expires_at || null, days: active ? Math.ceil((Date.parse(vip.expires_at) - Date.now()) / 86400000) : 0 } });
      }

      if (path === "/api/me" && method === "GET") {
        etapaAtual = "validacao da sessao";
        const authUser = await authenticate(request, env);
        if (!authUser) return reply({ ok: false, erro: "Autenticacao necessaria ou sessao invalida." }, 401);
        const profile = await env.DB.prepare("SELECT level, xp, vip_level, coins FROM ratopolis_profiles WHERE user_id = ?").bind(authUser.id).first();
        return reply({ ok: true, jogador: { id: authUser.id, nickname: authUser.nickname, email: authUser.email, role: authUser.role, status: authUser.status, level: profile?.level ?? 1, xp: profile?.xp ?? 0, vip_level: profile?.vip_level ?? 0, coins: profile?.coins ?? 0 } });
      }

      if (path === "/api/logout" && method === "POST") {
        etapaAtual = "encerramento da sessao";
        const token = getBearer(request);
        if (!token) return reply({ ok: false, erro: "Sessao nao informada." }, 401);
        await env.DB.prepare("DELETE FROM ratopolis_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
        return reply({ ok: true, mensagem: "Sessao encerrada." });
      }

      // Bootstrapping de uso único. Não altera D1 até alguém autenticado chamar esta rota
      // com o segredo configurado no Worker e a conta de e-mail previamente definida.
      if (path === "/api/admin/bootstrap" && method === "POST") {
        etapaAtual = "ativacao inicial do SpAdmin";
        if (!env.ADMIN_BOOTSTRAP_SECRET || !request.headers.get("X-Bootstrap-Secret") || !constantTimeEqual(request.headers.get("X-Bootstrap-Secret"), env.ADMIN_BOOTSTRAP_SECRET)) return reply({ ok: false, erro: "Autorizacao de ativacao invalida." }, 403);
        const actor = await authenticate(request, env);
        if (!actor) return reply({ ok: false, erro: "Autenticacao necessaria." }, 401);
        if (normalizeEmail(actor.email) !== SPADMIN_EMAIL) return reply({ ok: false, erro: "A conta autenticada nao corresponde ao e-mail autorizado para SpAdmin." }, 403);
        const existingAdmin = await env.DB.prepare("SELECT id FROM ratopolis_users WHERE role = 'spadm' LIMIT 1").first();
        if (existingAdmin) return reply({ ok: false, erro: "O SpAdmin inicial ja foi configurado. Bootstrap bloqueado." }, 409);
        const now = new Date().toISOString();
        await env.DB.batch([
          env.DB.prepare("UPDATE ratopolis_users SET role = 'spadm' WHERE id = ? AND lower(email) = lower(?) AND status = 'active'").bind(actor.id, SPADMIN_EMAIL),
          env.DB.prepare("INSERT INTO ratopolis_audit_logs (id, actor_user_id, action, target_user_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), actor.id, "admin_bootstrap_spadmin", actor.id, JSON.stringify({ role: "spadm", email: SPADMIN_EMAIL }), now)
        ]);
        const verified = await env.DB.prepare("SELECT role FROM ratopolis_users WHERE id = ?").bind(actor.id).first();
        if (verified?.role !== "spadm") return reply({ ok: false, erro: "A ativacao nao foi confirmada; confira o registro da conta." }, 500);
        return reply({ ok: true, mensagem: "SpAdmin inicial ativado.", role: verified.role });
      }

      if (path === "/api/admin/me" && method === "GET") {
        etapaAtual = "consulta das permissoes administrativas";
        const actor = await authenticate(request, env);
        if (!actor) return reply({ ok: false, erro: "Autenticacao necessaria." }, 401);
        return reply({ ok: true, autorizado: ROLE_RANK[actor.role] >= ROLE_RANK.mod || actor.role === "editor", role: actor.role, permissoes: permissionsFor(actor.role) });
      }

      if (path === "/api/admin/users" && method === "GET") {
        etapaAtual = "consulta administrativa de jogadores";
        const actor = await authenticate(request, env);
        if (!actor) return reply({ ok: false, erro: "Autenticacao necessaria." }, 401);
        if (ROLE_RANK[actor.role] < ROLE_RANK.mod) return reply({ ok: false, erro: "Permissao insuficiente." }, 403);
        const result = await env.DB.prepare("SELECT u.id, u.nickname, u.email, u.role, u.status, u.created_at, p.level, p.xp, p.vip_level, p.coins FROM ratopolis_users u LEFT JOIN ratopolis_profiles p ON p.user_id = u.id ORDER BY u.nickname COLLATE NOCASE ASC, u.id ASC").all();
        return reply({ ok: true, jogadores: result.results });
      }

      if (path === "/api/admin/role" && method === "POST") {
        etapaAtual = "alteracao administrativa de cargo";
        const actor = await authenticate(request, env);
        if (!actor) return reply({ ok: false, erro: "Autenticacao necessaria." }, 401);
        const body = await readJson(request);
        const targetId = typeof body.user_id === "string" ? body.user_id.trim() : "";
        const newRole = typeof body.role === "string" ? body.role.trim().toLowerCase() : "";
        if (!targetId || !ROLES.includes(newRole)) return reply({ ok: false, erro: "Informe user_id e um cargo valido." }, 400);
        if (ROLE_RANK[actor.role] < ROLE_RANK.adm) return reply({ ok: false, erro: "Somente SpAdmin e ADM podem gerenciar cargos." }, 403);
        if (newRole === "spadm") return reply({ ok: false, erro: "O cargo SpAdmin nao pode ser atribuido por esta rota." }, 403);
        if (ROLE_RANK[newRole] >= ROLE_RANK[actor.role]) return reply({ ok: false, erro: "Voce nao pode atribuir um cargo igual ou superior ao seu." }, 403);
        const target = await env.DB.prepare("SELECT id, nickname, role FROM ratopolis_users WHERE id = ? AND status = 'active' LIMIT 1").bind(targetId).first();
        if (!target) return reply({ ok: false, erro: "Jogador ativo nao encontrado." }, 404);
        if (target.role === "spadm") return reply({ ok: false, erro: "O SpAdmin protegido nao pode ser alterado por esta rota." }, 403);
        if (ROLE_RANK[target.role] >= ROLE_RANK[actor.role]) return reply({ ok: false, erro: "Voce nao pode alterar um usuario com cargo igual ou superior ao seu." }, 403);
        const now = new Date().toISOString();
        await env.DB.batch([
          env.DB.prepare("UPDATE ratopolis_users SET role = ? WHERE id = ? AND status = 'active'").bind(newRole, targetId),
          env.DB.prepare("INSERT INTO ratopolis_audit_logs (id, actor_user_id, action, target_user_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), actor.id, "admin_role_change", targetId, JSON.stringify({ from: target.role, to: newRole, nickname: target.nickname }), now)
        ]);
        return reply({ ok: true, mensagem: "Cargo atualizado.", jogador: { id: target.id, nickname: target.nickname, role: newRole } });
      }

      // Editor visual de cenarios. Permissoes verificadas no servidor em cada rota.
      if (path.startsWith("/api/editor/") || path.startsWith("/api/admin/scenario-") || path.startsWith("/api/admin/scenarios/")) {
        etapaAtual = "editor de cenarios";
        const actor = await authenticate(request, env);
        if (!actor) return reply({ ok: false, erro: "Autenticacao necessaria ou sessao invalida." }, 401);
        const role = String(actor.role || "").toLowerCase();
        const isRootAdmin = role === "spadm" || role === "adm";
        const staffRow = await env.DB.prepare("SELECT role FROM ratopolis_scenario_staff WHERE user_id = ? LIMIT 1").bind(actor.id).first();
        const isEditor = String(staffRow?.role || "").toLowerCase() === "editor" || role === "editor";
        const canEditScenarios = isRootAdmin || isEditor;
        const canReviewScenarios = isRootAdmin;
        const now = () => new Date().toISOString();
        const audit = async (action, targetId, details, at = now()) => env.DB.prepare(
          "INSERT INTO ratopolis_audit_logs (id, actor_user_id, action, target_user_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(crypto.randomUUID(), actor.id, action, targetId || null, JSON.stringify(details || {}), at).run();
        const loadScenario = async id => env.DB.prepare("SELECT * FROM ratopolis_scenarios WHERE id = ? LIMIT 1").bind(id).first();
        const loadCurrentVersion = async id => env.DB.prepare(
          "SELECT * FROM ratopolis_scenario_versions WHERE scenario_id = ? AND version_number = (SELECT current_version FROM ratopolis_scenarios WHERE id = ?) LIMIT 1"
        ).bind(id, id).first();
        const parseLayout = body => {
          const layout = body.layout;
          if (!layout || typeof layout !== "object" || Array.isArray(layout)) return { error: "O campo layout deve ser um objeto JSON." };
          const encoded = JSON.stringify(layout);
          if (encoded.length > 100000) return { error: "O cenário excede o limite de 100 KB." };
          const allowedTypes = new Set(["terrain", "block", "cheese", "bolota", "hole", "toca", "stick", "plank", "spawn", "decoration"]);
          if (Array.isArray(layout.objects)) {
            if (layout.objects.length > 500) return { error: "O cenário pode ter no máximo 500 objetos." };
            for (const obj of layout.objects) {
              if (!obj || typeof obj !== "object" || !allowedTypes.has(String(obj.type || ""))) return { error: "Há um objeto com tipo inválido no cenário." };
              for (const key of ["x", "y", "width", "height"]) {
                if (obj[key] !== undefined && (!Number.isFinite(Number(obj[key])) || Math.abs(Number(obj[key])) > 10000)) return { error: "Coordenada ou dimensão inválida." };
              }
            }
          }
          return { encoded };
        };
        const routeId = path.match(/^\/api\/editor\/scenarios\/([^/]+)(?:\/(save|submit|test|versions))?$/);
        if (path === "/api/admin/scenario-staff" && method === "POST") {
          if (!canReviewScenarios) return reply({ ok: false, erro: "Somente SpAdmin e Admin podem conceder acesso de Editor." }, 403);
          const body = await readJson(request);
          const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
          const staffRole = typeof body.role === "string" ? body.role.trim().toLowerCase() : "editor";
          if (!userId || staffRole !== "editor") return reply({ ok: false, erro: "Informe user_id e role=editor." }, 400);
          const target = await env.DB.prepare("SELECT id, nickname, status FROM ratopolis_users WHERE id = ? LIMIT 1").bind(userId).first();
          if (!target || target.status !== "active") return reply({ ok: false, erro: "Conta ativa nao encontrada." }, 404);
          const at = now();
          await env.DB.prepare("INSERT INTO ratopolis_scenario_staff (user_id, role, granted_by_user_id, created_at) VALUES (?, 'editor', ?, ?) ON CONFLICT(user_id) DO UPDATE SET role = 'editor', granted_by_user_id = excluded.granted_by_user_id, created_at = excluded.created_at").bind(userId, actor.id, at).run();
          await audit("scenario_editor_granted", userId, { nickname: target.nickname, role: "editor" }, at);
          return reply({ ok: true, mensagem: "Acesso de Editor concedido.", editor: { user_id: userId, nickname: target.nickname, role: "editor" } });
        }
        if (path === "/api/admin/scenario-staff" && method === "GET") {
          if (!canReviewScenarios) return reply({ ok: false, erro: "Somente SpAdmin e Admin podem consultar a equipe de cenarios." }, 403);
          const result = await env.DB.prepare("SELECT s.user_id, u.nickname, u.email, s.role, s.granted_by_user_id, s.created_at FROM ratopolis_scenario_staff s JOIN ratopolis_users u ON u.id = s.user_id ORDER BY s.created_at DESC").all();
          return reply({ ok: true, equipe: result.results });
        }
        if (path === "/api/editor/scenarios" && method === "GET") {
          if (!canEditScenarios) return reply({ ok: false, erro: "Comando /editor restrito a SpAdmin, Admin e Editor autorizado." }, 403);
          const result = isRootAdmin
            ? await env.DB.prepare("SELECT s.*, u.nickname AS creator_nickname FROM ratopolis_scenarios s LEFT JOIN ratopolis_users u ON u.id = s.creator_user_id ORDER BY s.updated_at DESC LIMIT 200").all()
            : await env.DB.prepare("SELECT s.*, u.nickname AS creator_nickname FROM ratopolis_scenarios s LEFT JOIN ratopolis_users u ON u.id = s.creator_user_id WHERE s.creator_user_id = ? ORDER BY s.updated_at DESC LIMIT 200").bind(actor.id).all();
          return reply({ ok: true, cenarios: result.results });
        }
        if (path === "/api/editor/scenarios" && method === "POST") {
          if (!canEditScenarios) return reply({ ok: false, erro: "Acesso ao editor negado." }, 403);
          const body = await readJson(request);
          const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
          const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
          const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : "";
          if (!name) return reply({ ok: false, erro: "Informe o nome do cenário." }, 400);
          const valid = parseLayout(body);
          if (valid.error) return reply({ ok: false, erro: valid.error }, 400);
          const id = crypto.randomUUID(), versionId = crypto.randomUUID(), at = now();
          await env.DB.batch([
            env.DB.prepare("INSERT INTO ratopolis_scenarios (id, name, description, creator_user_id, status, current_version, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', 1, ?, ?)").bind(id, name, description, actor.id, at, at),
            env.DB.prepare("INSERT INTO ratopolis_scenario_versions (id, scenario_id, version_number, layout_json, notes, created_by_user_id, created_at) VALUES (?, ?, 1, ?, ?, ?, ?)").bind(versionId, id, valid.encoded, notes, actor.id, at),
            env.DB.prepare("INSERT INTO ratopolis_audit_logs (id, actor_user_id, action, target_user_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), actor.id, "scenario_created", null, JSON.stringify({ scenario_id: id, name, version: 1 }), at)
          ]);
          return reply({ ok: true, mensagem: "Cenário salvo como rascunho.", cenario: { id, name, description, status: "draft", current_version: 1, version_id: versionId } }, 201);
        }
        if (routeId && method === "GET" && !routeId[2]) {
          if (!canEditScenarios) return reply({ ok: false, erro: "Acesso ao editor negado." }, 403);
          const scenario = await loadScenario(routeId[1]);
          if (!scenario) return reply({ ok: false, erro: "Cenário não encontrado." }, 404);
          if (!isRootAdmin && scenario.creator_user_id !== actor.id) return reply({ ok: false, erro: "Você só pode abrir seus próprios cenários." }, 403);
          const version = await loadCurrentVersion(scenario.id);
          if (!version) return reply({ ok: false, erro: "Versão do cenário não encontrada." }, 404);
          let layout; try { layout = JSON.parse(version.layout_json); } catch { return reply({ ok: false, erro: "O layout salvo está inválido." }, 500); }
          return reply({ ok: true, cenario: scenario, versao: { id: version.id, version_number: version.version_number, layout, notes: version.notes, created_by_user_id: version.created_by_user_id, created_at: version.created_at } });
        }
        if (routeId && method === "POST" && routeId[2] === "save") {
          if (!canEditScenarios) return reply({ ok: false, erro: "Acesso ao editor negado." }, 403);
          const scenario = await loadScenario(routeId[1]);
          if (!scenario) return reply({ ok: false, erro: "Cenário não encontrado." }, 404);
          if (!isRootAdmin && scenario.creator_user_id !== actor.id) return reply({ ok: false, erro: "Você só pode editar seus próprios cenários." }, 403);
          if (!isRootAdmin && !["draft", "rejected"].includes(scenario.status)) return reply({ ok: false, erro: "Este cenário não está editável; crie uma nova versão após a decisão administrativa." }, 409);
          const body = await readJson(request);
          const valid = parseLayout(body); if (valid.error) return reply({ ok: false, erro: valid.error }, 400);
          const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : scenario.name;
          const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : scenario.description;
          const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : "";
          const versionNumber = Number(scenario.current_version) + 1, versionId = crypto.randomUUID(), at = now();
          await env.DB.batch([
            env.DB.prepare("INSERT INTO ratopolis_scenario_versions (id, scenario_id, version_number, layout_json, notes, created_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(versionId, scenario.id, versionNumber, valid.encoded, notes, actor.id, at),
            env.DB.prepare("UPDATE ratopolis_scenarios SET name = ?, description = ?, current_version = ?, status = 'draft', submitted_at = NULL, approved_at = NULL, published_at = NULL, updated_at = ? WHERE id = ?").bind(name, description, versionNumber, at, scenario.id),
            env.DB.prepare("INSERT INTO ratopolis_audit_logs (id, actor_user_id, action, target_user_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), actor.id, "scenario_saved", null, JSON.stringify({ scenario_id: scenario.id, version: versionNumber }), at)
          ]);
          return reply({ ok: true, mensagem: "Nova versão salva como rascunho.", cenario: { id: scenario.id, name, description, status: "draft", current_version: versionNumber, version_id: versionId } });
        }
        if (routeId && method === "POST" && routeId[2] === "submit") {
          if (!canEditScenarios) return reply({ ok: false, erro: "Acesso ao editor negado." }, 403);
          const scenario = await loadScenario(routeId[1]);
          if (!scenario) return reply({ ok: false, erro: "Cenário não encontrado." }, 404);
          if (!isRootAdmin && scenario.creator_user_id !== actor.id) return reply({ ok: false, erro: "Você só pode enviar seus próprios cenários." }, 403);
          if (!["draft", "rejected"].includes(scenario.status)) return reply({ ok: false, erro: "Somente rascunhos podem ser enviados para aprovação." }, 409);
          const at = now();
          await env.DB.batch([
            env.DB.prepare("UPDATE ratopolis_scenarios SET status = 'submitted', submitted_at = ?, updated_at = ? WHERE id = ?").bind(at, at, scenario.id),
            env.DB.prepare("INSERT INTO ratopolis_audit_logs (id, actor_user_id, action, target_user_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), actor.id, "scenario_submitted", null, JSON.stringify({ scenario_id: scenario.id, version: scenario.current_version }), at)
          ]);
          return reply({ ok: true, mensagem: "Cenário enviado para aprovação.", status: "submitted" });
        }
        if (routeId && method === "GET" && routeId[2] === "versions") {
          if (!canEditScenarios) return reply({ ok: false, erro: "Acesso ao editor negado." }, 403);
          const scenario = await loadScenario(routeId[1]);
          if (!scenario) return reply({ ok: false, erro: "Cenário não encontrado." }, 404);
          if (!isRootAdmin && scenario.creator_user_id !== actor.id) return reply({ ok: false, erro: "Você só pode consultar seus próprios cenários." }, 403);
          const result = await env.DB.prepare("SELECT id, version_number, notes, created_by_user_id, created_at FROM ratopolis_scenario_versions WHERE scenario_id = ? ORDER BY version_number DESC").bind(scenario.id).all();
          return reply({ ok: true, versoes: result.results });
        }
        // Valida o layout para pré-visualização sem gravar alterações no D1.
        // A interface do jogo deve consumir o layout retornado e desenhar o preview localmente.
        if (routeId && method === "POST" && routeId[2] === "test") {
          if (!canEditScenarios) return reply({ ok: false, erro: "Acesso ao editor negado." }, 403);
          const scenario = await loadScenario(routeId[1]);
          if (!scenario) return reply({ ok: false, erro: "Cenário não encontrado." }, 404);
          if (!isRootAdmin && scenario.creator_user_id !== actor.id) return reply({ ok: false, erro: "Você só pode testar seus próprios cenários." }, 403);
          const body = await readJson(request);
          let layout = body.layout;
          let versionNumber = Number(scenario.current_version);
          if (layout === undefined) {
            const version = await loadCurrentVersion(scenario.id);
            if (!version) return reply({ ok: false, erro: "Versão do cenário não encontrada." }, 404);
            try { layout = JSON.parse(version.layout_json); }
            catch { return reply({ ok: false, erro: "O layout salvo está inválido." }, 500); }
            versionNumber = Number(version.version_number);
          }
          const valid = parseLayout({ layout });
          if (valid.error) return reply({ ok: false, erro: valid.error }, 400);
          return reply({
            ok: true,
            modo: "preview",
            mensagem: "Layout validado. Esta rota não inicia a física do jogo nem grava alterações.",
            cenario: { id: scenario.id, name: scenario.name, version: versionNumber },
            layout,
            validacao: { objetos: Array.isArray(layout.objects) ? layout.objects.length : 0, bytes_json: valid.encoded.length }
          });
        }
        if (path === "/api/admin/scenarios/review" && method === "GET") {
          if (!canReviewScenarios) return reply({ ok: false, erro: "Somente SpAdmin e Admin podem revisar cenários." }, 403);
          const result = await env.DB.prepare("SELECT s.*, u.nickname AS creator_nickname FROM ratopolis_scenarios s LEFT JOIN ratopolis_users u ON u.id = s.creator_user_id WHERE s.status IN ('submitted','approved') ORDER BY s.submitted_at ASC LIMIT 200").all();
          return reply({ ok: true, cenarios: result.results });
        }
        if (path === "/api/admin/scenarios/review" && method === "POST") {
          if (!canReviewScenarios) return reply({ ok: false, erro: "Somente SpAdmin e Admin podem aprovar ou rejeitar cenários." }, 403);
          const body = await readJson(request);
          const scenarioId = typeof body.scenario_id === "string" ? body.scenario_id.trim() : "";
          const decision = typeof body.decision === "string" ? body.decision.trim().toLowerCase() : "";
          const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
          if (!scenarioId || !["approve", "reject"].includes(decision)) return reply({ ok: false, erro: "Informe scenario_id e decision=approve ou reject." }, 400);
          if (decision === "reject" && !reason) return reply({ ok: false, erro: "Informe o motivo da rejeição." }, 400);
          const scenario = await loadScenario(scenarioId);
          if (!scenario) return reply({ ok: false, erro: "Cenário não encontrado." }, 404);
          if (scenario.status !== "submitted") return reply({ ok: false, erro: "Este cenário não está aguardando aprovação." }, 409);
          const version = await loadCurrentVersion(scenarioId);
          if (!version) return reply({ ok: false, erro: "Versão do cenário não encontrada." }, 409);
          const at = now(), status = decision === "approve" ? "approved" : "rejected";
          await env.DB.batch([
            env.DB.prepare("INSERT INTO ratopolis_scenario_reviews (id, scenario_id, version_id, reviewer_user_id, decision, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), scenarioId, version.id, actor.id, decision === "approve" ? "approved" : "rejected", reason, at),
            env.DB.prepare("UPDATE ratopolis_scenarios SET status = ?, approved_at = ?, updated_at = ? WHERE id = ?").bind(status, decision === "approve" ? at : null, at, scenarioId),
            env.DB.prepare("INSERT INTO ratopolis_audit_logs (id, actor_user_id, action, target_user_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), actor.id, decision === "approve" ? "scenario_approved" : "scenario_rejected", null, JSON.stringify({ scenario_id: scenarioId, version_id: version.id, reason }), at)
          ]);
          return reply({ ok: true, mensagem: decision === "approve" ? "Cenário aprovado. Ele ainda precisa ser publicado." : "Cenário rejeitado; o motivo foi registrado.", status });
        }
        if (path === "/api/admin/scenarios/publish" && method === "POST") {
          if (!canReviewScenarios) return reply({ ok: false, erro: "Somente SpAdmin e Admin podem publicar cenários." }, 403);
          const body = await readJson(request);
          const scenarioId = typeof body.scenario_id === "string" ? body.scenario_id.trim() : "";
          if (!scenarioId) return reply({ ok: false, erro: "Informe scenario_id." }, 400);
          const scenario = await loadScenario(scenarioId);
          if (!scenario) return reply({ ok: false, erro: "Cenário não encontrado." }, 404);
          if (scenario.status !== "approved") return reply({ ok: false, erro: "Somente cenários aprovados podem ser publicados." }, 409);
          const at = now();
          await env.DB.batch([
            env.DB.prepare("UPDATE ratopolis_scenarios SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?").bind(at, at, scenarioId),
            env.DB.prepare("INSERT INTO ratopolis_audit_logs (id, actor_user_id, action, target_user_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), actor.id, "scenario_published", null, JSON.stringify({ scenario_id: scenarioId, version: scenario.current_version }), at)
          ]);
          return reply({ ok: true, mensagem: "Cenário publicado.", status: "published" });
        }
        if (path.startsWith("/api/editor/") && !canEditScenarios) return reply({ ok: false, erro: "Acesso ao editor negado." }, 403);
      }

      return reply({ ok: false, erro: "Endpoint nao encontrado." }, 404);
    } catch (error) {
      console.error("Ratopolis API:", { etapa: etapaAtual, nome: error?.name || "Erro", mensagem: String(error?.message || error), stack: error?.stack || "" });
      if (error instanceof SyntaxError && ["leitura do cadastro", "leitura do login", "alteracao administrativa de cargo", "validacao da recompensa interna", "editor de cenarios"].includes(etapaAtual)) return reply({ ok: false, erro: "O corpo da requisicao deve ser um JSON valido." }, 400);
      return reply({ ok: false, erro: "Erro interno da API.", etapa: etapaAtual }, 500);
    }
  }
};

async function authenticate(request, env) {
  const token = getBearer(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  return await env.DB.prepare("SELECT u.id, u.nickname, u.email, u.role, u.status, s.id AS session_id FROM ratopolis_sessions s JOIN ratopolis_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active' LIMIT 1").bind(tokenHash, new Date().toISOString()).first();
}
function safeJson(value, fallback) { try { return JSON.parse(value); } catch { return fallback; } }
function getBearer(request) {
  const auth = request.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : "";
}
function permissionsFor(role) {
  return {
    viewAdminPanel: ROLE_RANK[role] >= ROLE_RANK.mod || role === "editor",
    viewUsers: ROLE_RANK[role] >= ROLE_RANK.mod,
    moderate: ROLE_RANK[role] >= ROLE_RANK.gm,
    manageStaff: ROLE_RANK[role] >= ROLE_RANK.adm,
    manageSpAdmin: false,
    editScenarios: ROLE_RANK[role] >= ROLE_RANK.adm || role === "editor",
    promoteSocial: role === "divulgador"
  };
}
async function readJson(request) { return await request.json(); }
function normalizeNickname(value) { return typeof value === "string" ? value.trim() : ""; }
function normalizeEmail(value) { return typeof value === "string" ? value.trim().toLowerCase() : ""; }
function normalizeIdentifier(value) { return typeof value === "string" ? value.trim() : ""; }
function toBase64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, key, 256);
  return toBase64url(new Uint8Array(bits));
}
async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toBase64url(new Uint8Array(digest));
}
function constantTimeEqual(a, b) {
  const aa = new TextEncoder().encode(String(a));
  const bb = new TextEncoder().encode(String(b));
  let difference = aa.length ^ bb.length;
  const length = Math.max(aa.length, bb.length);
  for (let i = 0; i < length; i++) difference |= (aa[i % (aa.length || 1)] || 0) ^ (bb[i % (bb.length || 1)] || 0);
  return difference === 0;
}