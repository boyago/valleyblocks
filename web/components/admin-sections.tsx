"use client";
import { useEffect, useState } from 'react';
import { api, ErrorBox, PageTitle, Panel, Stat, btn } from '@/components/admin-shell';
import { ACTIONS, fmtBytes, fmtDate, useOverview } from '@/components/admin-overview';
import { AdminCoupons } from '@/components/admin-coupons';

type Order = { id: string; username: string; title: string; amountCents: number; status: string; providerStatus: string | null; paymentId: string | null; coupon?: string | null; createdAt: string; updatedAt: string };
type OrdersReport = { enabled: boolean; products: { code: string; title: string; price: string }[]; month?: { revenueCents: number; approved: number; refunded: number; pending: number }; total?: { revenueCents: number; orders: number }; byProduct?: { product: string; title: string; approved: number; revenueCents: number }[]; orders?: Order[]; page?: number; pageSize?: number };
const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ORDER_STATUS: Record<string, string> = { approved: 'Pago', pending: 'Pendente', rejected: 'Recusado', cancelled: 'Cancelado', refunded: 'Devolvido' };
export function AdminPayments() {
  const [data, setData] = useState<OrdersReport | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1), [confirm, setConfirm] = useState<{ id: string; action: 'refund' | 'delete' } | null>(null), [busy, setBusy] = useState(false);
  async function refresh(p = page) { setLoading(true); setError(''); try { setData(await api<OrdersReport>(`/api/admin/orders?page=${p}`)); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }
  useEffect(() => { void refresh(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  async function run(order: Order, action: 'refund' | 'delete') {
    setBusy(true); setError(''); setNotice('');
    try {
      if (action === 'refund') { const r = await api<{ status: string }>('/api/admin/orders', 'POST', { action: 'refund', id: order.id }); setNotice(r.status === 'refunded' ? `Devolução de ${money(order.amountCents)} para ${order.username} concluída. Os benefícios do pedido foram retirados.` : 'Devolução pedida ao Mercado Pago; a situação muda assim que ele confirmar.'); }
      else { await api('/api/admin/orders', 'DELETE', { id: order.id }); setNotice('Pedido excluído.'); }
      setConfirm(null); await refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const total = data?.total?.orders || 0, pageSize = data?.pageSize || 10, pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0, to = Math.min(total, page * pageSize);
  return <>
    <PageTitle title="Pagamentos" subtitle="Pedidos via Mercado Pago (Pix, cartão, saldo). Benefícios são liberados só após o servidor confirmar o pagamento na API do provedor."><button className={btn.ghost} onClick={() => refresh()} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</button></PageTitle>
    <ErrorBox message={error} />
    {notice && <p role="status" className="rounded-lg border border-[#C6FF00]/30 bg-[#C6FF00]/10 p-3 text-sm text-zinc-100">{notice}</p>}
    {data && !data.enabled && <Panel title="Pagamentos desligados" description="Ative LABS_PAYMENTS_ENABLED, LABS_MP_ACCESS_TOKEN e LABS_MP_WEBHOOK_SECRET no servidor e NEXT_PUBLIC_LABS_PAYMENTS_ENABLED no build. Enquanto isso, as liberações continuam manuais em Jogadores."><ul className="text-sm text-zinc-300">{data.products.map(p => <li key={p.code} className="flex justify-between border-b border-white/10 py-2"><span>{p.title}</span><strong className="text-white">{p.price}</strong></li>)}</ul></Panel>}
    {data?.enabled && data.month && data.total && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Receita do mês" value={money(data.month.revenueCents)} hint="Pedidos pagos, bruto" />
        <Stat label="Pagos no mês" value={data.month.approved} accent="purple" hint={`${data.month.pending} pendentes`} />
        <Stat label="Devoluções no mês" value={data.month.refunded} accent="zinc" />
        <Stat label="Receita total" value={money(data.total.revenueCents)} hint={`${data.total.orders} pedidos no total`} />
      </div>
      <Panel title="Por produto">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{(data.byProduct || []).map(p => <li key={p.product} className="rounded-xl bg-white/5 p-3"><p className="truncate text-sm font-semibold text-zinc-200">{p.title}</p><p className="mt-1 text-lg font-black tabular-nums text-white">{money(p.revenueCents)}</p><p className="text-xs text-zinc-500">{p.approved} pagos</p></li>)}{(data.byProduct || []).length === 0 && <li className="text-sm text-zinc-500">Nenhum pedido ainda.</li>}</ul>
      </Panel>
      <Panel title="Pedidos" description="Pedido pago: use Devolver (estorno total pelo Mercado Pago; os benefícios saem da conta). Pedidos não pagos, de teste ou já devolvidos podem ser excluídos.">
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-wider text-zinc-400"><tr><th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Usuário</th><th className="py-2 pr-3">Produto</th><th className="py-2 pr-3">Valor</th><th className="py-2 pr-3">Situação</th><th className="py-2 pr-3">Cupom</th><th className="py-2 pr-3">Pagamento</th><th className="py-2 text-right">Ações</th></tr></thead><tbody className="divide-y divide-white/10 text-zinc-300">
          {(data.orders || []).map(o => { const asking = confirm?.id === o.id ? confirm.action : null; return <tr key={o.id}>
            <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(o.createdAt)}</td><td className="py-2 pr-3 font-semibold text-white">{o.username}</td><td className="py-2 pr-3">{o.title}</td><td className="py-2 pr-3 tabular-nums">{money(o.amountCents)}</td>
            <td className="py-2 pr-3"><span className={o.status === 'approved' ? 'text-[#C6FF00]' : o.status === 'refunded' ? 'text-amber-300' : o.status === 'pending' ? 'text-zinc-300' : 'text-red-300'}>{ORDER_STATUS[o.status] || o.status}</span></td>
            <td className="py-2 pr-3 text-xs text-zinc-400">{o.coupon || '—'}</td><td className="py-2 pr-3 text-xs text-zinc-500">{o.paymentId || '—'}{o.providerStatus ? ` · ${o.providerStatus}` : ''}</td>
            <td className="py-2"><div className="flex justify-end gap-2 whitespace-nowrap">{asking ? <>
              <button disabled={busy} onClick={() => run(o, asking)} className={`${btn.danger} min-h-9 px-3 text-xs`}>{busy ? 'Aguarde…' : asking === 'refund' ? `Confirmar devolução de ${money(o.amountCents)}` : 'Confirmar exclusão'}</button>
              <button disabled={busy} onClick={() => setConfirm(null)} className={`${btn.ghost} min-h-9 px-3 text-xs`}>Cancelar</button>
            </> : o.status === 'approved' ? <button disabled={busy} onClick={() => setConfirm({ id: o.id, action: 'refund' })} className={`${btn.ghost} min-h-9 px-3 text-xs`}>Devolver</button>
              : <button disabled={busy} onClick={() => setConfirm({ id: o.id, action: 'delete' })} className={`${btn.danger} min-h-9 px-3 text-xs`}>Excluir</button>}</div></td>
          </tr>; })}
          {(data.orders || []).length === 0 && <tr><td colSpan={8} className="py-6 text-center text-zinc-500">Nenhum pedido ainda.</td></tr>}
        </tbody></table></div>
        <nav aria-label="Páginas de pedidos" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-zinc-400">{total ? `${from}–${to} de ${total}` : '0 pedidos'}</span>
          <div className="flex items-center gap-2"><button className={`${btn.ghost} min-h-9`} disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Anterior</button><span className="tabular-nums text-zinc-300">Página {page} de {pages}</span><button className={`${btn.ghost} min-h-9`} disabled={page >= pages || loading} onClick={() => setPage(p => p + 1)}>Próxima</button></div>
        </nav>
      </Panel>
    </>}
  </>;
}

export function AdminCouponsPage() {
  const [products, setProducts] = useState<OrdersReport['products'] | null>(null), [enabled, setEnabled] = useState(true), [error, setError] = useState('');
  useEffect(() => { api<OrdersReport>('/api/admin/orders?page=1').then(d => { setProducts(d.products); setEnabled(d.enabled); }).catch(e => setError((e as Error).message)); }, []);
  return <>
    <PageTitle title="Cupons" subtitle="Descontos e liberações de 100% para a loja. Cada uso fica ligado ao pedido." />
    <ErrorBox message={error} />
    {!enabled && <Panel title="Pagamentos desligados" description="Os cupons só valem quando a loja estiver ativa." ><span /></Panel>}
    {products && enabled && <AdminCoupons products={products} />}
  </>;
}

export function AdminWorlds() {
  const { data, error, loading, refresh } = useOverview();
  const cloudAudit = (data?.audit || []).filter(r => r.action.startsWith('cloud-'));
  return <>
    <PageTitle title="Mundos na nuvem" subtitle="Um mundo por conta liberada, até 4 MB. O conteúdo dos mundos não é inspecionado aqui; apenas totais."><button className={btn.ghost} onClick={refresh} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</button></PageTitle>
    <ErrorBox message={error} />
    {data && <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Mundos salvos" value={data.worlds.total} />
        <Stat label="Espaço usado" value={fmtBytes(data.worlds.bytes)} accent="purple" hint={`Média ${data.worlds.total ? fmtBytes(Math.round(data.worlds.bytes / data.worlds.total)) : '—'} por mundo`} />
        <Stat label="Contas com nuvem" value={data.accounts.cloud} hint={data.worlds.lastSavedAt ? `Último salvamento ${fmtDate(data.worlds.lastSavedAt)}` : 'Nenhum salvamento ainda'} />
      </div>
      <Panel title="Liberações e revogações recentes">
        <ul className="divide-y divide-white/10 text-sm">{cloudAudit.length === 0 && <li className="py-2 text-zinc-500">Nenhuma mudança de nuvem registrada.</li>}{cloudAudit.map((row, i) => <li key={i} className="flex items-center justify-between gap-3 py-2"><span><span className="font-semibold text-white">{ACTIONS[row.action]}</span><span className="text-zinc-400"> · {row.target} por {row.actor}</span></span><time className="text-xs text-zinc-500">{fmtDate(row.at)}</time></li>)}</ul>
      </Panel>
      <Panel title="Regras do piloto"><ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300"><li>Visitantes e contas gratuitas salvam apenas no navegador.</li><li>Revogar a nuvem bloqueia novas leituras e gravações, mas mantém o mundo existente.</li><li>Não há exclusão automática; pedidos de eliminação são tratados manualmente.</li></ul></Panel>
    </>}
  </>;
}

export function AdminSettings() {
  return <>
    <PageTitle title="Configurações" subtitle="Quotas, preços e flags serão editáveis aqui. Hoje são definidos no código e nas variáveis do servidor." />
    <Panel title="Valores em vigor">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">{[['Tempo diário · visitante', '15 minutos'], ['Tempo diário · conta', '60 minutos'], ['Limite de mundo na nuvem', '4 MB por conta'], ['Retenção de métricas', '30 dias'], ['Sessão de login', '12 horas'], ['Convite', '24 horas, uso único']].map(([k, v]) => <div key={k} className="rounded-lg bg-white/5 p-3"><dt className="text-xs text-zinc-400">{k}</dt><dd className="font-bold text-white">{v}</dd></div>)}</dl>
    </Panel>
  </>;
}
