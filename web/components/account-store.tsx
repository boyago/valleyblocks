"use client";
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BadgeCheck, Clock, ShoppingBag, XCircle } from 'lucide-react';
import { api, ErrorBox, btn } from '@/components/admin-shell';
import { paymentsEnabled } from '@/lib/site-config';

type Product = { code: string; title: string; description: string; price: string; grants: string[] };
type Order = { id: string; product: string; title: string; amountCents: number; status: string; coupon?: string | null; createdAt: string; updatedAt: string };
const STATUS: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  approved: { label: 'Pago', icon: <BadgeCheck className="size-4" aria-hidden="true" />, cls: 'text-[#C6FF00]' },
  pending: { label: 'Aguardando pagamento', icon: <Clock className="size-4" aria-hidden="true" />, cls: 'text-zinc-300' },
  rejected: { label: 'Recusado', icon: <XCircle className="size-4" aria-hidden="true" />, cls: 'text-red-300' },
  cancelled: { label: 'Cancelado', icon: <XCircle className="size-4" aria-hidden="true" />, cls: 'text-zinc-400' },
  refunded: { label: 'Reembolsado', icon: <XCircle className="size-4" aria-hidden="true" />, cls: 'text-amber-300' },
};
const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function AccountStore({ unlimited, cloudSave }: { unlimited: boolean; cloudSave: boolean }) {
  const params = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]), [orders, setOrders] = useState<Order[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(''), [loaded, setLoaded] = useState(false), [coupon, setCoupon] = useState('');
  useEffect(() => {
    if (!paymentsEnabled) return;
    const pedido = params.get('pedido');
    api<{ products: Product[]; orders: Order[] }>('/api/orders' + (pedido ? `?pedido=${encodeURIComponent(pedido)}` : '')).then(d => { setProducts(d.products); setOrders(d.orders); }).catch(e => setError((e as Error).message)).finally(() => setLoaded(true));
  }, [params]);
  function buy(code: string) { window.location.assign(`/comprar/${code}` + (coupon.trim() ? `?cupom=${encodeURIComponent(coupon.trim())}` : '')); }
  if (!paymentsEnabled) return null;
  const owned = (p: Product) => p.grants.every(g => g === 'unlimited' ? unlimited : g === 'cloud' ? cloudSave : orders.some(o => o.product === p.code && o.status === 'approved'));
  return <section id="loja" className="scroll-mt-24 space-y-4 rounded-2xl border border-[#C6FF00]/30 bg-[#15151D] p-6">
    <h2 className="flex items-center gap-2 text-lg font-bold text-white"><ShoppingBag className="size-5 text-[#C6FF00]" aria-hidden="true" />Loja · ValleyBlocks</h2>
    <p className="text-sm text-zinc-400">Pagamento por Pix, cartão ou saldo no Mercado Pago. O benefício é liberado automaticamente assim que o pagamento é confirmado; Pix costuma levar segundos, boleto pode levar dias.</p>
    <div className="flex flex-wrap items-end gap-3"><label className="text-sm font-semibold text-zinc-200">Tem um cupom?<input value={coupon} onChange={e => setCoupon(e.target.value.toUpperCase())} maxLength={32} placeholder="CÓDIGO" autoCapitalize="characters" spellCheck={false} className="mt-1 block min-h-10 w-44 rounded-lg border border-white/15 bg-[#0B0B10] text-white px-3 font-mono text-sm uppercase placeholder:text-zinc-400 focus:border-[#C000FF] focus:outline-none" /></label><p className="text-xs text-zinc-400">O desconto é aplicado ao clicar em comprar.</p></div>
    <ErrorBox message={error} />
    {!loaded ? <p className="text-sm text-zinc-400">Carregando…</p> : <div className="grid gap-3 sm:grid-cols-2">{products.map(p => <article key={p.code} className={`rounded-xl border p-4 ${owned(p) ? 'border-[#C6FF00]/40 bg-[#C6FF00]/5' : 'border-white/10 bg-white/5'}`}><h3 className="font-bold text-white">{p.title}</h3><p className="mt-1 text-sm text-zinc-400">{p.description}</p><div className="mt-3 flex items-center justify-between gap-3"><span className="text-xl font-black text-white">{p.price}</span>{owned(p) ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#C6FF00]"><BadgeCheck className="size-4" aria-hidden="true" />Liberado</span> : <button disabled={!!busy} onClick={() => buy(p.code)} className={`${btn.primary} min-h-10 px-4 text-sm`}>{busy === p.code ? 'Abrindo…' : 'Comprar'}</button>}</div></article>)}</div>}
    {orders.length > 0 && <div><h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Meus pedidos</h3><ul className="mt-2 divide-y divide-white/10 text-sm">{orders.map(o => { const s = STATUS[o.status] || STATUS.pending; return <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="text-zinc-200">{o.title} · {money(o.amountCents)}{o.coupon ? ` · cupom ${o.coupon}` : ''}</span><span className={`inline-flex items-center gap-1 font-semibold ${s.cls}`}>{s.icon}{s.label}<time className="ml-2 text-xs font-normal text-zinc-400">{new Date(o.createdAt).toLocaleDateString('pt-BR')}</time></span></li>; })}</ul></div>}
    <p className="text-xs text-zinc-400">Dúvidas ou reembolso: fale com o responsável pela página de contato. Compras de menores de idade devem ser feitas pelos responsáveis.</p>
  </section>;
}
