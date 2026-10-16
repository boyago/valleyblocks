"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, BarChart3, CreditCard, Globe2, LayoutDashboard, LogOut, Menu, Settings, Ticket, Users, X } from 'lucide-react';
import { Brand } from '@/components/site-header';

export type Account = { id: string; username: string; role: string; unlimited: boolean; cloudSave: boolean; activated: boolean; disabled: boolean; packs?: string[]; email?: string | null; guardianEmail?: string | null; minor?: boolean; emailVerified?: boolean; createdAt?: string | null };
const AccountContext = createContext<Account | null>(null);
export const useAdminAccount = () => useContext(AccountContext);

export async function api<T = unknown>(path: string, method = 'GET', body?: object): Promise<T> {
  const response = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir.');
  return data as T;
}

const MENU: { href: string; label: string; icon: typeof Users; soon?: boolean; sub?: boolean }[] = [
  { href: '/admin', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/admin/jogadores', label: 'Jogadores', icon: Users },
  { href: '/admin/pagamentos', label: 'Pagamentos', icon: CreditCard },
  { href: '/admin/cupons', label: 'Cupons', icon: Ticket, sub: true },
  { href: '/admin/mundos', label: 'Mundos na nuvem', icon: Globe2 },
  { href: '/admin/uso', label: 'Medição', icon: BarChart3 },
  { href: '/admin/configuracoes', label: 'Configurações', icon: Settings, soon: true },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter(), pathname = usePathname();
  const [account, setAccount] = useState<Account | null>(null), [loaded, setLoaded] = useState(false), [open, setOpen] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    api<{ account: Account | null }>('/api/account/me').then(data => { if (alive) setAccount(data.account); }).catch(e => { if (alive) setError((e as Error).message); }).finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  async function logout() { try { await api('/api/account/logout', 'POST', {}); router.push('/conta/entrar'); } catch (e) { setError((e as Error).message); } }

  if (!loaded) return <Screen><p role="status" className="text-zinc-400">Carregando painel…</p></Screen>;
  if (!account) return <Screen><div className="space-y-4"><p className="text-zinc-300">{error || 'Entre com uma conta administrativa para continuar.'}</p><Link className="inline-flex min-h-11 items-center rounded-lg bg-[#C6FF00] px-5 font-bold text-[#0B0B10]" href="/conta/entrar">Entrar</Link></div></Screen>;
  if (account.role !== 'admin') return <Screen><div className="space-y-4"><p role="alert" className="text-zinc-300">Esta área é exclusiva do administrador.</p><Link className="underline" href="/conta">Ir para minha conta</Link></div></Screen>;

  const nav = <nav aria-label="Administração" className="space-y-1">
    {MENU.map(item => { const active = pathname === item.href; const Icon = item.icon; return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg ${item.sub ? 'ml-5 border-l border-white/10 pl-4' : 'px-3'} text-sm font-semibold transition ${active ? 'bg-[#C000FF]/20 text-white ring-1 ring-[#C000FF]/50' : 'text-zinc-300 hover:bg-white/5 hover:text-white'}`}><Icon className="size-4 shrink-0" aria-hidden="true" />{item.label}{item.soon && <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-300">Em breve</span>}</Link>; })}
  </nav>;

  return <AccountContext.Provider value={account}>
    <div className="min-h-screen bg-[#0B0B10] text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B0B10]/95 backdrop-blur"><div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3"><button className="grid size-10 place-items-center rounded-lg bg-white/10 lg:hidden" aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}</button><Brand /><span className="hidden rounded-md bg-white/10 px-2 py-1 text-xs font-bold uppercase tracking-widest text-zinc-300 sm:inline">Admin</span></div>
        <div className="flex items-center gap-3 text-sm"><span className="hidden text-zinc-300 sm:inline">Olá, <strong className="text-white">{account.username}</strong></span><Link className="rounded-lg px-3 py-2 text-zinc-300 hover:bg-white/5 hover:text-white" href="/conta">Minha conta</Link><button onClick={logout} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 px-3 text-zinc-200 hover:bg-white/5"><LogOut className="size-4" aria-hidden="true" />Sair</button></div>
      </div></header>
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-6 sm:px-6">
        <aside className="hidden w-60 shrink-0 lg:block"><div className="sticky top-24 space-y-6">{nav}<div className="rounded-xl border border-white/10 bg-[#15151D] p-4 text-xs text-zinc-400"><p className="flex items-center gap-2 font-bold text-zinc-200"><Activity className="size-4 text-[#C6FF00]" aria-hidden="true" />Piloto ValleyBlocks</p><p className="mt-2">Visitantes: 15 min/dia · Contas: 60 min/dia. Nuvem reservada a pagantes ou liberação manual.</p></div></div></aside>
        {open && <div className="fixed inset-0 z-20 bg-black/70 lg:hidden" onClick={() => setOpen(false)}><aside className="h-full w-72 bg-[#0B0B10] p-5 pt-24" onClick={e => e.stopPropagation()}>{nav}</aside></div>}
        <main className="min-w-0 flex-1 space-y-6">{children}</main>
      </div>
    </div>
  </AccountContext.Provider>;
}
function Screen({ children }: { children: React.ReactNode }) { return <div className="grid min-h-screen place-items-center bg-[#0B0B10] px-5 text-zinc-100"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#15151D] p-8"><div className="mb-6"><Brand /></div>{children}</div></div>; }

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{title}</h1>{subtitle && <p className="mt-1 max-w-2xl text-sm text-zinc-400">{subtitle}</p>}</div>{children}</div>;
}
export function Panel({ title, description, children, className = '' }: { title?: string; description?: string; children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-white/10 bg-[#15151D] p-5 ${className}`}>{title && <h2 className="text-lg font-bold text-white">{title}</h2>}{description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}<div className={title || description ? 'mt-4' : ''}>{children}</div></section>;
}
export function Stat({ label, value, hint, accent = 'lime' }: { label: string; value: string | number; hint?: string; accent?: 'lime' | 'purple' | 'zinc' }) {
  const color = accent === 'lime' ? 'text-[#C6FF00]' : accent === 'purple' ? 'text-[#D86BFF]' : 'text-zinc-100';
  return <div className="rounded-2xl border border-white/10 bg-[#15151D] p-5"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</p><p className={`mt-2 text-3xl font-black tabular-nums ${color}`}>{value}</p>{hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}</div>;
}
export function ErrorBox({ message }: { message: string }) { return message ? <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{message}</p> : null; }
export const btn = { primary: 'inline-flex min-h-11 items-center justify-center rounded-lg bg-[#C6FF00] px-5 font-bold text-[#0B0B10] hover:bg-[#d5ff4a] disabled:opacity-50', ghost: 'inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-4 text-sm font-semibold text-zinc-200 hover:bg-white/5 disabled:opacity-50', danger: 'inline-flex min-h-11 items-center justify-center rounded-lg border border-red-400/40 px-4 text-sm font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-50' };
export const input = 'mt-2 block min-h-11 w-full rounded-lg border border-white/15 bg-[#0B0B10] px-3 font-normal text-white placeholder:text-zinc-500 focus:border-[#C000FF] focus:outline-none focus:ring-2 focus:ring-[#C000FF]/40';
