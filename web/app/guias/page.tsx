import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { categoryLabels, deviceLabel, games } from "@/lib/games";

export const metadata: Metadata = {
  title: "Como jogar: guias de todos os jogos",
  description: "Objetivo, controles no computador e no celular e dicas para começar cada jogo do ValleyBlocks.",
  alternates: { canonical: "/guias" },
};

export default function GuidesPage() {
  const list = games.filter(g => g.status === "disponivel");
  return <div className="grain min-h-[100dvh] bg-[#0B0B10] text-zinc-100"><SiteHeader /><main className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-8 sm:pt-16">
    <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#D86BFF]">Guias</p>
    <h1 className="mt-2 max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.04em] text-white sm:text-6xl">Como jogar cada jogo</h1>
    <p className="mt-5 max-w-[60ch] text-lg leading-8 text-zinc-300">Objetivo, controles e o que você precisa saber antes da primeira partida. Todos abrem no navegador, na tela inteira.</p>
    <ul className="mt-10 divide-y divide-white/10 border-y border-white/10">{list.map(g => <li key={g.slug}>
      <Link href={`/jogos/${g.slug}/como-jogar`} className="group grid items-center gap-4 py-5 transition sm:grid-cols-[10rem_1fr_auto] sm:gap-6">
        <img src={g.miniatura} alt="" aria-hidden="true" loading="lazy" className="aspect-video w-full rounded-xl object-cover sm:w-40" />
        <span className="min-w-0"><span className="text-xs font-bold uppercase tracking-wider text-zinc-500">{categoryLabels[g.categoria]} · {deviceLabel(g.dispositivos)}</span><span className="mt-1 block text-xl font-extrabold tracking-tight text-white group-hover:text-[#C6FF00]">{g.nome}</span><span className="mt-1 block max-w-[70ch] text-sm leading-6 text-zinc-400">{g.objetivo}</span></span>
        <span className="hidden size-11 place-items-center rounded-full border border-white/15 text-white transition group-hover:border-[#C6FF00] group-hover:bg-[#C6FF00] group-hover:text-[#0B0B10] sm:grid"><ArrowUpRight className="size-5" aria-hidden="true" /></span>
      </Link>
    </li>)}</ul>
  </main><SiteFooter /></div>;
}
