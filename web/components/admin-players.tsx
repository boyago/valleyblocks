"use client";
import { useEffect, useState } from 'react';
import { Ban, Cloud, CloudOff, Infinity as InfinityIcon, Pencil, Search, Timer, Trash2, UserPlus } from 'lucide-react';
import { api, ErrorBox, PageTitle, Panel, Stat, btn, input, type Account } from '@/components/admin-shell';

export function AdminPlayers() {
  const [rows, setRows] = useState<Account[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [name, setName] = useState(''), [invite, setInvite] = useState(''), [filter, setFilter] = useState('');
  async function load() { try { const data = await api<{ accounts: Account[] }>('/api/admin/accounts'); setRows(data.accounts); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  async function create(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(''); setInvite(''); try { const data = await api<{ activationUrl: string }>('/api/admin/accounts', 'POST', { username: name }); setInvite(data.activationUrl); setName(''); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function renew(row: Account) { setBusy(true); setError(''); setInvite(''); try { const data = await api<{ activationUrl: string }>('/api/admin/accounts', 'POST', { renewFor: row.id }); setInvite(data.activationUrl); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function togglePack(row: Account, pack: string) { setBusy(true); setError(''); try { await api('/api/admin/accounts', 'PATCH', { id: row.id, pack, granted: !(row.packs || []).includes(pack) }); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function toggle(row: Account, field: 'unlimited' | 'cloudSave') { setBusy(true); setError(''); try { await api('/api/admin/accounts', 'PATCH', { id: row.id, [field]: !row[field] }); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  const [editing, setEditing] = useState<Account | null>(null), [removing, setRemoving] = useState<Account | null>(null), [notice, setNotice] = useState('');
  async function ban(row: Account) { setBusy(true); setError(''); setNotice(''); try { await api('/api/admin/accounts', 'PATCH', { id: row.id, disabled: !row.disabled }); setNotice(row.disabled ? `${row.username} pode entrar de novo.` : `${row.username} foi banido e desconectado de todos os aparelhos.`); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  const q = filter.trim().toLowerCase();
  const visible = rows.filter(r => r.username.includes(q) || (r.email || '').includes(q));
  return <>
    <PageTitle title="Jogadores" subtitle="Contas por convite, tempo ilimitado e salvamento na nuvem. Toda mudança fica registrada na auditoria." />
    <ErrorBox message={error} />
    {notice && <p role="status" className="rounded-lg border border-[#C6FF00]/30 bg-[#C6FF00]/10 p-3 text-sm text-zinc-100">{notice}</p>}
    {editing && <EditAccount account={editing} onClose={() => setEditing(null)} onSaved={async msg => { setEditing(null); setNotice(msg); await load(); }} />}
    {removing && <RemoveAccount account={removing} onClose={() => setRemoving(null)} onDone={async msg => { setRemoving(null); setNotice(msg); await load(); }} />}
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat label="Contas" value={rows.length} hint={`${rows.filter(r => r.activated).length} ativadas`} />
      <Stat label="Tempo ilimitado" value={rows.filter(r => r.unlimited).length} accent="purple" />
      <Stat label="Nuvem liberada" value={rows.filter(r => r.cloudSave).length} hint="Benefício pago ou liberação manual" />
    </div>
    <div className="grid gap-6 xl:grid-cols-3">
      <Panel title="Convidar jogador" description="O convidado define a própria senha pelo link, válido por 24 horas e de uso único." className="xl:col-span-1">
        <form method="post" onSubmit={create} className="space-y-4">
          <label className="block text-sm font-bold text-zinc-200">Nome de usuário<input className={input} required pattern="[A-Za-z0-9_]{3,32}" maxLength={32} value={name} onChange={e => setName(e.target.value)} placeholder="ex.: maria_2016" /></label>
          <button disabled={busy} className={`${btn.primary} w-full`}><UserPlus className="mr-2 size-4" aria-hidden="true" />Criar convite</button>
        </form>
        {invite && <div role="status" className="mt-4 space-y-3 rounded-lg border border-[#C6FF00]/30 bg-[#C6FF00]/10 p-4 text-sm"><p className="text-zinc-100">Link de ativação pronto (válido por 24 h, uso único). Envie em particular ao jogador; links anteriores dessa conta deixaram de valer.</p><input aria-label="Link de ativação" readOnly value={invite} className={`${input} mt-0 text-xs`} onFocus={e => e.target.select()} /><button className={btn.ghost} onClick={() => navigator.clipboard.writeText(invite).catch(() => setError('Selecione e copie o link acima.'))}>Copiar link</button></div>}
      </Panel>
      <Panel title="Contas" className="xl:col-span-2">
        <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" /><input aria-label="Filtrar por usuário ou e-mail" className={`${input} mt-0 pl-10`} placeholder="Filtrar por usuário ou e-mail" value={filter} onChange={e => setFilter(e.target.value)} /></label>
        {loading ? <p className="mt-4 text-sm text-zinc-400">Carregando…</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-wider text-zinc-400"><tr><th className="py-2 pr-3">Usuário</th><th className="py-2 pr-3">Situação</th><th className="py-2 pr-3">Tempo</th><th className="py-2 pr-3">Nuvem</th><th className="py-2 pr-3">Pacotes</th><th className="py-2 text-right">Ações</th></tr></thead><tbody className="divide-y divide-white/10">
          {visible.map(row => <tr key={row.id}><td className="py-3 pr-3"><span className="font-bold text-white">{row.username}</span>{row.role === 'admin' && <span className="ml-2 rounded bg-[#C000FF]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#D86BFF]">admin</span>}{row.minor && <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-300">menor</span>}<span className="block text-xs text-zinc-500">{row.email || 'sem e-mail'}</span></td><td className="py-3 pr-3 text-zinc-300">{row.disabled ? <span className="font-semibold text-red-300">Banida</span> : row.activated ? 'Ativa' : 'Convite pendente'}</td><td className="py-3 pr-3 text-zinc-300"><span className="inline-flex items-center gap-1">{row.unlimited ? <InfinityIcon className="size-4 text-[#D86BFF]" aria-hidden="true" /> : <Timer className="size-4 text-zinc-500" aria-hidden="true" />}{row.unlimited ? 'Ilimitado' : '60 min/dia'}</span></td><td className="py-3 pr-3 text-zinc-300"><span className="inline-flex items-center gap-1">{row.cloudSave ? <Cloud className="size-4 text-[#C6FF00]" aria-hidden="true" /> : <CloudOff className="size-4 text-zinc-500" aria-hidden="true" />}{row.cloudSave ? 'Liberada' : 'Só no aparelho'}</span></td><td className="py-3 pr-3 text-zinc-300">{(row.packs || []).length ? (row.packs || []).map(p => <span key={p} className="mr-1 rounded bg-[#C6FF00]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#C6FF00]">{p}</span>) : <span className="text-zinc-500">—</span>}</td><td className="py-3"><div className="flex flex-wrap justify-end gap-2">{!row.activated && !row.disabled && <button disabled={busy} onClick={() => renew(row)} className={`${btn.ghost} min-h-9 border-[#C6FF00]/40 px-3 text-xs text-[#C6FF00]`}>Gerar novo link</button>}<button disabled={busy} aria-pressed={row.unlimited} onClick={() => toggle(row, 'unlimited')} className={`${btn.ghost} min-h-9 px-3 text-xs`}>{row.unlimited ? 'Revogar ilimitado' : 'Liberar ilimitado'}</button><button disabled={busy} aria-pressed={row.cloudSave} onClick={() => toggle(row, 'cloudSave')} className={`${btn.ghost} min-h-9 px-3 text-xs`}>{row.cloudSave ? 'Revogar nuvem' : 'Liberar nuvem'}</button><button disabled={busy} aria-pressed={(row.packs || []).includes('expedicao')} onClick={() => togglePack(row, 'expedicao')} className={`${btn.ghost} min-h-9 px-3 text-xs`}>{(row.packs || []).includes('expedicao') ? 'Revogar Expedição' : 'Liberar Expedição'}</button>{row.role !== 'admin' && <><button disabled={busy} onClick={() => setEditing(row)} className={`${btn.ghost} min-h-9 px-3 text-xs`}><Pencil className="mr-1 size-3.5" aria-hidden="true" />Editar</button><button disabled={busy} aria-pressed={row.disabled} onClick={() => ban(row)} className={`${btn.danger} min-h-9 px-3 text-xs`}><Ban className="mr-1 size-3.5" aria-hidden="true" />{row.disabled ? 'Desbanir' : 'Banir'}</button><button disabled={busy} onClick={() => setRemoving(row)} className={`${btn.danger} min-h-9 px-3 text-xs`}><Trash2 className="mr-1 size-3.5" aria-hidden="true" />Excluir</button></>}</div></td></tr>)}
          {visible.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-zinc-500">Nenhuma conta encontrada.</td></tr>}
        </tbody></table></div>}
      </Panel>
    </div>
  </>;
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc); }, [onClose]);
  return <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4" onClick={onClose}><div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#15151D] p-6" onClick={e => e.stopPropagation()}><h2 className="text-lg font-bold text-white">{title}</h2><div className="mt-4">{children}</div></div></div>;
}
function EditAccount({ account, onClose, onSaved }: { account: Account; onClose: () => void; onSaved: (msg: string) => void }) {
  const [form, setForm] = useState({ username: account.username, email: account.email || '', guardianEmail: account.guardianEmail || '', minor: !!account.minor }), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { await api('/api/admin/accounts', 'PATCH', { id: account.id, profile: form }); onSaved(`Dados de ${form.username.toLowerCase()} atualizados.`); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }
  return <Dialog title={`Editar ${account.username}`} onClose={onClose}><form onSubmit={save} className="space-y-4">
    <label className="block text-sm font-bold text-zinc-200">Nome de usuário<input className={input} required pattern="[A-Za-z0-9_]{3,32}" maxLength={32} value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} /></label>
    <label className="block text-sm font-bold text-zinc-200">E-mail<input className={input} type="email" maxLength={254} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="vazio = sem e-mail" /></label>
    <label className="flex items-center gap-3 text-sm font-bold text-zinc-200"><input type="checkbox" className="size-4 accent-[#C6FF00]" checked={form.minor} onChange={e => setForm(f => ({ ...f, minor: e.target.checked }))} />Menor de idade</label>
    {form.minor && <label className="block text-sm font-bold text-zinc-200">E-mail do responsável<input className={input} type="email" required maxLength={254} value={form.guardianEmail} onChange={e => setForm(f => ({ ...f, guardianEmail: e.target.value }))} /></label>}
    <p className="text-xs text-zinc-500">Trocar o e-mail invalida links de recuperação enviados antes. A senha não é alterada aqui; o jogador usa “Esqueci a senha”.</p>
    <ErrorBox message={error} />
    <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className={btn.ghost}>Cancelar</button><button disabled={busy} className={btn.primary}>{busy ? 'Salvando…' : 'Salvar'}</button></div>
  </form></Dialog>;
}
function RemoveAccount({ account, onClose, onDone }: { account: Account; onClose: () => void; onDone: (msg: string) => void }) {
  const [typed, setTyped] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function remove(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { await api('/api/admin/accounts', 'DELETE', { id: account.id, confirm: typed.trim().toLowerCase() }); onDone(`Conta ${account.username} excluída.`); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }
  return <Dialog title={`Excluir ${account.username}`} onClose={onClose}><form onSubmit={remove} className="space-y-4">
    <p className="text-sm text-zinc-300">Apaga a conta, o e-mail, o mundo na nuvem, as liberações e o histórico de tempo. Não dá para desfazer. Pedidos pagos continuam no financeiro, sem o nome. Para só impedir o acesso, use <strong className="text-white">Banir</strong>.</p>
    <label className="block text-sm font-bold text-zinc-200">Digite <span className="text-red-300">{account.username}</span> para confirmar<input className={input} autoComplete="off" value={typed} onChange={e => setTyped(e.target.value)} /></label>
    <ErrorBox message={error} />
    <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className={btn.ghost}>Cancelar</button><button disabled={busy || typed.trim().toLowerCase() !== account.username} className={btn.danger}>{busy ? 'Excluindo…' : 'Excluir para sempre'}</button></div>
  </form></Dialog>;
}
