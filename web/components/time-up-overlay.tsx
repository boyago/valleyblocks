"use client";
import { useState } from 'react';
import Link from 'next/link';
import { Clock, Sparkles, UserPlus } from 'lucide-react';
import { PRODUCTS, formatPrice } from '@/lib/products.mjs';
import { paymentsEnabled, signupEnabled } from '@/lib/site-config';

const FULL = PRODUCTS['vale-completo'];
export const FULL_PRICE = formatPrice(FULL.priceCents);

/** Shown over the paused game when the daily quota ends. Nothing here grants time: the server decides. */
export function TimeUpOverlay({ account, onLeave }: { account: boolean; onLeave: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  function buy() { setBusy(true); window.location.assign('/comprar/vale-completo'); }
  return <div role="dialog" aria-modal="true" aria-labelledby="time-up-title" className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-[#0B0B10]/95 px-5 py-6 text-white">
    <div className="w-full max-w-lg text-center">
      <Clock className="mx-auto size-10 text-[#C6FF00]" aria-hidden="true" />
      <h2 id="time-up-title" className="mt-3 text-2xl font-black sm:text-3xl">{account ? 'Seu tempo de hoje acabou' : 'Seus 15 minutos de hoje acabaram'}</h2>
      <p className="mt-2 text-sm text-zinc-300">{account ? 'O tempo é somado entre todos os jogos do portal e renova à meia-noite, horário de Brasília.' : 'O tempo é somado entre todos os jogos do portal e renova à meia-noite, horário de Brasília.'}</p>
      <div className={`mt-6 grid gap-3 ${account ? '' : 'sm:grid-cols-2'}`}>
        {!account && <Link href={signupEnabled ? '/conta/criar' : '/conta/entrar'} className="rounded-xl border border-white/15 bg-white/5 p-4 text-left hover:bg-white/10"><UserPlus className="size-5 text-[#C6FF00]" aria-hidden="true" /><p className="mt-2 font-bold">{signupEnabled ? 'Criar conta grátis' : 'Entrar na conta'}</p><p className="mt-1 text-xs text-zinc-400">60 minutos por dia e seu progresso ligado à conta.</p></Link>}
        <div className="rounded-xl border border-[#C6FF00]/40 bg-[#C6FF00]/10 p-4 text-left"><Sparkles className="size-5 text-[#C6FF00]" aria-hidden="true" /><p className="mt-2 font-bold">Versão completa · {FULL_PRICE}</p><p className="mt-1 text-xs text-zinc-300">{FULL.description} Pagamento único.</p>
          {paymentsEnabled ? (account ? <button type="button" disabled={busy} onClick={buy} className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#C6FF00] px-4 font-bold text-[#0B0B10] hover:bg-[#d5ff4a] disabled:opacity-50">{busy ? 'Abrindo pagamento…' : 'Comprar agora'}</button> : <p className="mt-3 text-xs text-zinc-400">Entre ou crie uma conta para comprar.</p>) : <p className="mt-3 text-xs text-zinc-400">Em breve.</p>}
        </div>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      <button type="button" onClick={onLeave} className="mt-5 text-sm text-zinc-400 underline-offset-4 hover:text-white hover:underline">Voltar amanhã</button>
    </div>
  </div>;
}
