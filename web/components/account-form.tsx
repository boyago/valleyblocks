"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PasswordInput } from '@/components/password-input';
import { Brand } from '@/components/site-header';
import { btn, input } from '@/components/admin-shell';
import { signupEnabled } from '@/lib/site-config';
export function AccountForm({ activate = false }: { activate?: boolean }) {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const safeNext = next && /^\/(?![/\\])/.test(next) ? next : '';
  const [name, setName] = useState(''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [token, setToken] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  useEffect(() => {
    if (!activate) return;
    const capture = () => {
      // Never clear a captured invite when Strict Mode repeats the effect.
      const value = new URLSearchParams(location.hash.slice(1)).get('token');
      if (value) { setToken(value); history.replaceState(null, '', location.pathname); }
    };
    capture(); window.addEventListener('hashchange', capture);
    return () => window.removeEventListener('hashchange', capture);
  }, [activate]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage('');
    // Read the submitted fields as well as controlled state: password managers
    // can fill the DOM without triggering React's change event.
    const fields = new FormData(event.currentTarget as HTMLFormElement);
    const submittedPassword = String(fields.get('password') || '');
    if (activate && submittedPassword !== String(fields.get('confirmation') || '')) { setMessage('As senhas precisam ser iguais.'); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/account/${activate ? 'activate' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(activate ? { token, password: submittedPassword } : { username: String(fields.get('username') || '').trim(), password: submittedPassword }) });
      const data = await response.json(); if (!response.ok) throw Error(data.error);
      setPassword(''); setConfirmation('');
      if (activate) { setToken(''); router.push(safeNext || '/jogos/valleyblocks'); } else router.push(safeNext || (data.account.role === 'admin' ? '/admin' : '/conta'));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível continuar.'); }
    finally { setBusy(false); }
  }
  const field = 'border-white/15 bg-[#0B0B10] text-white';
  return <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B0B10] px-5 py-12 text-zinc-100">
    <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-0 size-96 rounded-full bg-[#C000FF]/20 blur-3xl" /><div aria-hidden="true" className="pointer-events-none absolute -right-32 bottom-0 size-96 rounded-full bg-[#C6FF00]/10 blur-3xl" />
    <div className="relative w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-[#15151D]/95 p-8 shadow-2xl">
      <Brand />
      <div><h1 className="text-3xl font-black text-white">{activate ? 'Defina sua senha' : 'Entrar na conta'}</h1><p className="mt-2 text-sm text-zinc-400">{activate ? 'O convite pode ser usado uma vez. Escolha uma senha exclusiva com pelo menos 12 caracteres.' : 'Com uma conta você joga até 60 minutos por dia no ValleyBlocks.'}</p></div>
      {done ? <><p className="rounded-lg border border-[#C6FF00]/30 bg-[#C6FF00]/10 p-4 text-sm">Conta ativada. Agora entre com seu usuário e a senha que acabou de definir.</p><Link className={`${btn.primary} w-full`} href="/conta/entrar">Ir para o login</Link></> :
      <form method="post" onSubmit={submit} className="space-y-5">
        {!activate && <label className="block text-sm font-bold text-zinc-200">Usuário<input className={input} name="username" value={name} onChange={e => setName(e.target.value)} autoComplete="username" required maxLength={32} /></label>}
        <label className="block text-sm font-bold text-zinc-200">{activate ? 'Nova senha' : 'Senha'}<PasswordInput aria-label={activate ? 'Nova senha' : 'Senha'} name="password" autoComplete={activate ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} minLength={activate ? 12 : undefined} maxLength={128} required className={field} /></label>
        {activate && <label className="block text-sm font-bold text-zinc-200">Confirmar senha<PasswordInput aria-label="Confirmar senha" name="confirmation" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} minLength={12} maxLength={128} required className={field} /></label>}
        {message && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{message}</p>}
        <button disabled={busy || (activate && !token)} className={`${btn.primary} w-full`}>{busy ? 'Aguarde…' : activate ? 'Ativar conta' : 'Entrar'}</button>
        {activate && !token && <p className="text-sm text-zinc-400">Abra o link completo do convite. Caso tenha atualizado esta página, abra o convite novamente.</p>}
        {!activate && (signupEnabled ? <div className="flex flex-wrap justify-between gap-3 text-sm"><Link className="text-[#C6FF00] underline-offset-4 hover:underline" href="/conta/criar">Criar conta</Link><Link className="text-zinc-300 underline-offset-4 hover:underline" href="/conta/recuperar">Esqueci a senha</Link></div> : <p className="text-xs text-zinc-400">Neste piloto, as contas são criadas por convite do administrador. O cadastro público e a recuperação por e-mail chegam em breve.</p>)}
      </form>}
      <Link className="inline-block text-sm text-zinc-400 underline-offset-4 hover:text-white hover:underline" href="/">Voltar aos jogos</Link>
    </div>
  </div>;
}
