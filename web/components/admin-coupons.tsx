"use client";
import { useEffect, useState } from 'react';
import { Ticket } from 'lucide-react';
import { api, ErrorBox, Panel, btn, input } from '@/components/admin-shell';

type Coupon = { code: string; percentOff: number; product: string | null; productTitle: string; maxUses: number; uses: number; expiresAt: string | null; disabled: boolean; note: string; createdAt: string };
type Product = { code: string; title: string; price: string };

/** Admin: create and disable discount coupons. A 100% coupon releases the order without the payment provider. */
export function AdminCoupons({ products }: { products: Product[] }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState('');
  const [code, setCode] = useState(''), [percent, setPercent] = useState('100'), [product, setProduct] = useState(''), [maxUses, setMaxUses] = useState('1'), [days, setDays] = useState('30'), [note, setNote] = useState('');
  async function load() { try { setCoupons((await api<{ coupons: Coupon[] }>('/api/admin/coupons')).coupons); } catch (e) { setError((e as Error).message); } }
  useEffect(() => { void load(); }, []);
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setDone('');
    try {
      const expiresAt = Number(days) > 0 ? new Date(Date.now() + Number(days) * 86400000).toISOString() : null;
      const result = await api<{ coupon: Coupon }>('/api/admin/coupons', 'POST', { code, percentOff: Number(percent), product: product || null, maxUses: Number(maxUses), expiresAt, note });
      setDone(`Cupom ${result.coupon.code} criado: ${result.coupon.percentOff}% em ${result.coupon.productTitle.toLowerCase()}.`); setCode(''); setNote(''); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function toggle(c: Coupon) { setBusy(true); setError(''); try { await api('/api/admin/coupons', 'PATCH', { code: c.code, disabled: !c.disabled }); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  const status = (c: Coupon) => c.disabled ? 'Desligado' : c.uses >= c.maxUses ? 'Esgotado' : c.expiresAt && new Date(c.expiresAt) < new Date() ? 'Vencido' : 'Ativo';
  return <div className="grid gap-6 xl:grid-cols-3">
    <Panel title="Novo cupom" description="Use 100% para liberar um benefício sem cobrança (família, amigos, testes). O código vale para quem o digitar na loja até esgotar os usos ou vencer.">
      <form method="post" onSubmit={create} className="space-y-3 text-sm">
        <label className="block font-bold text-zinc-200">Código<input required value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9-]{2,31}" placeholder="FAMILIA2026" className={`${input} font-mono uppercase`} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block font-bold text-zinc-200">Desconto (%)<input required type="number" min={1} max={100} value={percent} onChange={e => setPercent(e.target.value)} className={input} /></label>
          <label className="block font-bold text-zinc-200">Usos<input required type="number" min={1} max={10000} value={maxUses} onChange={e => setMaxUses(e.target.value)} className={input} /></label>
        </div>
        <label className="block font-bold text-zinc-200">Produto<select value={product} onChange={e => setProduct(e.target.value)} className={input}><option value="">Qualquer produto</option>{products.map(p => <option key={p.code} value={p.code}>{p.title} · {p.price}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block font-bold text-zinc-200">Validade (dias)<input type="number" min={0} max={3650} value={days} onChange={e => setDays(e.target.value)} className={input} /><span className="mt-1 block text-xs font-normal text-zinc-500">0 = sem vencimento</span></label>
          <label className="block font-bold text-zinc-200">Observação<input value={note} onChange={e => setNote(e.target.value)} maxLength={80} placeholder="Para o Arthur" className={input} /></label>
        </div>
        <ErrorBox message={error} />
        {done && <p role="status" className="rounded-lg border border-[#C6FF00]/30 bg-[#C6FF00]/10 p-3 text-sm text-zinc-100">{done}</p>}
        <button disabled={busy} className={btn.primary}><Ticket className="mr-2 size-4" aria-hidden="true" />Criar cupom</button>
      </form>
    </Panel>
    <Panel title="Cupons" className="xl:col-span-2"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-wider text-zinc-400"><tr><th className="py-2 pr-3">Código</th><th className="py-2 pr-3">Desconto</th><th className="py-2 pr-3">Produto</th><th className="py-2 pr-3">Usos</th><th className="py-2 pr-3">Vence</th><th className="py-2 pr-3">Situação</th><th className="py-2 text-right">Ações</th></tr></thead><tbody className="divide-y divide-white/10 text-zinc-300">
      {coupons.map(c => <tr key={c.code}><td className="py-2 pr-3 font-mono font-bold text-white">{c.code}{c.note && <span className="block font-sans text-xs font-normal text-zinc-500">{c.note}</span>}</td><td className="py-2 pr-3">{c.percentOff}%</td><td className="py-2 pr-3">{c.productTitle}</td><td className="py-2 pr-3 tabular-nums">{c.uses}/{c.maxUses}</td><td className="py-2 pr-3 whitespace-nowrap">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('pt-BR') : '—'}</td><td className="py-2 pr-3"><span className={status(c) === 'Ativo' ? 'text-[#C6FF00]' : 'text-zinc-500'}>{status(c)}</span></td><td className="py-2 text-right"><button disabled={busy} onClick={() => toggle(c)} className={`${btn.ghost} min-h-9 px-3 text-xs`}>{c.disabled ? 'Religar' : 'Desligar'}</button></td></tr>)}
      {coupons.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-zinc-500">Nenhum cupom ainda.</td></tr>}
    </tbody></table></div></Panel>
  </div>;
}
