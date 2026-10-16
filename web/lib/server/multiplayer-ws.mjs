import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { createRooms, SNAPSHOT_MAX } from './multiplayer.mjs';
import { getAccounts } from './accounts.mjs';
import { clientKey } from './auth-http.mjs';

// Connection caps: per account, per IP and global. acquire() returns a release fn or null.
export function createConnectionGate({ perAccount = 3, perIp = 10, max = 400 } = {}) {
  const byAccount = new Map(), byIp = new Map();let total = 0;
  const dec = (map, key) => { const n = (map.get(key) || 0) - 1; if (n > 0) map.set(key, n); else map.delete(key); };
  return {
    acquire(accountId, ip) {
      if (total >= max || (byAccount.get(accountId) || 0) >= perAccount || (byIp.get(ip) || 0) >= perIp) return null;
      total++;byAccount.set(accountId, (byAccount.get(accountId) || 0) + 1);byIp.set(ip, (byIp.get(ip) || 0) + 1);
      let done = false;
      return () => { if (done) return; done = true; total--; dec(byAccount, accountId); dec(byIp, ip); };
    },
    stats: () => ({ total, accounts: byAccount.size, ips: byIp.size }),
  };
}

// Attaches the co-op WebSocket endpoint (/mp) to the existing HTTP server.
// Auth: the same HttpOnly session cookie as the site; Origin must be the site origin.
export function attachMultiplayer(server, env = process.env, { otherUpgrade = null, gate = createConnectionGate(), pingMs = 20000 } = {}) {
  const rooms = createRooms();
  const wss = new WebSocketServer({ noServer: true, maxPayload: SNAPSHOT_MAX + 4096, perMessageDeflate: { threshold: 4096 } });
  const reject = (socket, status) => { try { socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); } catch {} socket.destroy(); };
  server.on('upgrade', async (request, socket, head) => {
    const url = new URL(request.url || '/', 'http://localhost');
    if (url.pathname !== '/mp') return otherUpgrade ? otherUpgrade(request, socket, head) : reject(socket, '404 Not Found');
    if (env.LABS_MULTIPLAYER_ENABLED !== 'true') return reject(socket, '503 Service Unavailable');
    if (!env.LABS_ORIGIN || request.headers.origin !== env.LABS_ORIGIN) return reject(socket, '403 Forbidden');
    let account = null, accounts = null;
    const token = (request.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('labs_session='))?.slice(13);
    try { accounts = await getAccounts(); account = await accounts.session(token); } catch { return reject(socket, '503 Service Unavailable'); }
    if (!account) return reject(socket, '401 Unauthorized');
    let ip = clientKey({ headers: { get: name => request.headers[name] } });
    if (ip === 'unknown') ip = String(request.socket?.remoteAddress || 'unknown').slice(0, 64);
    const release = gate.acquire(account.id, ip);
    if (!release) return reject(socket, '429 Too Many Requests');
    socket.once('close', release);
    wss.handleUpgrade(request, socket, head, ws => {
      const peer = { id: randomUUID().slice(0, 8), account: { id: account.id, username: account.username, unlimited: !!account.unlimited }, send: text => ws.readyState === 1 && ws.send(text) };
      const handler = rooms.connect(peer);
      let alive = true;
      ws.on('pong', () => { alive = true; });
      // Each ping also re-validates the session: logout/revocation closes the socket.
      const ping = setInterval(async () => {
        if (!alive) return ws.terminate(); alive = false; try { ws.ping(); } catch {}
        try { const current = await accounts.session(token); if (!current || current.id !== account.id) ws.close(4001, 'session'); } catch {}
      }, pingMs);
      ws.on('message', (data, isBinary) => handler.message(isBinary ? data : data.toString('utf8'), isBinary));
      ws.on('close', () => { clearInterval(ping); release(); handler.close(); });
      ws.on('error', () => {});
      peer.send(JSON.stringify({ t: 'hello', you: peer.id, name: account.username, canHost: !!account.unlimited }));
    });
  });
  return { stats: () => ({ ...rooms.stats(), connections: gate.stats().total }) };
}
