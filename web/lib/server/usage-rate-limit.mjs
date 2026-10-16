// Bounded process-local protection. The reverse proxy must also limit requests.
// Keys: 'user:<id>' (authenticated, own per-account budget, never hit by the anonymous
// global cap), 'ip:<addr>' (per-IP cap for cookieless/anonymous traffic) and any other
// key (anonymous visitor). Each endpoint gets its own instance, so one cannot starve another.
export function createUsageLimiter({ total = 2000, perKey = 30, perIp = 120, perUser = 60, maxUsers = 20000 } = {}) {
  let windowStart = 0, anon = 0;
  const keys = new Map();
  return (key, now = Date.now(), ip = null) => {
    if (now - windowStart >= 60000) { windowStart = now;anon = 0;keys.clear(); }
    const user = String(key).startsWith('user:');
    if (user) {
      const count = keys.get(key) || 0;
      if (count >= perUser || (!count && keys.size >= maxUsers)) return false;
      keys.set(key, count + 1);return true;
    }
    const count = keys.get(key) || 0, ipKey = ip ? 'ip:' + ip : null, ipCount = ipKey ? keys.get(ipKey) || 0 : 0;
    if (anon >= total || count >= perKey || ipCount >= perIp) return false;
    anon++;keys.set(key, count + 1);if (ipKey) keys.set(ipKey, ipCount + 1);return true;
  };
}
const state = globalThis[Symbol.for('labs.usage.limiters')] ||= {};
// allowUsageRequest(endpoint, key, ip?) — separate budgets per endpoint (play, usage, world...).
// Legacy one-argument calls ('checkout:...') use the prefix before ':' as the endpoint.
export function allowUsageRequest(endpoint, key, ip = null, now = Date.now()) {
  if (key === undefined) { key = endpoint;endpoint = String(key).split(':')[0] || 'default'; }
  return (state[endpoint] ||= createUsageLimiter())(key, now, ip);
}
