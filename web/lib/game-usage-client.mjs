import { HEARTBEAT_MS } from './usage-policy.mjs';

/** Optional, first-party metrics. No account data, saves, IP or fingerprint sent. */
export function createGameUsage({ game, enabled, fetcher = fetch, doc = document, win = window }) {
  const session = crypto.randomUUID();
  let running = false, disposed = false, allowed = false, lastSentActive = false;
  let pending = Promise.resolve();
  const readConsent = () => {
    try { return win.localStorage.getItem('labs-privacy-v2') === 'accepted'; } catch { return false; }
  };
  const send = (active) => {
    if (!enabled || disposed && active || !allowed && !lastSentActive) return;
    // Preserve start/pause ordering even on a slow connection.
    lastSentActive = active;
    pending = pending.catch(() => {}).then(() => {
      if (active && (!allowed || disposed)) return;
      return fetcher('/api/game-usage', {
      method: 'POST', credentials: 'same-origin', keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game, session, active }),
      });
    }).then(() => {}).catch(() => {});
  };
  const refresh = () => {
    const active = allowed && running && !doc.hidden;
    if (active || lastSentActive) send(active);
  };
  const consent = () => { allowed = readConsent(); refresh(); };
  const hide = () => { if (lastSentActive) send(false); };
  allowed = readConsent();
  doc.addEventListener('visibilitychange', refresh);
  win.addEventListener('labs-privacy-change', consent);
  win.addEventListener('pagehide', hide);
  const timer = win.setInterval(refresh, HEARTBEAT_MS);
  return {
    state(active) { if (running === active) return; running = active; refresh(); },
    dispose() {
      hide(); disposed = true; win.clearInterval(timer);
      doc.removeEventListener('visibilitychange', refresh);
      win.removeEventListener('labs-privacy-change', consent);
      win.removeEventListener('pagehide', hide);
    },
  };
}
