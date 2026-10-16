import Link from "next/link";
import { BookOpen, Monitor, Play, Smartphone } from "lucide-react";
import { categoryLabels, deviceLabel, type Game } from "@/lib/games";

const PAID = new Set(["vale-dos-blocos"]);

export function GameCard({ game, priority = false }: { game: Game; priority?: boolean }) {
  const ready = game.status === "disponivel";
  return <article className="glow-card group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#14131c] transition duration-300 hover:-translate-y-1 hover:border-[#C000FF]/50 hover:shadow-[0_24px_48px_-24px_rgb(192_0_255/.55)]">
    <Link href={`/jogos/${game.slug}`} className="relative block aspect-video overflow-hidden bg-[#0B0B10]" aria-label={`Abrir ${game.nome}`}>
      <img src={game.miniatura} alt={`Miniatura de ${game.nome}`} loading={priority ? "eager" : "lazy"} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]" />
      <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#14131c] to-transparent" aria-hidden="true" />
      <span className="absolute left-3 top-3 rounded-md bg-[#0B0B10]/80 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-100 backdrop-blur-sm">{categoryLabels[game.categoria]}</span>
      {PAID.has(game.slug) && <span className="absolute right-3 top-3 rounded-md bg-[#C6FF00] px-2 py-1 text-[11px] font-black uppercase tracking-wider text-[#0B0B10]">Versão completa</span>}
      {ready && <span className="absolute bottom-3 right-3 grid size-12 translate-y-2 place-items-center rounded-full bg-[#C6FF00] text-[#0B0B10] opacity-0 shadow-[0_8px_24px_rgb(198_255_0/.35)] transition duration-300 group-hover:translate-y-0 group-hover:opacity-100" aria-hidden="true"><Play className="ml-0.5 size-5 fill-current" /></span>}
    </Link>
    <div className="flex flex-1 flex-col p-4 sm:p-5">
      <h3 className="text-lg font-extrabold tracking-tight text-white">{game.nome}</h3>
      <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-zinc-400">{game.resumo}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4 text-xs font-medium text-zinc-400">
        <span className="flex items-center gap-1.5">{game.dispositivos.includes("mobile") ? <Smartphone className="size-3.5" aria-hidden="true" /> : <Monitor className="size-3.5" aria-hidden="true" />}{deviceLabel(game.dispositivos)}</span>
        {ready ? <span className="flex items-center gap-2">
          <Link href={`/jogos/${game.slug}/como-jogar`} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 font-semibold text-zinc-300 hover:bg-white/5 hover:text-white"><BookOpen className="size-3.5" aria-hidden="true" />Como jogar</Link>
          <Link href={`/jogos/${game.slug}#jogar`} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-white/10 px-3 font-bold text-white transition hover:bg-[#C6FF00] hover:text-[#0B0B10] active:translate-y-px"><Play className="size-3.5 fill-current" aria-hidden="true" />Jogar</Link>
        </span> : <span className="font-bold text-zinc-500">Em breve</span>}
      </div>
    </div>
  </article>;
}
