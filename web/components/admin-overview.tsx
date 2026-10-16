"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, ErrorBox, PageTitle, Panel, Stat, btn, input } from '@/components/admin-shell';

export type Overview = {
  generatedAt: string; today: string; range: { from: string; to: string };
  period: { players: number; accounts: number; visitors: number; minutes: number; sessions: number; newAccounts: number; revenue: { cents: number; orders: number } | null; days: { day: string; accountMinutes: number; visitorMinutes: number; accounts: number; visitors: number; sessions: number }[]; games: { game: string; title: string; minutes: number; sessions: number; players: number; accounts: number }[] };
  accounts: { total: number; activated: number; unlimited: number; disabled: number; admins: number; cloud: number; invitesPending: number };
  worlds: { total: number; bytes: number; lastSavedAt: string | null };
  playingNow: { accounts: number; visitors: number };
  playToday: { accountMinutes: number; visitorMinutes: number; accounts: number; visitors: number };
  playDays: { day: string; accountMinutes: number; visitorMinutes: number; accounts: number; visitors: number }[];
  audit: { action: string; at: string; actor: string; target: string }[];
  usage: { active: { game: string; players: number }[]; days: { day: string; game: string; browsers: number; sessions: number; minutes: number }[] } | null;
  payments: { integrated: boolean };
};
export const ACTIONS: Record<string, string> = { 'invite-created': 'Convite criado', 'invite-renewed': 'Novo link de convite', 'account-registered': 'Cadastro público', 'email-verified': 'E-mail confirmado', 'password-reset': 'Senha redefinida', 'account-activated': 'Conta ativada', 'password-changed': 'Senha trocada', 'unlimited-granted': 'Tempo ilimitado liberado', 'unlimited-revoked': 'Tempo ilimitado revogado', 'cloud-save-granted': 'Nuvem liberada', 'cloud-save-revoked': 'Nuvem revogada', 'pack-granted': 'Pacote liberado', 'pack-revoked': 'Pacote revogado', 'coupon-created': 'Cupom criado', 'coupon-disabled': 'Cupom desligado', 'coupon-enabled': 'Cupom religado', 'coupon-redeemed': 'Cupom de 100% usado', 'account-banned': 'Conta banida', 'account-unbanned': 'Banimento removido', 'account-deleted': 'Conta excluída', 'profile-updated': 'Dados da conta alterados', 'order-refunded': 'Pedido devolvido', 'order-deleted': 'Pedido excluído' };
export const fmtDate = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const fmtDay = (day: string) => day.slice(8, 10) + '/' + day.slice(5, 7);
export const fmtBytes = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`;

export type Range = { from: string; to: string };
export function useOverview(range?: Range) {
  const [data, setData] = useState<Overview | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const qs = range ? `?from=${range.from}&to=${range.to}` : '';
  async function refresh() { setLoading(true); setError(''); try { setData(await api<Overview>('/api/admin/overview' + qs)); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }
  useEffect(() => { void refresh(); }, [qs]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, loading, refresh };
}

const chartStyle = { tooltip: { contentStyle: { background: '#15151D', border: '1px solid rgba(255,255,255,.15)', borderRadius: 12, color: '#fff' }, labelStyle: { color: '#C6FF00' } }, axis: { stroke: '#71717a', fontSize: 12 } };
const brDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
const dayOf = (ms: number) => brDay.format(ms);
function daysBetween(from: string, to: string) { const out: string[] = []; for (let t = Date.parse(from + 'T12:00:00Z'); t <= Date.parse(to + 'T12:00:00Z') && out.length < 401; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10)); return out; }
const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtMinutes = (m: number) => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;

type Preset = 'today' | '7' | '30' | 'custom';
const PRESETS: { id: Preset; label: string }[] = [{ id: 'today', label: 'Hoje' }, { id: '7', label: 'Últimos 7 dias' }, { id: '30', label: 'Últimos 30 dias' }, { id: 'custom', label: 'Entre datas' }];
function presetRange(p: Preset): Range { const now = Date.now(), to = dayOf(now); return { from: p === 'today' ? to : dayOf(now - (p === '30' ? 29 : 6) * 86400000), to }; }

function RangeFilter({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const [preset, setPreset] = useState<Preset>('7'), [draft, setDraft] = useState<Range>(value);
  const [today] = useState(() => dayOf(Date.now())), invalid = !draft.from || !draft.to || draft.from > draft.to;
  function pick(p: Preset) { setPreset(p); if (p !== 'custom') onChange(presetRange(p)); else setDraft(value); }
  return <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-[#15151D] p-3">
    <div role="radiogroup" aria-label="Período" className="flex flex-wrap gap-1 rounded-xl bg-[#0B0B10] p-1">
      {PRESETS.map(p => <button key={p.id} role="radio" aria-checked={preset === p.id} onClick={() => pick(p.id)} className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition ${preset === p.id ? 'bg-[#C6FF00] text-[#0B0B10]' : 'text-zinc-300 hover:bg-white/5 hover:text-white'}`}>{p.label}</button>)}
    </div>
    {preset === 'custom' && <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); if (!invalid) onChange(draft); }}>
      <label className="text-xs font-semibold text-zinc-400">De<input type="date" max={today} value={draft.from} onChange={e => setDraft(d => ({ ...d, from: e.target.value }))} className={`${input} mt-1 min-h-10 [color-scheme:dark]`} /></label>
      <label className="text-xs font-semibold text-zinc-400">Até<input type="date" max={today} value={draft.to} onChange={e => setDraft(d => ({ ...d, to: e.target.value }))} className={`${input} mt-1 min-h-10 [color-scheme:dark]`} /></label>
      <button disabled={invalid} className={`${btn.primary} min-h-10`}>Aplicar</button>
    </form>}
    <p className="ml-auto self-center text-xs text-zinc-500">{fmtDay(value.from)}{value.from !== value.to && ` – ${fmtDay(value.to)}`} · horário de Brasília</p>
  </div>;
}

const GAME_COLORS = ['#C6FF00', '#D86BFF', '#38BDF8', '#FB923C', '#F472B6', '#34D399', '#FACC15', '#A78BFA', '#F87171', '#94A3B8'];

export function AdminOverview() {
  const [range, setRange] = useState<Range>(() => presetRange('7'));
  const { data, error, loading, refresh } = useOverview(range);
  const p = data?.period;
  const byDay = new Map((p?.days || []).map(r => [r.day, r]));
  const days = daysBetween(range.from, range.to);
  const series = days.map(day => ({ day: fmtDay(day), contas: byDay.get(day)?.accountMinutes || 0, visitantes: byDay.get(day)?.visitorMinutes || 0, jogadores: (byDay.get(day)?.accounts || 0) + (byDay.get(day)?.visitors || 0) }));
  const games = p?.games || [], topMinutes = Math.max(1, ...games.map(g => g.minutes)), totalMinutes = games.reduce((s, g) => s + g.minutes, 0);
  return <>
    <PageTitle title="Visão geral" subtitle={data ? `Atualizado ${fmtDate(data.generatedAt)} · horário de Brasília` : 'Resumo de todo o portal: jogadores, tempo e jogos.'}><button className={btn.ghost} onClick={refresh} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</button></PageTitle>
    <RangeFilter value={range} onChange={setRange} />
    <ErrorBox message={error} />
    {data && p && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Jogando agora" value={data.playingNow.accounts + data.playingNow.visitors} hint={`${data.playingNow.accounts} com conta · ${data.playingNow.visitors} visitantes`} />
        <Stat label="Jogadores no período" value={p.players} hint={`${p.accounts} com conta · ${p.visitors} visitantes`} accent="purple" />
        <Stat label="Tempo jogado" value={fmtMinutes(p.minutes)} hint={`${p.sessions} partidas iniciadas`} accent="zinc" />
        <Stat label="Receita no período" value={p.revenue ? money(p.revenue.cents) : '—'} hint={p.revenue ? `${p.revenue.orders} pagos · ${p.newAccounts} contas novas` : `${p.newAccounts} contas novas`} accent="zinc" />
      </div>
      <div className="grid gap-6 xl:grid-cols-5">
        <Panel title="Jogos mais jogados" description="Ordenados por tempo de jogo no período. Jogadores são contas ou navegadores distintos." className="xl:col-span-2">
          {games.length === 0 ? <p className="py-6 text-center text-sm text-zinc-500">Nenhuma partida no período.</p> :
            <ol className="space-y-3">{games.map((g, i) => <li key={g.game}>
              <div className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate font-semibold text-white"><span className="mr-2 tabular-nums text-zinc-500">{i + 1}.</span>{g.title}</span><span className="shrink-0 tabular-nums text-zinc-300">{fmtMinutes(g.minutes)}</span></div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full" style={{ width: `${Math.max(2, (g.minutes / topMinutes) * 100)}%`, background: GAME_COLORS[i % GAME_COLORS.length] }} /></div>
              <p className="mt-1 text-xs text-zinc-500">{g.players} jogadores ({g.accounts} com conta) · {g.sessions} partidas · {totalMinutes ? Math.round((g.minutes / totalMinutes) * 100) : 0}% do tempo</p>
            </li>)}</ol>}
        </Panel>
        <Panel title="Adesão por jogo" description="Jogadores distintos por jogo no período." className="xl:col-span-3">
          <div style={{ height: Math.max(220, games.length * 38) }}><ResponsiveContainer><BarChart data={games} layout="vertical" margin={{ left: 8, right: 16 }}><CartesianGrid stroke="rgba(255,255,255,.08)" horizontal={false} /><XAxis type="number" {...chartStyle.axis} allowDecimals={false} /><YAxis type="category" dataKey="title" width={130} {...chartStyle.axis} /><Tooltip {...chartStyle.tooltip} cursor={{ fill: 'rgba(255,255,255,.05)' }} /><Legend /><Bar dataKey="accounts" name="Com conta" stackId="a" fill="#C000FF" /><Bar dataKey={(g: { players: number; accounts: number }) => g.players - g.accounts} name="Visitantes" stackId="a" fill="#C6FF00" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div>
        </Panel>
      </div>
      <Panel title="Tempo jogado por dia" description="Minutos somados de todos os jogos, pelo relógio do servidor.">
        <div className="h-64"><ResponsiveContainer><BarChart data={series}><CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} /><XAxis dataKey="day" {...chartStyle.axis} minTickGap={12} /><YAxis {...chartStyle.axis} allowDecimals={false} /><Tooltip {...chartStyle.tooltip} cursor={{ fill: 'rgba(255,255,255,.05)' }} /><Legend /><Bar dataKey="contas" name="Contas" stackId="a" fill="#C000FF" /><Bar dataKey="visitantes" name="Visitantes" stackId="a" fill="#C6FF00" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
      </Panel>
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Contas">
          <dl className="grid grid-cols-2 gap-3 text-sm">{[['Cadastradas', data.accounts.total], ['Ativadas', data.accounts.activated], ['Administradores', data.accounts.admins], ['Tempo ilimitado', data.accounts.unlimited], ['Nuvem liberada', data.accounts.cloud], ['Banidas', data.accounts.disabled]].map(([k, v]) => <div key={String(k)} className="rounded-lg bg-white/5 p-3"><dt className="text-xs text-zinc-400">{k}</dt><dd className="text-xl font-black text-white">{v}</dd></div>)}</dl>
          <Link href="/admin/jogadores" className={`${btn.ghost} mt-4 w-full`}>Gerenciar jogadores</Link>
        </Panel>
        <Panel title="Mundos na nuvem">
          <dl className="space-y-3 text-sm"><div className="rounded-lg bg-white/5 p-3"><dt className="text-xs text-zinc-400">Mundos salvos</dt><dd className="text-xl font-black text-white">{data.worlds.total}</dd></div><div className="rounded-lg bg-white/5 p-3"><dt className="text-xs text-zinc-400">Espaço usado</dt><dd className="text-xl font-black text-white">{fmtBytes(data.worlds.bytes)}</dd></div><div className="rounded-lg bg-white/5 p-3"><dt className="text-xs text-zinc-400">Último salvamento</dt><dd className="font-bold text-white">{data.worlds.lastSavedAt ? fmtDate(data.worlds.lastSavedAt) : '—'}</dd></div></dl>
        </Panel>
        <Panel title="Últimas ações" description="Registro de auditoria das permissões e contas.">
          <ul className="divide-y divide-white/10 text-sm">{data.audit.length === 0 && <li className="py-2 text-zinc-500">Nenhuma ação registrada.</li>}{data.audit.slice(0, 8).map((row, i) => <li key={i} className="flex items-center justify-between gap-3 py-2"><span><span className="font-semibold text-white">{ACTIONS[row.action] || row.action}</span><span className="text-zinc-400"> · {row.target}</span></span><time className="shrink-0 text-xs text-zinc-500">{fmtDate(row.at)}</time></li>)}</ul>
        </Panel>
      </div>
    </>}
  </>;
}
