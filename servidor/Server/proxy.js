// RativaSnack — gateway de compatibilidade para o protocolo online atual.
// Encaminha HTTP e WebSocket ao backend existente, preservando tickets, salas,
// sinalização entre jogadores, staff, voz, ranking e persistência.
// Este gateway NÃO substitui a lógica de jogo nem autentica tickets por conta própria.

'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const WebSocket = require('ws');

const PORT = Number(process.env.PORT || 8080);
const UPSTREAM = process.env.RATIVA_UPSTREAM_URL || 'https://rato-snack-multiplayer.onrender.com';
const upstreamUrl = new URL(UPSTREAM);
if (!['http:', 'https:'].includes(upstreamUrl.protocol)) {
  throw new Error('RATIVA_UPSTREAM_URL precisa usar http:// ou https://');
}

const transport = upstreamUrl.protocol === 'https:' ? https : http;
const wsProtocol = upstreamUrl.protocol === 'https:' ? 'wss:' : 'ws:';
const wsServer = new WebSocket.Server({ noServer: true, maxPayload: 1024 * 1024 });

function targetFor(pathname) {
  return new URL(pathname, upstreamUrl);
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
}

function proxyHttp(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const target = targetFor(req.url || '/');
  const headers = { ...req.headers, host: target.host };
  delete headers.connection;
  delete headers['content-length'];
  delete headers['transfer-encoding'];

  const upstreamReq = transport.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || undefined,
    method: req.method,
    path: target.pathname + target.search,
    headers,
    timeout: 30000
  }, upstreamRes => {
    const responseHeaders = { ...upstreamRes.headers };
    delete responseHeaders['access-control-allow-origin'];
    delete responseHeaders['access-control-allow-credentials'];
    res.writeHead(upstreamRes.statusCode || 502, responseHeaders);
    upstreamRes.pipe(res);
  });

  upstreamReq.on('timeout', () => upstreamReq.destroy(new Error('upstream_timeout')));
  upstreamReq.on('error', err => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'upstream_unavailable', detail: err.message }));
    } else {
      res.destroy(err);
    }
  });
  req.pipe(upstreamReq);
}

const server = http.createServer(proxyHttp);

server.on('upgrade', (req, socket, head) => {
  let target;
  try {
    target = targetFor(req.url || '/');
  } catch {
    socket.destroy();
    return;
  }
  if (target.pathname !== '/ws') {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  target.protocol = wsProtocol;
  const protocols = String(req.headers['sec-websocket-protocol'] || '')
    .split(',').map(x => x.trim()).filter(Boolean);
  const headers = { ...req.headers, host: target.host };
  for (const name of [
    'connection', 'upgrade', 'host', 'sec-websocket-key',
    'sec-websocket-version', 'sec-websocket-extensions',
    'sec-websocket-protocol', 'content-length'
  ]) delete headers[name];

  const upstream = new WebSocket(target.toString(), protocols, {
    headers,
    handshakeTimeout: 15000,
    maxPayload: 1024 * 1024
  });

  let settled = false;
  const reject = (status, message) => {
    if (settled) return;
    settled = true;
    if (socket.destroyed) return;
    const body = String(message || 'WebSocket upstream unavailable');
    socket.write(
      `HTTP/1.1 ${status} Bad Gateway\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
    );
    socket.destroy();
    try { upstream.terminate(); } catch {}
  };

  upstream.once('unexpected-response', (_request, response) => {
    reject(response.statusCode || 502, 'WebSocket upstream rejected the connection');
  });
  upstream.once('error', err => reject(502, err.message));

  upstream.once('open', () => {
    if (settled || socket.destroyed) {
      upstream.close();
      return;
    }
    settled = true;
    wsServer.handleUpgrade(req, socket, head, client => {
      const relay = (from, to) => {
        from.on('message', (data, isBinary) => {
          if (to.readyState === WebSocket.OPEN) to.send(data, { binary: isBinary });
        });
        from.on('ping', data => {
          if (to.readyState === WebSocket.OPEN) to.ping(data);
        });
        from.on('pong', data => {
          if (to.readyState === WebSocket.OPEN) to.pong(data);
        });
        from.on('close', (code, reason) => {
          if (to.readyState === WebSocket.OPEN) to.close(code, reason);
        });
        from.on('error', () => {
          if (to.readyState === WebSocket.OPEN) to.close(1011, 'relay_error');
        });
      };
      relay(client, upstream);
      relay(upstream, client);
      client.on('close', () => {
        if (upstream.readyState === WebSocket.OPEN) upstream.close();
        else upstream.terminate();
      });
    });
  });

  socket.on('close', () => {
    if (upstream.readyState === WebSocket.OPEN) upstream.close();
    else upstream.terminate();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`RativaSnack compatibility gateway listening on ${PORT}`);
  console.log(`Upstream: ${upstreamUrl.origin}`);
});
