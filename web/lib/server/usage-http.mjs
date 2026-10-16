import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Jogos publicados (status "disponivel") do catálogo. Lido uma vez; o servidor roda na raiz do site.
let gameSlugs = null;
export function knownGames() {
  if (gameSlugs) return gameSlugs;
  try {
    const catalog = JSON.parse(readFileSync(join(process.cwd(), 'content', 'catalogo.json'), 'utf8'));
    gameSlugs = new Set(catalog.jogos.filter(g => g.status === 'disponivel' && /^[a-z0-9-]{1,64}$/.test(g.slug)).map(g => g.slug));
  } catch { gameSlugs = new Set(['vale-dos-blocos']); }
  return gameSlugs;
}
const COOKIE = 'labs_usage';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function secureEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function parseUsageBody(body) {
  if (!body || typeof body.game !== 'string' || !knownGames().has(body.game) || !UUID.test(body.session) || typeof body.active !== 'boolean') throw new Error('Invalid usage event');
  return { game: body.game, session: body.session, active: body.active };
}
export function identifyVisitor(request, secret, cookieName = COOKIE) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Usage secret is not configured');
  const mac = value => createHmac('sha256', secret).update(value).digest('hex');
  const value = (request.headers.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || '';
  const [id, signature] = value.split('.');
  const valid = /^[a-f0-9]{48}$/.test(id || '') && secureEqual(signature, mac(`${cookieName}:cookie:${id}`));
  const visitor = valid ? id : randomBytes(24).toString('hex');
  const cookie = valid ? null : `${cookieName}=${visitor}.${mac(`${cookieName}:cookie:${visitor}`)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  return { hash: mac(`${cookieName}:visitor:${visitor}`), cookie };
}
// Guest quota owner derived from the trusted client IP (HMAC, never stored in clear).
export function ipGuestOwner(ip, secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Usage secret is not configured');
  return 'ipguest:' + createHmac('sha256', secret).update('ipguest:' + String(ip)).digest('hex').slice(0, 64);
}
export function json(body, status = 200, cookie = null) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return Response.json(body, { status, headers });
}
