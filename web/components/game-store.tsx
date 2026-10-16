"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Cloud, Infinity as InfinityIcon, Shirt, ShoppingBag } from 'lucide-react';
import { api } from '@/components/admin-shell';
import { paymentsEnabled } from '@/lib/site-config';

export type StoreProduct = { code: string; title: string; description: string; price: string; grants: string[] };
type Me = { account: { id: string; username: string; unlimited: boolean; cloudSave: boolean; entitlements?: { outfits: string[] } } | null };
const ICONS: Record<string, React.ReactNode> = {
  'vale-completo': <InfinityIcon className="size-6" aria-hidden="true" />,
  'vale-aparencias-expedicao': <Shirt className="size-6" aria-hidden="true" />,
  'vale-nuvem': <Cloud className="size-6" aria-hidden="true" />,
};
const title = (t: string) => { const short = t.replace('Vale dos Blocos · ', ''); return short.charAt(0).toUpperCase() + short.slice(1); };
const DETAILS: Record<string, string[]> = {
  'vale-completo': ['Jogue o tempo que quiser, todos os dias', 'Multiplayer: crie salas para até 4 jogadores', 'Mundo salvo na nuvem, até 4 MB', 'Continue em outro computador'],
  'vale-aparencias-expedicao': ['Acessórios modelados no Blender', 'Troque a aparência nas configurações do jogo', 'Vale em qualquer computador com a sua conta'],
  'vale-nuvem': ['Mundo salvo no servidor', 'Continue em outro computador', 'Mantém os 60 minutos por dia da conta'],
};

/** Store rendered on the game page itself. Prices come from the server; the buy button
 *  sends people without a session to the login page and brings them back here. */
export function GameStore({ products, returnTo }: { products: StoreProduct[]; returnTo: string }) {
  const [me, setMe] = useState<Me | null>(null), [error] = useState('');
  const coupon = '';
  const [pending, setPending] = useState<{ status: string; product: string; needsPassword: boolean } | null>(null);
  useEffect(() => { if (paymentsEnabled) api<Me>('/api/account/me').then(setMe).catch(() => setMe({ account: null })); }, []);
  // A purchase started in this browser without an account: offer to finish it (create the password).
  useEffect(() => { if (paymentsEnabled && me && !me.account) api<{ order: { status: string; product: string; needsPassword: boolean } | null }>('/api/checkout/status').then(d => setPending(d.order)).catch(() => {}); }, [me]);
  if (!paymentsEnabled) return null;
  const owned = (p: StoreProduct) => !!me?.account && p.grants.every(g => g === 'unlimited' ? me.account!.unlimited : g === 'cloud' ? me.account!.cloudSave : g.startsWith('outfits:') ? (me.account!.entitlements?.outfits || []).includes(g.slice(8)) : false);
  const loginUrl = `/conta/entrar?next=${encodeURIComponent(returnTo + '#loja')}`;
  void returnTo;
  function buy(code: string) { window.location.assign(`/comprar/${code}` + (coupon.trim() ? `?cupom=${encodeURIComponent(coupon.trim())}` : '')); }
  return <section id="loja" className="mt-14 scroll-mt-24 sm:mt-20" aria-labelledby="loja-titulo">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 id="loja-titulo" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Jogue sem limite e personalize seu Vale</h2><p className="mt-3 max-w-[60ch] text-base leading-relaxed text-zinc-300">Pagamento único por Pix, cartão ou saldo no Mercado Pago. O benefício entra na conta assim que o pagamento é confirmado. Compras de menores devem ser feitas pelos responsáveis.</p></div>
      <p className="text-sm text-zinc-300">{me?.account ? <>Comprando como <strong className="text-white">{me.account.username}</strong>. <Link href="/conta" className="font-semibold text-[#D86BFF] underline-offset-4 hover:underline">Minha conta</Link></> : <>Precisa de conta para comprar. <Link href={loginUrl} className="font-semibold text-[#D86BFF] underline-offset-4 hover:underline">Entrar</Link></>}</p>
    </div>
    {pending && (pending.status === 'pending' || pending.needsPassword) && <a href={`/comprar/${pending.product}`} className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-xl items-center justify-between gap-4 rounded-2xl bg-[#C6FF00] p-5 font-semibold text-[#0B0B10] shadow-[0_18px_40px_-12px_rgba(11,11,16,.5)]"><span>{pending.status === 'approved' ? 'Pagamento confirmado. Crie sua senha para jogar.' : 'Sua compra está aguardando o pagamento.'}</span><span className="underline">Continuar</span></a>}
    {error && <p role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="mt-6 grid gap-5 md:grid-cols-3">{products.map(p => { const mine = owned(p), featured = p.code === 'vale-completo'; return <article key={p.code} className={`flex flex-col rounded-2xl p-6 transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-0.5 ${featured ? 'bg-surface-2 text-white ring-1 ring-[#C6FF00]/40 shadow-[0_24px_50px_-24px_rgba(151,0,255,.5)]' : 'bg-surface-2 text-white'}`}>
      {featured && <span className="mb-3 w-fit rounded-md bg-[#C6FF00] px-2 py-1 text-xs font-semibold text-[#0B0B10]">Mais completo</span>}
      <div className={`flex items-center gap-3 ${featured ? 'text-[#C6FF00]' : 'text-[#D86BFF]'}`}>{ICONS[p.code]}<h3 className={`text-lg font-semibold ${featured ? 'text-white' : 'text-white'}`}>{title(p.title)}</h3></div>
      <p className={`mt-2 text-sm leading-6 ${featured ? 'text-zinc-300' : 'text-zinc-300'}`}>{p.description}</p>
      <ul className={`mt-4 space-y-1.5 text-sm ${featured ? 'text-zinc-200' : 'text-zinc-300'}`}>{(DETAILS[p.code] || []).map(d => <li key={d} className="flex items-start gap-2"><BadgeCheck className={`mt-0.5 size-4 shrink-0 ${featured ? 'text-[#C6FF00]' : 'text-[#D86BFF]'}`} aria-hidden="true" />{d}</li>)}</ul>
      <div className="mt-auto flex items-center justify-between gap-3 pt-6"><span className="text-2xl font-bold tabular-nums">{p.price}</span>{mine ? <span className={`inline-flex items-center gap-1 text-sm font-bold ${featured ? 'text-[#C6FF00]' : 'text-[#D86BFF]'}`}><BadgeCheck className="size-4" aria-hidden="true" />Liberado</span> : <button type="button" onClick={() => buy(p.code)} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-[transform,background-color] duration-200 active:translate-y-px disabled:opacity-50 ${featured ? 'bg-[#C6FF00] text-[#0B0B10] hover:bg-[#d5ff4a]' : 'bg-white/10 text-white hover:bg-white/15'}`}><ShoppingBag className="size-4" aria-hidden="true" />Comprar</button>}</div>
    </article>; })}</div>
  </section>;
}
