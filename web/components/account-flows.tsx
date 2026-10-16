"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PasswordInput } from '@/components/password-input';
import { Brand } from '@/components/site-header';
import { btn, input } from '@/components/admin-shell';

type Mode = 'register' | 'verify' | 'recover' | 'reset';
const field = 'border-white/15 bg-[#0B0B10] text-white';
async function post(action: string, body: object) {
  const response = await fetch(`/api/account/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível continuar.');
  return data;
}
function useHashToken(enabled: boolean) {
  const [token, setToken] = useState('');
  useEffect(() => {
    if (!enabled) return;
    const capture = () => { const value = new URLSearchParams(location.hash.slice(1)).get('token'); if (value) { setToken(value); history.replaceState(null, '', location.pathname); } };
    capture(); window.addEventListener('hashchange', capture);
    return () => window.removeEventListener('hashchange', capture);
  }, [enabled]);
  return token;
}
function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B0B10] px-5 py-12 text-zinc-100">
    <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-0 size-96 rounded-full bg-[#C000FF]/20 blur-3xl" /><div aria-hidden="true" className="pointer-events-none absolute -right-32 bottom-0 size-96 rounded-full bg-[#C6FF00]/10 blur-3xl" />
    <div className="relative w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-[#15151D]/95 p-8 shadow-2xl"><Brand /><div><h1 className="text-3xl font-black text-white">{title}</h1><p className="mt-2 text-sm text-zinc-400">{subtitle}</p></div>{children}<Link className="inline-block text-sm text-zinc-400 underline-offset-4 hover:text-white hover:underline" href="/conta/entrar">Voltar ao login</Link></div>
  </div>;
}
const Alert = ({ kind, children }: { kind: 'error' | 'ok'; children: React.ReactNode }) => <p role={kind === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm ${kind === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-[#C6FF00]/30 bg-[#C6FF00]/10 text-zinc-100'}`}>{children}</p>;

export function AccountFlow({ mode }: { mode: Mode }) {
  const token = useHashToken(mode === 'verify' || mode === 'reset');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState<string>('');
  const [age, setAge] = useState<number | null>(null);
  useEffect(() => { if (mode === 'verify' && token && !done && !error) { setBusy(true); post('verify', { token }).then(() => setDone('E-mail confirmado. Sua conta está pronta.')).catch(e => setError((e as Error).message)).finally(() => setBusy(false)); } }, [mode, token, done, error]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    const f = new FormData(event.currentTarget as HTMLFormElement), get = (k: string) => String(f.get(k) || '');
    try {
      if (mode === 'register') {
        if (get('password') !== get('confirmation')) throw new Error('As senhas precisam ser iguais.');
        const result = await post('register', { username: get('username').trim(), email: get('email').trim(), password: get('password'), birthDate: get('birthDate'), guardianEmail: get('guardianEmail').trim() || undefined });
        setDone(result.sentTo === 'guardian' ? 'Conta criada. Enviamos o link de confirmação para o e-mail do responsável. A conta só funciona depois que ele confirmar.' : 'Conta criada. Enviamos um link de confirmação para o seu e-mail. Abra-o em até 24 horas para ativar a conta.');
      } else if (mode === 'recover') {
        await post(get('resend') ? 'resend' : 'recover', { email: get('email').trim() });
        setDone('Se esse e-mail estiver cadastrado e confirmado, você receberá uma mensagem em instantes. Verifique também a pasta de spam.');
      } else if (mode === 'reset') {
        if (get('password') !== get('confirmation')) throw new Error('As senhas precisam ser iguais.');
        await post('reset', { token, password: get('password') });
        setDone('Senha redefinida. Entre com a nova senha.');
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function onBirth(value: string) { const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return setAge(null); const t = new Date(); let a = t.getFullYear() - +m[1]; if (t.getMonth() + 1 < +m[2] || (t.getMonth() + 1 === +m[2] && t.getDate() < +m[3])) a--; setAge(a); }

  if (mode === 'verify') return <Shell title="Confirmar e-mail" subtitle="Validando o link de confirmação da sua conta.">{done ? <><Alert kind="ok">{done}</Alert><Link className={`${btn.primary} w-full`} href="/conta/entrar">Entrar</Link></> : error ? <><Alert kind="error">{error}</Alert><Link className={`${btn.ghost} w-full`} href="/conta/recuperar">Pedir um novo link</Link></> : <p className="text-sm text-zinc-400">{token ? 'Confirmando…' : 'Abra o link completo recebido por e-mail.'}</p>}</Shell>;

  if (mode === 'recover') return <Shell title="Recuperar acesso" subtitle="Informe o e-mail da conta. Enviaremos um link para redefinir a senha ou confirmar o cadastro.">{done ? <Alert kind="ok">{done}</Alert> : <form method="post" onSubmit={submit} className="space-y-5">
    <label className="block text-sm font-bold text-zinc-200">E-mail<input className={input} name="email" type="email" autoComplete="email" required maxLength={254} /></label>
    <label className="flex items-start gap-2 text-sm text-zinc-300"><input type="checkbox" name="resend" value="1" className="mt-1" />Ainda não confirmei meu e-mail; quero receber o link de confirmação de novo.</label>
    {error && <Alert kind="error">{error}</Alert>}
    <button disabled={busy} className={`${btn.primary} w-full`}>{busy ? 'Aguarde…' : 'Enviar link'}</button>
  </form>}</Shell>;

  if (mode === 'reset') return <Shell title="Nova senha" subtitle="Escolha uma senha exclusiva com pelo menos 12 caracteres.">{done ? <><Alert kind="ok">{done}</Alert><Link className={`${btn.primary} w-full`} href="/conta/entrar">Entrar</Link></> : <form method="post" onSubmit={submit} className="space-y-5">
    <label className="block text-sm font-bold text-zinc-200">Nova senha<PasswordInput aria-label="Nova senha" name="password" autoComplete="new-password" minLength={12} maxLength={128} required className={field} /></label>
    <label className="block text-sm font-bold text-zinc-200">Confirmar senha<PasswordInput aria-label="Confirmar senha" name="confirmation" autoComplete="new-password" minLength={12} maxLength={128} required className={field} /></label>
    {error && <Alert kind="error">{error}</Alert>}
    <button disabled={busy || !token} className={`${btn.primary} w-full`}>{busy ? 'Aguarde…' : 'Salvar nova senha'}</button>
    {!token && <p className="text-sm text-zinc-400">Abra o link completo recebido por e-mail. Ele vale por 1 hora.</p>}
  </form>}</Shell>;

  return <Shell title="Criar conta" subtitle="Com uma conta você joga até 60 minutos por dia no ValleyBlocks e pode comprar a versão completa.">{done ? <><Alert kind="ok">{done}</Alert><Link className={`${btn.ghost} w-full`} href="/conta/entrar">Ir para o login</Link></> : <form method="post" onSubmit={submit} className="space-y-5">
    <label className="block text-sm font-bold text-zinc-200">Nome de usuário<input className={input} name="username" autoComplete="username" required pattern="[A-Za-z0-9_]{3,32}" maxLength={32} title="3 a 32 letras, números ou sublinhado" /><span className="mt-1 block text-xs font-normal text-zinc-400">Aparece no jogo. Não use seu nome completo.</span></label>
    <label className="block text-sm font-bold text-zinc-200">E-mail<input className={input} name="email" type="email" autoComplete="email" required maxLength={254} /></label>
    <label className="block text-sm font-bold text-zinc-200">Data de nascimento<input className={input} name="birthDate" type="date" required onChange={e => onBirth(e.target.value)} /><span className="mt-1 block text-xs font-normal text-zinc-400">Usada só para saber se você é menor de idade. A data não fica guardada.</span></label>
    {age !== null && age < 13 && <label className="block text-sm font-bold text-zinc-200">E-mail de um responsável<input className={input} name="guardianEmail" type="email" required maxLength={254} /><span className="mt-1 block text-xs font-normal text-zinc-400">Para menores de 13 anos, o responsável recebe e confirma o cadastro.</span></label>}
    <label className="block text-sm font-bold text-zinc-200">Senha<PasswordInput aria-label="Senha" name="password" autoComplete="new-password" minLength={12} maxLength={128} required className={field} /></label>
    <label className="block text-sm font-bold text-zinc-200">Confirmar senha<PasswordInput aria-label="Confirmar senha" name="confirmation" autoComplete="new-password" minLength={12} maxLength={128} required className={field} /></label>
    <p className="text-xs text-zinc-400">Ao criar a conta você concorda com os <Link className="underline" href="/termos">Termos</Link> e a <Link className="underline" href="/privacidade">Política de privacidade</Link>. Não enviamos propaganda; o e-mail serve para confirmar a conta e recuperar a senha.</p>
    {error && <Alert kind="error">{error}</Alert>}
    <button disabled={busy} className={`${btn.primary} w-full`}>{busy ? 'Aguarde…' : 'Criar conta'}</button>
  </form>}</Shell>;
}
