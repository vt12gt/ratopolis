'use strict';

const http = require('node:http');
const { URL } = require('node:url');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 8787);
const RATOPOLIS_API_URL = String(process.env.RATOPOLIS_API_URL || 'https://ratopolis-api-dev-v30.juniorgmj69.workers.dev').replace(/\/+$/, '');
const RATO_SNACK_API_URL = String(process.env.RATO_SNACK_API_URL || 'https://rato-snack-api-dev.juniorgmj69.workers.dev').replace(/\/+$/, '');
const ALLOWED_ORIGINS = new Set([
  'https://vt12gt.github.io',
  'https://ratopolis-cadastro-teste.pages.dev',
  'http://localhost:8158',
  'http://localhost:8787'
]);
const MAX_PLAYERS = 4;
const COUNTDOWN_MS = 5000;
const RECONNECT_GRACE_MS = 30000;

const rooms = new Map();
const socketsByUser = new Map();
const roomByUser = new Map();
const wsTickets = new Map();

function json(res, status, data, origin) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...(origin && ALLOWED_ORIGINS.has(origin) ? {
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin'
    } : {})
  });
  res.end(JSON.stringify({ s: status, ...data }));
}

function cors(req, res) {
  const origin = req.headers.origin || '';
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error('body_too_large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function upstream(path, method, body, token) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(RATOPOLIS_API_URL + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(12000)
  });
  let data = {};
  try { data = await response.json(); } catch (_) {}
  return { status: response.status, data };
}

async function snackUpstream(path, method, body, token) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(RATO_SNACK_API_URL + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(12000)
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { message: raw.slice(0, 500) }; }
  return { status: response.status, data };
}

function extractRatopolisPlayer(data) {
  if (!data || typeof data !== 'object') return null;
  const candidates = [
    data.jogador, data.player, data.user, data.usuario,
    data.data && data.data.jogador,
    data.data && data.data.player,
    data.data && data.data.user,
    data.data && data.data.usuario
  ];
  for (const user of candidates) {
    if (!user || typeof user !== 'object') continue;
    const id = user.id ?? user.user_id ?? user.userId;
    const nick = user.nickname ?? user.nick ?? user.username ?? user.nome;
    const level = Number(user.level ?? user.nivel ?? user.nível ?? 1) || 1;
    const xp = Number(user.xp ?? user.experience ?? 0) || 0;
    if (id != null && String(id).trim() && nick != null && String(nick).trim()) {
      return { id: String(id), nick: String(nick), level, xp };
    }
  }
  return null;
}

async function authenticate(token) {
  if (!token || token.length > 4096) return null;
  const result = await upstream('/api/me', 'GET', undefined, token);
  const user = result.status === 200 ? extractRatopolisPlayer(result.data) : null;
  if (!user) {
    console.warn('Ratópolis session rejected for ticket; upstream status:', result.status,
      'response keys:', Object.keys(result.data || {}).join(','));
    return null;
  }
  return { ...user, token };
}

function roomPlayers(room) {
  return [...room.players.values()].map(p => ({
    id: p.id,
    nick: p.nick,
    level: p.level || 1,
    online: !!(p.ws && p.ws.readyState === WebSocket.OPEN)
  }));
}
function send(ws, message) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}
function broadcast(room, message, exceptId) {
  for (const p of room.players.values()) if (p.id !== exceptId) send(p.ws, message);
}
function roster(room) {
  const players = roomPlayers(room);
  for (const p of room.players.values()) send(p.ws, { t: 'roster', mode: room.mode, players });
}
function clearCountdown(room) {
  if (room.countdown) clearTimeout(room.countdown);
  room.countdown = null;
}
function destroyRoom(room, notify = true) {
  clearCountdown(room);
  rooms.delete(room.id);
  for (const p of room.players.values()) {
    roomByUser.delete(p.id);
    if (notify) send(p.ws, { t: 'end' });
  }
  room.players.clear();
}
function createRoom(mode) {
  const room = {
    mode,
    id: crypto.randomUUID(),
    players: new Map(),
    hostId: null,
    started: false,
    countdown: null,
    createdAt: Date.now()
  };
  rooms.set(room.id, room);
  return room;
}
function firstAvailableRoom(mode) {
  for (const room of rooms.values()) {
    if (room.mode === mode && room.players.size < MAX_PLAYERS) return room;
  }
  return createRoom(mode);
}
function startCountdown(room) {
  if (room.started || room.countdown || room.players.size < 2) return;
  room.countdown = setTimeout(() => {
    room.countdown = null;
    if (!rooms.has(room.id) || room.players.size < 2) return;
    room.started = true;
    broadcast(room, { t: 'start', mode: room.mode });
  }, COUNTDOWN_MS);
  broadcast(room, { t: 'countdown', ms: COUNTDOWN_MS, mode: room.mode });
}
function addPlayer(room, user, ws) {
  const old = room.players.get(user.id);
  if (old && old.reconnectTimer) clearTimeout(old.reconnectTimer);
  const player = old || { id: user.id, nick: user.nick, level: user.level || 1, ws: null, reconnectTimer: null, slot: room.players.size };
  player.nick = user.nick;
  player.level = user.level || 1;
  player.ws = ws;
  player.reconnectTimer = null;
  room.players.set(user.id, player);
  roomByUser.set(user.id, room.id);
  if (!room.hostId) room.hostId = user.id;
  const isHost = room.hostId === user.id;
  send(ws, { t: 'joined', host: room.hostId, isHost, mode: room.mode, players: roomPlayers(room) });
  if (isHost) {
    // Host does not need a peer_join event for itself.
  } else {
    const host = room.players.get(room.hostId);
    if (host && host.ws) send(host.ws, { t: old ? 'peer_back' : 'peer_join', id: user.id, nick: user.nick, slot: player.slot + 1 });
  }
  if (room.started) {
    send(ws, { t: 'start', mode: room.mode });
  } else {
    startCountdown(room);
  }
  roster(room);
}
function removePlayer(room, userId, deliberate = false) {
  const p = room.players.get(userId);
  if (!p) return;
  if (p.reconnectTimer) clearTimeout(p.reconnectTimer);
  if (!deliberate && p.ws) {
    p.ws = null;
    const host = room.players.get(room.hostId);
    if (host && host.id !== userId) send(host.ws, { t: 'peer_offline', id: userId });
    p.reconnectTimer = setTimeout(() => {
      if (p.ws) return;
      removePlayer(room, userId, true);
    }, RECONNECT_GRACE_MS);
    roster(room);
    return;
  }
  room.players.delete(userId);
  roomByUser.delete(userId);
  if (userId === room.hostId) {
    destroyRoom(room, true);
    return;
  }
  const host = room.players.get(room.hostId);
  if (host) send(host.ws, { t: 'peer_leave', id: userId });
  if (!room.started && room.players.size < 2) clearCountdown(room);
  roster(room);
  if (room.players.size === 0) destroyRoom(room, false);
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  const url = new URL(req.url, 'http://localhost');
  const origin = req.headers.origin || '';
  try {
    if (url.pathname === '/health' && req.method === 'GET') {
      return json(res, 200, { ok: true, service: 'rato-snack-realtime', version: '1.1.0', rooms: rooms.size, onlinePlayers: socketsByUser.size }, origin);
    }
    if (url.pathname === '/api/login' && req.method === 'POST') {
      const body = await readBody(req);
      const result = await upstream('/api/login', 'POST', {
        identifier: body.identifier,
        password: body.password
      });
      const user = result.data && result.data.jogador;
      if (result.status !== 200 || !result.data.ok || !result.data.token || !user) {
        const error = result.status === 401 ? 'credenciais' : result.status === 429 ? 'muitas_tentativas' : 'ratopolis_indisponivel';
        return json(res, result.status, { error }, origin);
      }
      return json(res, 200, {
        token: result.data.token,
        id: String(user.id),
        nick: String(user.nickname)
      }, origin);
    }
    if (url.pathname === '/api/me' && req.method === 'GET') {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const result = await upstream('/api/me', 'GET', undefined, token);
      const user = result.status === 200 ? extractRatopolisPlayer(result.data) : null;
      if (!user) {
        console.warn('Ratópolis /api/me rejected; upstream status:', result.status,
          'response keys:', Object.keys(result.data || {}).join(','));
        return json(res, 401, { error: 'sessao_invalida' }, origin);
      }
      return json(res, 200, user, origin);
    }
    if (url.pathname === '/api/ws-ticket' && req.method === 'POST') {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const user = await authenticate(token);
      if (!user) return json(res, 401, { error: 'sessao_invalida' }, origin);
      const now = Date.now();
      for (const [key, value] of wsTickets) if (value.expiresAt <= now) wsTickets.delete(key);
      const ticket = crypto.randomUUID();
      wsTickets.set(ticket, { user, expiresAt: now + 30000 });
      return json(res, 200, { ticket, expiresIn: 30 }, origin);
    }
    if (url.pathname === '/api/logout' && req.method === 'POST') {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const result = await upstream('/api/logout', 'POST', {}, token);
      return json(res, result.status, result.data, origin);
    }
    if (url.pathname.startsWith('/api/rato-snack/')) {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : undefined;
      const result = await snackUpstream(url.pathname + url.search, req.method, body, token);
      return json(res, result.status, result.data, origin);
    }
    return json(res, 404, { error: 'not_found' }, origin);
  } catch (error) {
    console.error('HTTP error:', error);
    return json(res, error.message === 'body_too_large' ? 413 : 502, { error: 'upstream_unavailable' }, origin);
  }
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
server.on('upgrade', async (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }
  try {
    const ticket = String(url.searchParams.get('ticket') || '');
    const issued = wsTickets.get(ticket);
    if (!issued || issued.expiresAt <= Date.now()) {
      if (ticket) wsTickets.delete(ticket);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wsTickets.delete(ticket); // ticket de uso único
    const user = issued.user;
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws, req, user);
    });
  } catch (error) {
    console.error('WebSocket auth error:', error);
    socket.destroy();
  }
});

wss.on('connection', (ws, req, user) => {
  const previous = socketsByUser.get(user.id);
  if (previous && previous !== ws && previous.readyState === WebSocket.OPEN) {
    previous.close(4001, 'account_in_use');
  }
  socketsByUser.set(user.id, ws);
  ws.user = user;
  send(ws, { t: 'hello' });

  const existingRoomId = roomByUser.get(user.id);
  const existingRoom = existingRoomId && rooms.get(existingRoomId);
  if (existingRoom && existingRoom.players.has(user.id)) {
    addPlayer(existingRoom, user, ws);
  }

  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch (_) { return; }
    let roomId = roomByUser.get(user.id);
    let room = roomId && rooms.get(roomId);

    if (m.t === 'play') {
      if (room && room.players.has(user.id)) {
        addPlayer(room, user, ws);
        return;
      }
      const allowedModes = new Set(['quick','survival','challenge','team','boss','infinite','daily','treino','mundial']);
      const requestedMode = String(m.mode || 'quick');
      const selectedMode = allowedModes.has(requestedMode) ? requestedMode : 'quick';
      room = firstAvailableRoom(selectedMode);
      // A solo player starts immediately with local AI bots; later real players join this live room.
      room.started = true;
      addPlayer(room, user, ws);
      return;
    }
    if (!room || !room.players.has(user.id)) return;

    if (m.t === 'leave' || (m.t === 'ctl' && m.k === 'end')) {
      removePlayer(room, user.id, true);
      return;
    }
    if (m.t === 'in') {
      const host = room.players.get(room.hostId);
      if (host && host.ws) send(host.ws, { t: 'in', from: user.id, d: String(m.d || '').slice(0, 60000) });
      return;
    }
    if (m.t === 'st') {
      const target = room.players.get(String(m.to || ''));
      if (target && target.ws) send(target.ws, { t: 'st', d: String(m.d || '').slice(0, 60000) });
      return;
    }
  });

  ws.on('close', () => {
    if (socketsByUser.get(user.id) === ws) socketsByUser.delete(user.id);
    const id = roomByUser.get(user.id);
    const room = id && rooms.get(id);
    if (room) {
      const p = room.players.get(user.id);
      if (p && p.ws === ws) removePlayer(room, user.id, false);
    }
  });
  ws.on('error', error => console.error('WebSocket error:', error.message));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Rato Snack multiplayer server listening on port ' + PORT);
});
