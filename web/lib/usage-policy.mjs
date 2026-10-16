// Shared policy for the next account/quota rollout. These values do not activate
// a paywall; activation depends on verified accounts and server persistence.
export const DAILY_SECONDS = Object.freeze({ visitor: 15 * 60, account: 60 * 60 });
export const HEARTBEAT_MS = 15_000;
export const ACTIVE_TTL_MS = 45_000;
export const RETENTION_DAYS = 30;
const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
export function dayKey(ms) {
  const parts = Object.fromEntries(dateFormat.formatToParts(ms).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function remainingSeconds(kind, usedSeconds) {
  if (!Object.hasOwn(DAILY_SECONDS, kind)) throw new Error('Unknown account kind');
  return Math.max(0, DAILY_SECONDS[kind] - Math.max(0, Number(usedSeconds) || 0));
}

function splitDays(from, to) {
  if (to <= from) return [];
  const day = dayKey(from), endDay = dayKey(to);
  if (day === endDay) return [{ day, ms: to - from }];
  let low = from, high = to;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (dayKey(middle) === day) low = middle; else high = middle;
  }
  return [{ day, ms: high - from }, { day: endDay, ms: to - high }].filter(p => p.ms > 0);
}

/** Server-clock accounting; never accepts elapsed time or account type from a client. */
export function advanceSession(previous, input, now) {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid server time');
  const fresh = previous && now - Number(previous.updated_at) < ACTIVE_TTL_MS;
  const same = previous?.session_id === input.session;
  if (previous && !same && previous.active && fresh) return { accepted: false, segments: [] };
  // An old tab closing must not deactivate the new tab's session.
  if (!same && !input.active) return { accepted: false, segments: [] };
  const newSession = !same;
  const from = Number(previous?.updated_at || now);
  const end = Math.max(from, now);
  // Missing heartbeats cannot add an unbounded interval after browser/process loss.
  const creditedEnd = Math.min(end, from + HEARTBEAT_MS * 2);
  const segments = previous?.active ? splitDays(from, creditedEnd) : [];
  return { accepted: true, newSession, segments, row: {
    session_id: input.session, active: input.active ? 1 : 0,
    updated_at: end, game: input.game,
  } };
}
