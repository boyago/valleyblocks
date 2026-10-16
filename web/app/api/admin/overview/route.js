import { getDatabase, getUsageStore } from '@/lib/server/usage-store.mjs';
import { json } from '@/lib/server/usage-http.mjs';
import { requireAccount, authError } from '@/lib/server/auth-http.mjs';
import { ACTIVE_TTL_MS, dayKey } from '@/lib/usage-policy.mjs';
import { ensurePlaySchema } from '@/lib/server/play-store.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRange } from '@/lib/server/admin-range.mjs';

let titles = null;
const gameTitles = () => titles ||= (() => { try { return Object.fromEntries(JSON.parse(readFileSync(join(process.cwd(), 'content', 'catalogo.json'), 'utf8')).jogos?.map(g => [g.slug, g.nome]) || []); } catch { return {}; } })();
export const runtime = 'nodejs';

// Aggregated, admin-only operational snapshot. Returns counts and totals only:
// no e-mails, IPs, snapshots or tokens ever leave the database through here.
export async function GET(request) {
  try {
    await requireAccount(request, 'admin');
    const db = await getDatabase(), now = Date.now(), today = dayKey(now), range = parseRange(new URL(request.url).searchParams, now);
    await ensurePlaySchema(db);
    const n = v => Number(v || 0);
    const [accounts] = await db.query('SELECT COUNT(*) AS total, SUM(CASE WHEN password_hash IS NULL THEN 0 ELSE 1 END) AS activated, SUM(unlimited) AS unlimited, SUM(disabled) AS disabled, SUM(CASE WHEN role=\'admin\' THEN 1 ELSE 0 END) AS admins FROM labs_accounts');
    const [cloud] = await db.query('SELECT COUNT(*) AS enabled FROM labs_cloud_access WHERE enabled=1');
    const [invites] = await db.query('SELECT COUNT(*) AS pending FROM labs_account_invites WHERE used_at IS NULL AND expires_at>?', [now]);
    const [worlds] = await db.query('SELECT COUNT(*) AS total, COALESCE(SUM(LENGTH(snapshot)),0) AS bytes, MAX(saved_at) AS last_saved FROM labs_worlds WHERE snapshot IS NOT NULL');
    const [playNow] = await db.query('SELECT SUM(CASE WHEN owner_id LIKE \'user:%\' THEN 1 ELSE 0 END) AS accounts, SUM(CASE WHEN owner_id LIKE \'guest:%\' THEN 1 ELSE 0 END) AS visitors FROM labs_play_sessions WHERE active=1 AND updated_at>?', [now - ACTIVE_TTL_MS]);
    const [playToday] = await db.query('SELECT SUM(CASE WHEN owner_id LIKE \'user:%\' THEN used_ms ELSE 0 END) AS account_ms, SUM(CASE WHEN owner_id LIKE \'guest:%\' THEN used_ms ELSE 0 END) AS visitor_ms, SUM(CASE WHEN owner_id LIKE \'user:%\' THEN 1 ELSE 0 END) AS accounts, SUM(CASE WHEN owner_id LIKE \'guest:%\' THEN 1 ELSE 0 END) AS visitors FROM labs_play_daily WHERE day_key=?', [today]);
    const playDays = await db.query('SELECT day_key, SUM(CASE WHEN owner_id LIKE \'user:%\' THEN used_ms ELSE 0 END) AS account_ms, SUM(CASE WHEN owner_id LIKE \'guest:%\' THEN used_ms ELSE 0 END) AS visitor_ms, SUM(CASE WHEN owner_id LIKE \'user:%\' THEN 1 ELSE 0 END) AS accounts, SUM(CASE WHEN owner_id LIKE \'guest:%\' THEN 1 ELSE 0 END) AS visitors FROM labs_play_daily GROUP BY day_key ORDER BY day_key DESC LIMIT 7');
    // Range data comes from labs_play_stats (per game, 400 days); labs_play_daily only keeps 3 days.
    const rangeDays = await db.query(`SELECT day_key, SUM(CASE WHEN owner_id LIKE 'user:%' THEN used_ms ELSE 0 END) AS account_ms, SUM(CASE WHEN owner_id LIKE 'user:%' THEN 0 ELSE used_ms END) AS visitor_ms, COUNT(DISTINCT CASE WHEN owner_id LIKE 'user:%' THEN owner_id END) AS accounts, COUNT(DISTINCT CASE WHEN owner_id LIKE 'user:%' THEN NULL ELSE owner_id END) AS visitors, SUM(starts) AS starts FROM labs_play_stats WHERE day_key>=? AND day_key<=? GROUP BY day_key ORDER BY day_key`, [range.from, range.to]);
    const rangeGames = await db.query(`SELECT game, SUM(used_ms) AS ms, SUM(starts) AS starts, COUNT(DISTINCT owner_id) AS players, COUNT(DISTINCT CASE WHEN owner_id LIKE 'user:%' THEN owner_id END) AS accounts FROM labs_play_stats WHERE day_key>=? AND day_key<=? GROUP BY game`, [range.from, range.to]);
    const [rangeTotal] = await db.query(`SELECT COUNT(DISTINCT owner_id) AS players, COUNT(DISTINCT CASE WHEN owner_id LIKE 'user:%' THEN owner_id END) AS accounts, COALESCE(SUM(used_ms),0) AS ms, COALESCE(SUM(starts),0) AS starts FROM labs_play_stats WHERE day_key>=? AND day_key<=?`, [range.from, range.to]);
    const fromMs = Date.parse(range.from + 'T00:00:00-03:00'), toMs = Date.parse(range.to + 'T00:00:00-03:00') + 86400000;
    const [newAccounts] = await db.query('SELECT COUNT(*) AS total FROM labs_accounts WHERE created_at>=? AND created_at<?', [fromMs, toMs]);
    let revenue = null;
    try { const [r] = await db.query("SELECT COALESCE(SUM(amount_cents),0) AS cents, COUNT(*) AS orders FROM labs_orders WHERE status='approved' AND updated_at>=? AND updated_at<?", [fromMs, toMs]); revenue = { cents: n(r?.cents), orders: n(r?.orders) }; } catch { /* pagamentos ainda não criados */ }
    const audit = await db.query('SELECT l.action, l.created_at, a.username AS actor, t.username AS target FROM labs_account_audit l LEFT JOIN labs_accounts a ON a.id=l.actor_id LEFT JOIN labs_accounts t ON t.id=l.account_id ORDER BY l.created_at DESC LIMIT 20');
    const store = await getUsageStore();
    const usage = store ? await store.report(now) : null;
    return json({
      generatedAt: new Date(now).toISOString(), today, timezone: 'America/Sao_Paulo', range,
      period: {
        players: n(rangeTotal?.players), accounts: n(rangeTotal?.accounts), visitors: n(rangeTotal?.players) - n(rangeTotal?.accounts), minutes: Math.floor(n(rangeTotal?.ms) / 60000), sessions: n(rangeTotal?.starts), newAccounts: n(newAccounts?.total), revenue,
        days: rangeDays.map(r => ({ day: r.day_key, accountMinutes: Math.floor(n(r.account_ms) / 60000), visitorMinutes: Math.floor(n(r.visitor_ms) / 60000), accounts: n(r.accounts), visitors: n(r.visitors), sessions: n(r.starts) })),
        games: rangeGames.map(r => ({ game: r.game, title: gameTitles()[r.game] || r.game, minutes: Math.round(n(r.ms) / 60000), sessions: n(r.starts), players: n(r.players), accounts: n(r.accounts) })).sort((a, b) => b.minutes - a.minutes || b.players - a.players),
      },
      accounts: { total: n(accounts?.total), activated: n(accounts?.activated), unlimited: n(accounts?.unlimited), disabled: n(accounts?.disabled), admins: n(accounts?.admins), cloud: n(cloud?.enabled), invitesPending: n(invites?.pending) },
      worlds: { total: n(worlds?.total), bytes: n(worlds?.bytes), lastSavedAt: worlds?.last_saved ? new Date(n(worlds.last_saved)).toISOString() : null },
      playingNow: { accounts: n(playNow?.accounts), visitors: n(playNow?.visitors) },
      playToday: { accountMinutes: Math.floor(n(playToday?.account_ms) / 60000), visitorMinutes: Math.floor(n(playToday?.visitor_ms) / 60000), accounts: n(playToday?.accounts), visitors: n(playToday?.visitors) },
      playDays: playDays.map(r => ({ day: r.day_key, accountMinutes: Math.floor(n(r.account_ms) / 60000), visitorMinutes: Math.floor(n(r.visitor_ms) / 60000), accounts: n(r.accounts), visitors: n(r.visitors) })),
      audit: audit.map(r => ({ action: r.action, at: new Date(n(r.created_at)).toISOString(), actor: r.actor || '—', target: r.target || '—' })),
      usage: usage ? { active: usage.active.map(r => ({ game: r.game, players: n(r.players) })), days: usage.days.map(r => ({ day: r.day_key, game: r.game, browsers: n(r.browsers), sessions: n(r.sessions), minutes: Math.floor(n(r.active_ms) / 60000) })) } : null,
      payments: { integrated: false },
    });
  } catch (error) { return authError(error); }
}
