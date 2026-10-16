"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BadgeCheck, LockKeyhole, MailCheck, ShoppingBag, Ticket } from 'lucide-react';
import { PasswordInput } from '@/components/password-input';
import { Brand, SiteFooter } from '@/components/site-header';
import { api } from '@/components/admin-shell';
import { paymentsEnabled } from '@/lib/site-config';

type Product = { code: string; title: string; description: string; price: string; grants: string[] };
type Me = { account: { id: string; username: string; unlimited: boolean; cloudSave: boolean; entitlements?: { outfits: string[] } } | null };
type Order = { orderId: string; status: string; product: string; username?: string; needsPassword: boolean };
type Result = { url: string; free?: boolean; guest?: boolean };
const shortTitle = (t: string) => { const short = t.replace('Vale dos Blocos · ', ''); return short.charAt(0).toUpperCase() + short.slice(1); };
const RETURN: Record<string, string> = { 'vale-completo': '/jogos/vale-dos-blocos', 'vale-aparencias-expedicao': '/jogos/vale-dos-blocos', 'vale-nuvem': '/jogos/vale-dos-blocos' };
const input = 'mt-2 block min-h-12 w-full rounded-lg border border-white/15 bg-[#0B0B10] px-3 text-base text-white placeholder:text-zinc-400 focus:border-[#C6FF00] focus:outline-none focus:ring-2 focus:ring-[#C6FF00]/30';
const primary = 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#C6FF00] px-5 text-base font-semibold text-[#0B0B10] transition-[transform,background-color] duration-200 hover:bg-[#d5ff4a] active:translate-y-px disabled:opacity-50';
const link = 'font-semibold text-[#C6FF00] underline-offset-4 hover:underline';

/** One-page checkout. Without a session the buyer only types an e-mail: the account is created on the
 *  server and the password is chosen from the link sent after the payment is confirmed. */
export function CheckoutPage({ product }: { product: Product }) {
  const params = useSearchParams();
  const [me, setMe] = useState<Me | null>(null), [mode, setMode] = useState<'guest' | 'login'>('guest');
  const [coupon, setCoupon] = useState(params.get('cupom')?.toUpperCase() || ''), [email, setEmail] = useState(''), [name, setName] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState<null | { guest: boolean; email: string }>(null);
  const errorBox = error && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>;
  const [order, setOrder] = useState<Order | null>(null), [newPassword, setNewPassword] = useState(''), [confirm, setConfirm] = useState('');
  const load = () => api<Me>('/api/account/me').then(setMe).catch(() => setMe({ account: null }));
  useEffect(() => { void load(); }, []);
  // Follows this browser's order (from the return URL or the purchase cookie) until the payment is confirmed.
  useEffect(() => {
    let alive = true, timer: ReturnType<typeof setTimeout> | undefined, tries = 0;
    const qs = new URLSearchParams(); for (const k of ['pedido', 'payment_id', 'collection_id']) { const v = params.get(k); if (v) qs.set(k, v); }
    const poll = async () => {
      try { const d = await api<{ order: Order | null }>('/api/checkout/status' + (qs.size ? '?' + qs : '')); if (!alive) return; if (d.order && d.order.product === product.code) setOrder(d.order); if (d.order?.status === 'pending' && ++tries < 150) timer = setTimeout(poll, 4000); }
      catch { if (alive && ++tries < 150) timer = setTimeout(poll, 8000); }
    };
    void poll(); return () => { alive = false; clearTimeout(timer); };
  }, [params, product.code, done]);
  async function claim(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (newPassword !== confirm) { setError('As senhas precisam ser iguais.'); return; }
    setBusy(true);
    try { await api('/api/checkout/claim', 'POST', { pedido: order?.orderId, password: newPassword }); setNewPassword(''); setConfirm(''); setOrder(o => o && { ...o, needsPassword: false }); await load(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const claimForm = order && <form method="post" onSubmit={claim} className="space-y-4"><BadgeCheck className="size-8 text-[#C6FF00]" aria-hidden="true" /><h2 className="text-xl font-bold text-white">Pagamento confirmado</h2><p className="text-sm text-zinc-300">Crie sua senha para entrar e jogar agora. Seu usuário é <strong className="text-white">{order.username}</strong>.</p>
    <label className="block text-sm font-semibold text-zinc-200">Nova senha<PasswordInput required minLength={12} maxLength={128} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={input} /></label>
    <label className="block text-sm font-semibold text-zinc-200">Repita a senha<PasswordInput required minLength={12} maxLength={128} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={input} /></label>
    <p className="text-xs text-zinc-400">Mínimo de 12 caracteres.</p>{errorBox}<button disabled={busy} className={primary}>{busy ? 'Entrando…' : 'Criar senha e jogar'}</button></form>;
  const owned = !!me?.account && product.grants.every(g => g === 'unlimited' ? me.account!.unlimited : g === 'cloud' ? me.account!.cloudSave : g.startsWith('outfits:') ? (me.account!.entitlements?.outfits || []).includes(g.slice(8)) : false);
  const back = RETURN[product.code] || '/conta';
  const inputs = (fields: FormData) => ({ product: product.code, coupon: coupon.trim(), ...(me?.account ? {} : { email: String(fields.get('email') || email).trim() }) });

  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const fields = new FormData(event.currentTarget as HTMLFormElement);
    try { await api('/api/account/login', 'POST', { username: String(fields.get('username') || '').trim(), password: String(fields.get('password') || '') }); setPassword(''); await load(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function pay(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const fields = new FormData(event.currentTarget as HTMLFormElement), body = inputs(fields);
    try {
      const result = await api<Result>('/api/checkout', 'POST', body);
      if (result.free) { setBusy(false); setDone({ guest: !!result.guest, email: (body as { email?: string }).email || '' }); await load(); }
      else window.location.assign(result.url);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  const couponField = <label className="block text-sm font-semibold text-zinc-200"><span className="inline-flex items-center gap-2"><Ticket className="size-4 text-[#C6FF00]" aria-hidden="true" />Cupom, se tiver</span><input value={coupon} onChange={e => setCoupon(e.target.value.toUpperCase())} maxLength={32} placeholder="Opcional" autoCapitalize="characters" spellCheck={false} className={`${input} font-mono uppercase`} /></label>;

  return <div className="flex min-h-screen flex-col bg-[#0B0B10] text-zinc-100">
    <header className="border-b border-white/10"><div className="mx-auto flex min-h-16 max-w-3xl items-center justify-between px-5 sm:px-8"><Brand /><span className="inline-flex items-center gap-2 text-sm text-zinc-400"><LockKeyhole className="size-4" aria-hidden="true" />Pagamento seguro pelo Mercado Pago</span></div></header>
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8">
      {!paymentsEnabled ? <p className="text-zinc-300">Pagamentos ainda não estão disponíveis.</p> : <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl bg-[#15151D] p-6" aria-label="Produto">
          <p className="text-xs text-zinc-400">Vale dos Blocos</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">{shortTitle(product.title)}</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">{product.description}</p>
          <p className="mt-6 text-3xl font-bold tabular-nums text-white">{product.price}</p>
          <p className="mt-1 text-sm text-zinc-400">Pagamento único. Pix, cartão ou saldo no Mercado Pago.</p>
        </section>
        <section className="rounded-2xl bg-[#15151D] p-6" aria-live="polite">
          {me === null ? <p className="text-sm text-zinc-400">Carregando…</p>
          : order?.status === 'approved' && order.needsPassword && !me.account ? claimForm
          : order?.status === 'pending' && !me.account ? <div><MailCheck className="size-8 text-[#C6FF00]" aria-hidden="true" /><h2 className="mt-3 text-xl font-bold text-white">Aguardando o pagamento</h2><p className="mt-2 text-sm text-zinc-300">Esta tela atualiza sozinha. Assim que o Mercado Pago confirmar, você cria sua senha aqui mesmo e entra no jogo. Pix costuma levar segundos.</p><p className="mt-4 text-xs text-zinc-400">Se fechar esta tela, o link para criar a senha também chega no seu e-mail.</p></div>
          : done && !(done.guest && !me.account) ? <div><BadgeCheck className="size-8 text-[#C6FF00]" aria-hidden="true" /><h2 className="mt-3 text-xl font-bold text-white">Liberado</h2>{done.guest ? <p className="mt-2 text-sm text-zinc-300">Enviamos um e-mail para <strong className="text-white">{done.email}</strong> com o link para você criar sua senha. Depois é só entrar e jogar.</p> : <><p className="mt-2 text-sm text-zinc-300">O benefício já está na conta <strong className="text-white">{me.account?.username}</strong>.</p><Link href={back} className={`${primary} mt-6`}>Jogar agora</Link></>}</div>
          : owned ? <div><BadgeCheck className="size-8 text-[#C6FF00]" aria-hidden="true" /><h2 className="mt-3 text-xl font-bold text-white">{order?.status === 'approved' ? 'Tudo pronto' : 'Você já tem este item'}</h2><p className="mt-2 text-sm text-zinc-300">Entre no jogo com a conta <strong className="text-white">{me.account?.username}</strong> e aproveite.</p><Link href={back} className={`${primary} mt-6`}>Jogar agora</Link></div>
          : done?.guest && !me.account ? <div><MailCheck className="size-8 text-[#C6FF00]" aria-hidden="true" /><h2 className="mt-3 text-xl font-bold text-white">Quase lá</h2><p className="mt-2 text-sm text-zinc-300">Assim que o pagamento for confirmado, você recebe um e-mail com o link para criar sua senha. Pix costuma levar segundos; boleto pode levar dias. Confira também a caixa de spam.</p><p className="mt-4 text-sm text-zinc-400">Já tem senha? <Link href={`/conta/entrar?next=${encodeURIComponent(back)}`} className={link}>Entrar</Link></p></div>
          : !me.account && mode === 'login' ? <form method="post" onSubmit={login} className="space-y-4">
              <h2 className="text-xl font-bold text-white">Entrar na conta</h2>
              <label className="block text-sm font-semibold text-zinc-200">Usuário<input name="username" required autoComplete="username" value={name} onChange={e => setName(e.target.value)} className={input} /></label>
              <label className="block text-sm font-semibold text-zinc-200">Senha<PasswordInput name="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={input} /></label>
              {errorBox}
              <button disabled={busy} className={primary}>{busy ? 'Entrando…' : 'Entrar e continuar'}</button>
              <p className="text-sm text-zinc-400"><button type="button" onClick={() => { setMode('guest'); setError(''); }} className={link}>Comprar só com o e-mail</button>. <Link href="/conta/recuperar" className={link}>Esqueci a senha</Link></p>
            </form>
          : !me.account ? <form method="post" onSubmit={pay} className="space-y-4">
              <h2 className="text-xl font-bold text-white">Finalizar compra</h2>
              <p className="text-sm text-zinc-400">Só precisamos do seu e-mail. Depois do pagamento você recebe o link para criar sua senha e entrar no jogo.</p>
              <label className="block text-sm font-semibold text-zinc-200">Seu e-mail<input name="email" type="email" required autoComplete="email" inputMode="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className={input} /></label>
              {couponField}
              {errorBox}
              <button disabled={busy} className={primary}><ShoppingBag className="size-4" aria-hidden="true" />{busy ? 'Abrindo pagamento…' : `Pagar ${product.price}`}</button>
              <p className="text-sm text-zinc-400">Já tem conta? <button type="button" onClick={() => { setMode('login'); setError(''); }} className={link}>Entrar</button></p>
              <p className="text-xs text-zinc-400">Com cupom, o valor final aparece na tela do Mercado Pago. Cupom de 100% libera na hora, sem cobrança. Compras de menores devem ser feitas pelos responsáveis. Ao comprar você aceita os <Link href="/termos" className="underline">termos</Link>.</p>
            </form>
          : <form method="post" onSubmit={pay} className="space-y-4">
              <h2 className="text-xl font-bold text-white">Finalizar compra</h2>
              <p className="text-sm text-zinc-400">Comprando como <strong className="text-white">{me.account.username}</strong>.</p>
              {couponField}
              {errorBox}
              <button disabled={busy} className={primary}><ShoppingBag className="size-4" aria-hidden="true" />{busy ? 'Abrindo pagamento…' : `Pagar ${product.price}`}</button>
              <p className="text-xs text-zinc-400">Com cupom, o valor final aparece na tela do Mercado Pago. Cupom de 100% libera na hora, sem cobrança. Compras de menores devem ser feitas pelos responsáveis.</p>
            </form>}
        </section>
      </div>}
      <p className="mt-8 text-sm text-zinc-400"><Link href={back} className="underline-offset-4 hover:underline">Voltar ao jogo</Link></p>
    </main>
    <SiteFooter />
  </div>;
}
