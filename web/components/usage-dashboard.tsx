"use client";
import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, ErrorBox, PageTitle, Panel, Stat, btn } from '@/components/admin-shell';
import { fmtDay } from '@/components/admin-overview';
type Report = { generatedAt: string; active: { game: string; players: number }[]; days: { day_key: string; game: string; browsers: number; sessions: number; active_ms: number }[] };
export function UsageDashboard() {
  const [report, setReport] = useState<Report | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  async function refresh() { setLoading(true); setError(''); try { setReport(await api<Report>('/api/admin/game-usage')); } catch (e) { setReport(null); setError((e as Error).message); } finally { setLoading(false); } }
  useEffect(() => { void refresh(); }, []);
  const series = (report?.days || []).slice().reverse().map(r => ({ day: fmtDay(r.day_key), navegadores: Number(r.browsers), sessoes: Number(r.sessions), minutos: Math.floor(Number(r.active_ms) / 60000) }));
  return <>
    <PageTitle title="Medição de jogadores" subtitle="ValleyBlocks · somente navegadores que autorizaram métricas. Navegadores não representam pessoas únicas."><button className={btn.ghost} onClick={refresh} disabled={loading}>{loading ? 'Consultando…' : 'Atualizar'}</button></PageTitle>
    <ErrorBox message={error} />
    {report && <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Jogando agora · estimativa" value={report.active.reduce((n, row) => n + Number(row.players), 0)} hint="Presença expira após 45 s sem sinal" />
        <Stat label="Sessões · 30 dias" value={report.days.reduce((n, row) => n + Number(row.sessions), 0)} accent="purple" />
        <Stat label="Minutos medidos · 30 dias" value={Math.floor(report.days.reduce((n, row) => n + Number(row.active_ms), 0) / 60000).toLocaleString('pt-BR')} />
      </div>
      <Panel title="Minutos e sessões por dia">
        <div className="h-72"><ResponsiveContainer><AreaChart data={series}><defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C000FF" stopOpacity={.5} /><stop offset="100%" stopColor="#C000FF" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} /><XAxis dataKey="day" stroke="#71717a" fontSize={12} /><YAxis stroke="#71717a" fontSize={12} allowDecimals={false} /><Tooltip contentStyle={{ background: '#15151D', border: '1px solid rgba(255,255,255,.15)', borderRadius: 12, color: '#fff' }} /><Legend /><Area type="monotone" dataKey="minutos" name="Minutos" stroke="#C000FF" fill="url(#g2)" strokeWidth={2} /><Area type="monotone" dataKey="sessoes" name="Sessões" stroke="#C6FF00" fill="transparent" strokeWidth={2} /></AreaChart></ResponsiveContainer></div>
        {series.length === 0 && <p className="text-sm text-zinc-400">Ainda não há sessões medidas neste período.</p>}
      </Panel>
      <Panel title="Atividade diária autorizada">
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-wider text-zinc-400"><tr>{['Dia', 'Jogo', 'Navegadores', 'Sessões', 'Minutos'].map(t => <th key={t} className="py-2 pr-3">{t}</th>)}</tr></thead><tbody className="divide-y divide-white/10 text-zinc-300">{report.days.map(row => <tr key={`${row.day_key}:${row.game}`}><td className="py-2 pr-3">{row.day_key}</td><td className="py-2 pr-3">ValleyBlocks</td><td className="py-2 pr-3 tabular-nums">{row.browsers}</td><td className="py-2 pr-3 tabular-nums">{row.sessions}</td><td className="py-2 tabular-nums">{Math.floor(Number(row.active_ms) / 60000)}</td></tr>)}</tbody></table></div>
        <p className="mt-3 text-xs text-zinc-400">Atualizado em {new Date(report.generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · dados por navegador retidos por 30 dias.</p>
      </Panel>
    </>}
  </>;
}
