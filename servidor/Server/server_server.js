// ==========================================================
// RATIVASNACK — SERVIDOR AUTORITATIVO
// ==========================================================

const WebSocket = require('ws');
const { Simulation, WORLD_SIZE } = require('../shared/sim.js');

const PORT = process.env.PORT || 8080;
const TICK_RATE = 30;
const SIM_RATE = 60;

const sim = new Simulation();
const clients = new Map();
let clientIdCounter = 0;

const wss = new WebSocket.Server({ port: PORT });
console.log(`🐀 RativaSnack Servidor — porta ${PORT}`);
console.log(`🌍 Mundo: ${WORLD_SIZE}px | Sim: ${SIM_RATE}Hz | Envio: ${TICK_RATE}Hz`);

function encodeState(state) {
  const snakes = state.snakes;
  const foods = state.foods;
  
  let size = 8 + 4;
  size += foods.length * 9;
  for (const s of snakes) {
    size += 26 + s.segs.length * 8;
  }
  size += 2;
  
  const buf = new ArrayBuffer(size);
  const view = new DataView(buf);
  let off = 0;
  
  view.setFloat64(off, state.t, true); off += 8;
  view.setUint32(off, state.f, true); off += 4;
  
  view.setUint16(off, foods.length, true); off += 2;
  for (const f of foods) {
    view.setFloat32(off, f.x, true); off += 4;
    view.setFloat32(off, f.y, true); off += 4;
    const colorHex = f.c.replace('#', '');
    view.setUint8(off++, parseInt(colorHex, 16) & 0xFF);
  }
  
  view.setUint16(off, snakes.length, true); off += 2;
  for (const s of snakes) {
    view.setUint32(off, s.id, true); off += 4;
    view.setFloat32(off, s.x, true); off += 4;
    view.setFloat32(off, s.y, true); off += 4;
    view.setFloat32(off, s.a, true); off += 4;
    view.setUint16(off, s.s, true); off += 2;
    const flags = (s.l ? 1 : 0) | (s.b ? 2 : 0);
    view.setUint8(off++, flags);
    view.setFloat32(off, s.bc || 0, true); off += 4;
    
    view.setUint16(off, s.segs.length, true); off += 2;
    for (const seg of s.segs) {
      view.setFloat32(off, seg.x, true); off += 4;
      view.setFloat32(off, seg.y, true); off += 4;
    }
  }
  
  return buf;
}

wss.on('connection', (ws) => {
  const id = ++clientIdCounter;
  const client = { id, name: '', color: '#ffd34e', ws };
  clients.set(ws, client);
  
  console.log(`✅ Cliente #${id} conectado | Total: ${clients.size}`);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      switch (msg.type) {
        case 'join': {
          client.name = msg.name || `Jogador ${id}`;
          client.color = msg.color || '#ffd34e';
          sim.addSnake(id, client.name, client.color);
          
          ws.send(JSON.stringify({
            type: 'welcome',
            id: id,
            worldSize: WORLD_SIZE
          }));
          
          broadcast(JSON.stringify({
            type: 'playerJoined',
            id: id,
            name: client.name,
            color: client.color
          }));
          break;
        }
        
        case 'input': {
          sim.applyInput(id, {
            dirX: msg.dx,
            dirY: msg.dy,
            boost: msg.boost
          });
          break;
        }
        
        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong', t: msg.t }));
          break;
        }
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    sim.removeSnake(id);
    clients.delete(ws);
    console.log(`❌ Cliente #${id} desconectado | Total: ${clients.size}`);
    
    broadcast(JSON.stringify({
      type: 'playerLeft',
      id: id
    }));
  });
});

function broadcast(msg) {
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

setInterval(() => sim.update(), 1000 / SIM_RATE);

setInterval(() => {
  if (clients.size === 0) return;
  const packed = encodeState(sim.getFullState());
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(packed);
  }
}, 1000 / TICK_RATE);

console.log('🚀 Servidor pronto!');
