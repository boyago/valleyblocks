// Conta LABSGames na tela inicial.
// - No portal (iframe): quem cuida do login é o site. O jogo só mostra quem entrou e,
//   se ninguém entrou, pede ao portal para abrir /conta/entrar e voltar ao jogo.
// - No app (Capacitor): login próprio em /api/app, com token guardado no aparelho e
//   enviado em Authorization: Bearer. A senha nunca é guardada.
const API = import.meta.env?.VITE_LABS_API || 'https://labsgames.cloud';
const TOKEN_KEY = 'vb-account-token';
const store = {
  get() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set(v) { try { if (v) localStorage.setItem(TOKEN_KEY, v); else localStorage.removeItem(TOKEN_KEY); } catch { /* sem armazenamento: vale só nesta sessão */ } },
};

export function createAccount({ bridge, native, fetch: request = (...a) => fetch(...a) }) {
  const listeners = new Set();
  const state = { mode: native ? 'app' : bridge.standalone ? 'none' : 'portal', available: false, username: null, outfits: [], busy: false, error: '' };
  let token = native ? store.get() : null;
  const emit = () => listeners.forEach(fn => fn(state));
  const apply = account => {
    state.username = typeof account?.username === 'string' ? account.username : null;
    state.outfits = Array.isArray(account?.entitlements?.outfits) ? account.entitlements.outfits.filter(id => typeof id === 'string') : [];
  };
  const call = async (path, { method = 'GET', body } = {}) => {
    const headers = { Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await request(`${API}/api/app/${path}`, { method, headers, body: body && JSON.stringify(body), cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Não foi possível falar com o servidor.');
    return data;
  };

  if (state.mode === 'app') state.available = true;
  if (state.mode === 'portal') bridge.on('account', msg => { apply(msg.account); emit(); });

  return {
    state,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** Dados que o portal manda no 'start'. */
    fromPortal(options) { if (state.mode !== 'portal') return; state.available = options?.accounts === true; if (options?.account) apply(options.account); },
    /** App: confere o token guardado. Sem internet, continua jogando sem conta. */
    async restore() {
      if (state.mode !== 'app' || !token) return;
      try { const data = await call('me'); apply(data.account); if (!data.account) { token = null; store.set(null); } }
      catch { /* offline: tenta de novo na próxima abertura */ }
      emit();
    },
    async login(username, password) {
      if (state.mode === 'portal') { bridge.login(); return { ok: true }; }
      if (state.mode !== 'app' || state.busy) return { ok: false };
      state.busy = true; state.error = ''; state.lastUser = String(username || '').trim(); emit();
      try {
        const data = await call('login', { method: 'POST', body: { username: String(username || '').trim(), password: String(password || '') } });
        token = data.token; store.set(token); apply(data.account);
        return { ok: true };
      } catch (error) { state.error = error.message; return { ok: false, message: error.message }; }
      finally { state.busy = false; emit(); }
    },
    async logout() {
      if (state.mode !== 'app') return;
      const old = token; token = null; store.set(null); apply(null); emit();
      if (old) { try { await request(`${API}/api/app/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${old}` }, body: '{}' }); } catch { /* a sessão expira sozinha */ } }
    },
    signupUrl: `${API}/conta/criar`,
  };
}
