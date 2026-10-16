"use client";
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Cloud, CloudOff, Gamepad2, Infinity as InfinityIcon, KeyRound, LogOut, ShieldCheck, Timer } from 'lucide-react';
import { PasswordInput } from '@/components/password-input';
import { Brand, SiteFooter } from '@/components/site-header';
import { api, ErrorBox, btn, type Account } from '@/components/admin-shell';
import { AccountStore } from '@/components/account-store';
import { paymentsEnabled } from '@/lib/site-config';

export function AccountPanel() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null), [loaded, setLoaded] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(''), [password, setPassword] = useState(''), [done, setDone] = useState('');
  useEffect(() => { let alive = true; api<{ account: Account | null }>('/api/account/me').then(d => { if (alive) setAccount(d.account); }).catch(e => { if (alive) setError((e as Error).message); }).finally(() => { if (alive) setLoaded(true); }); return () => { alive = false; }; }, []);
  async function logout() { setBusy(true); try { await api('/api/account/logout', 'POST', {}); router.push('/conta/entrar'); } catch (e) { setError((e as Error).message); setBusy(false); } }
  async function changePassword(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { await api('/api/account/password', 'POST', { currentPassword: current, password }); setDone('Senha alterada. Entre novamente com a nova senha.'); setTimeout(() => router.push('/conta/entrar'), 1500); } catch (e) { setError((e as Error).message); setBusy(false); } }

  return <div className="flex min-h-screen flex-col bg-[#0B0B10] text-zinc-100">
    <header className="border-b border-white/10"><div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between px-5 sm:px-8"><Brand /><nav className="flex items-center gap-2 text-sm"><Link href="/#catalogo" className="rounded-lg px-3 py-2 text-zinc-300 hover:bg-white/5 hover:text-white">Jogos</Link>{account && paymentsEnabled && <Link href="/comprar/vale-completo" className="rounded-lg px-3 py-2 font-bold text-[#C6FF00] hover:bg-white/5">Loja</Link>}{account?.role === 'admin' && <Link href="/admin" className="rounded-lg px-3 py-2 text-zinc-300 hover:bg-white/5 hover:text-white">Painel admin</Link>}</nav></div></header>
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-5 py-10 sm:px-8">
      {!loaded ? <p role="status" className="text-zinc-400">Carregando conta…</p> : !account ? <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#15151D] p-8"><h1 className="text-2xl font-black text-white">Minha conta</h1><p className="mt-2 text-zinc-300">{error || 'Entre na sua conta para ver seu tempo de jogo, sua nuvem e trocar a senha.'}</p><Link className={`${btn.primary} mt-6 w-full`} href="/conta/entrar">Entrar</Link></div> : <>
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[#C6FF00]">Minha conta</p><h1 className="text-3xl font-black text-white">Olá, {account.username}</h1><p className="mt-1 text-sm text-zinc-400">{account.role === 'admin' ? 'Administrador' : 'Jogador'} do Vale dos Blocos</p></div><button className={btn.ghost} disabled={busy} onClick={logout}><LogOut className="mr-2 size-4" aria-hidden="true" />Sair da conta</button></div>
        <ErrorBox message={error} />
        <Suspense fallback={null}><AccountStore unlimited={account.unlimited} cloudSave={account.cloudSave} /></Suspense>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card icon={account.unlimited ? <InfinityIcon className="size-5 text-[#D86BFF]" aria-hidden="true" /> : <Timer className="size-5 text-[#C6FF00]" aria-hidden="true" />} title="Tempo de jogo" value={account.unlimited ? 'Ilimitado' : '60 min por dia'} hint={account.unlimited ? 'Liberado pelo administrador' : 'Renova à meia-noite, horário de Brasília'} />
          <Card icon={account.cloudSave ? <Cloud className="size-5 text-[#C6FF00]" aria-hidden="true" /> : <CloudOff className="size-5 text-zinc-400" aria-hidden="true" />} title="Mundo na nuvem" value={account.cloudSave ? 'Liberado' : 'Só neste aparelho'} hint={account.cloudSave ? 'Um mundo, até 4 MB, salvo no servidor' : 'Benefício da versão completa ou liberação manual'} />
          <Card icon={<ShieldCheck className="size-5 text-[#C6FF00]" aria-hidden="true" />} title="Segurança" value="Sessão de 12 h" hint="Trocar a senha encerra todas as sessões" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1b1030] to-[#15151D] p-6"><h2 className="flex items-center gap-2 text-lg font-bold text-white"><Gamepad2 className="size-5 text-[#C6FF00]" aria-hidden="true" />Vale dos Blocos</h2><p className="mt-2 text-sm text-zinc-300">Construa seu lar, adote um pet e explore o mundo de blocos. Seu progresso {account.cloudSave ? 'é salvo na nuvem e acompanha sua conta.' : 'fica salvo neste navegador.'}</p><Link href="/jogos/vale-dos-blocos" className={`${btn.primary} mt-5`}>Jogar agora</Link></section>
          <form method="post" onSubmit={changePassword} className="space-y-4 rounded-2xl border border-white/10 bg-[#15151D] p-6"><h2 className="flex items-center gap-2 text-lg font-bold text-white"><KeyRound className="size-5 text-[#C6FF00]" aria-hidden="true" />Trocar senha</h2>
            <label className="block text-sm font-bold text-zinc-200">Senha atual<PasswordInput aria-label="Senha atual" required autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} className="border-white/15 bg-[#0B0B10] text-white" /></label>
            <label className="block text-sm font-bold text-zinc-200">Nova senha<PasswordInput aria-label="Nova senha" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="border-white/15 bg-[#0B0B10] text-white" /></label>
            <p className="text-xs text-zinc-400">Mínimo de 12 caracteres. Use uma senha exclusiva para o Vale dos Blocos.</p>
            {done && <p role="status" className="rounded-lg border border-[#C6FF00]/30 bg-[#C6FF00]/10 p-3 text-sm text-zinc-100">{done}</p>}
            <button disabled={busy} className={btn.primary}>Salvar nova senha</button>
          </form>
        </div>
      </>}
    </main>
    <SiteFooter />
  </div>;
}
function Card({ icon, title, value, hint }: { icon: React.ReactNode; title: string; value: string; hint: string }) { return <div className="rounded-2xl border border-white/10 bg-[#15151D] p-5"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">{icon}{title}</div><p className="mt-2 text-xl font-black text-white">{value}</p><p className="mt-1 text-xs text-zinc-400">{hint}</p></div>; }
