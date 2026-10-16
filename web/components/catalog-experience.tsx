"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Gamepad2, Maximize, Play, Search, Smartphone, Timer, X } from "lucide-react";
import { AdSlot } from "@/components/ad-slot";
import { GameCard } from "@/components/game-card";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { categoryLabels, deviceLabel, type Game } from "@/lib/games";
type Filter = keyof typeof categoryLabels;

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");
const PERKS = [
  { icon: Play, title: "Abre e joga", text: "Direto no navegador, sem instalar nada." },
  { icon: Maximize, title: "Tela inteira", text: "O jogo ocupa a tela toda ao começar." },
  { icon: Smartphone, title: "Celular e tablet", text: "Controles de toque nos jogos compatíveis." },
  { icon: Timer, title: "Comece grátis", text: "15 min por dia, 60 com conta. Completo sem limite." },
];

export function CatalogExperience({ games, initialCategory = "todos" }: { games: Game[]; initialCategory?: Filter }) {
  const [query, setQuery] = useState(""); const [filter, setFilter] = useState<Filter>(initialCategory);
  const available = games.filter(g => g.status === "disponivel");
  const featured = available.find(g => g.slug === "valleyblocks") || available.find(g => g.destaque) || available[0];
  const trending = available.filter(g => g.slug !== featured?.slug && g.destaque).concat(available.filter(g => g.slug !== featured?.slug && !g.destaque)).slice(0, 3);
  const isVale = featured?.slug === "valleyblocks";
  const heroImage = isVale ? "/jogos/valleyblocks/abertura.jpg" : featured?.capa;
  const normalized = fold(query);
  const results = useMemo(() => games.filter(g => (filter === "todos" || g.categoria === filter) && fold(`${g.nome} ${g.resumo} ${categoryLabels[g.categoria]}`).includes(normalized)), [filter, games, normalized]);
  const filtering = query.length > 0 || filter !== "todos"; const clear = () => { setQuery(""); setFilter("todos"); };
  const newest = games.slice().sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm)).slice(0, 8);
  return <div className="grain min-h-[100dvh] bg-[#0B0B10] text-zinc-100"><SiteHeader /><main>
    {featured && <section className="relative overflow-hidden">
      <img src={heroImage} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-2xl" />
      <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_15%_10%,rgb(192_0_255/.35),transparent_60%),linear-gradient(to_bottom,rgb(11_11_16/.4),#0B0B10)]" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-12 pt-8 sm:px-8 md:pb-20 md:pt-14 lg:grid-cols-12 lg:items-center">
        <div className="rise lg:col-span-5">
          <p className="inline-flex items-center gap-2 rounded-md bg-white/10 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#C6FF00]"><Gamepad2 className="size-3.5" aria-hidden="true" />Em destaque</p>
          <h1 className="mt-4 text-5xl font-black leading-[0.95] tracking-[-0.04em] text-white sm:text-6xl xl:text-7xl">{featured.nome}</h1>
          <p className="mt-5 max-w-[46ch] text-base leading-7 text-zinc-300 sm:text-lg">{isVale ? "Jogo de construir em blocos no navegador: monte sua casa, adote pets e atravesse portais para o Sertão, Minas, Rio, Nova York, China, Japão e outras terras." : featured.resumo}</p>
          <p className="mt-3 text-sm font-semibold text-zinc-400">{deviceLabel(featured.dispositivos)} · {categoryLabels[featured.categoria]}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href={`/jogos/${featured.slug}#jogar`} className="btn-hero"><Play className="size-5 fill-current" aria-hidden="true" />Jogar agora</Link>
            <Link href={`/jogos/${featured.slug}/como-jogar`} className="inline-flex min-h-14 items-center gap-2 rounded-xl border border-white/20 px-5 font-semibold text-white transition hover:bg-white/10 active:translate-y-px"><BookOpen className="size-4" aria-hidden="true" />Como jogar</Link>
          </div>
        </div>
        <div className="rise grid gap-4 [animation-delay:120ms] lg:col-span-7">
          <Link href={`/jogos/${featured.slug}`} className="group relative block aspect-video overflow-hidden rounded-3xl border border-white/10 shadow-[0_40px_80px_-30px_rgb(192_0_255/.6)]">
            <img src={heroImage} alt={isVale ? "ValleyBlocks: casa, garagem, estrada e pets em um mundo de blocos 3D" : `Capa de ${featured.nome}`} width={1160} height={760} fetchPriority="high" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
            <span className="absolute inset-0 grid place-items-center bg-[#0B0B10]/0 transition group-hover:bg-[#0B0B10]/30" aria-hidden="true"><span className="grid size-20 scale-90 place-items-center rounded-full bg-[#C6FF00] text-[#0B0B10] opacity-0 shadow-[0_12px_40px_rgb(198_255_0/.45)] transition group-hover:scale-100 group-hover:opacity-100"><Play className="ml-1 size-8 fill-current" /></span></span>
          </Link>
          {trending.length > 0 && <ul className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">{trending.map(g => <li key={g.slug} className="w-[70%] shrink-0 snap-start sm:w-auto"><Link href={`/jogos/${g.slug}`} className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-[#14131c]/80 p-2 pr-3 backdrop-blur transition hover:border-[#C000FF]/50"><img src={g.miniatura} alt="" aria-hidden="true" loading="lazy" className="aspect-video w-20 shrink-0 rounded-lg object-cover" /><span className="min-w-0"><span className="block truncate text-sm font-bold text-white">{g.nome}</span><span className="block text-xs text-zinc-400">{categoryLabels[g.categoria]}</span></span></Link></li>)}</ul>}
        </div>
      </div>
    </section>}

    <section aria-label="Como funciona" className="border-y border-white/10 bg-[#100f17]">
      <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 sm:px-8 lg:grid-cols-4">{PERKS.map(({ icon: Icon, title, text }) => <li key={title} className="flex gap-3 py-5 pr-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#C000FF]/15 text-[#D86BFF]"><Icon className="size-5" aria-hidden="true" /></span><span><span className="block text-sm font-bold text-white">{title}</span><span className="mt-0.5 block text-xs leading-5 text-zinc-400">{text}</span></span></li>)}</ul>
    </section>

    <section id="catalogo" className="scroll-mt-20 py-12 sm:py-16"><div className="mx-auto max-w-7xl px-4 sm:px-8">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><p className="text-sm font-bold uppercase tracking-[0.14em] text-[#D86BFF]">Catálogo</p><h2 className="mt-1 text-3xl font-black tracking-[-0.03em] text-white sm:text-4xl">Escolha seu próximo jogo</h2></div>
        <label className="flex h-12 w-full items-center gap-2 rounded-xl border border-white/15 bg-[#14131c] px-4 focus-within:border-[#C6FF00] md:max-w-sm"><Search className="size-4 text-zinc-400" aria-hidden="true" /><span className="sr-only">Buscar jogos</span><input value={query} onChange={e => setQuery(e.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-base text-white outline-none placeholder:text-zinc-500" placeholder="Buscar jogos" /></label>
      </div>
      <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filtrar por categoria">{(Object.keys(categoryLabels) as Filter[]).map(key => <button key={key} type="button" onClick={() => setFilter(key)} aria-pressed={filter === key} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold transition active:translate-y-px ${filter === key ? "bg-[#C6FF00] text-[#0B0B10]" : "bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"}`}>{categoryLabels[key]}</button>)}</div>
      {filtering && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-3 text-sm text-zinc-300"><p><strong className="text-white">{results.length}</strong> {results.length === 1 ? "jogo encontrado" : "jogos encontrados"}</p><button type="button" onClick={clear} className="inline-flex min-h-10 items-center gap-1.5 font-bold text-[#C6FF00] hover:text-white"><X className="size-4" aria-hidden="true" />Limpar filtros</button></div>}
      {results.length ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{results.map((g, i) => <GameCard key={g.slug} game={g} priority={i < 4} />)}</div>
        : <div className="mt-8 rounded-2xl border border-dashed border-white/15 bg-[#14131c] px-6 py-14 text-center"><h3 className="text-lg font-bold text-white">{games.length ? "Nenhum jogo encontrado" : "Novos jogos estão chegando"}</h3><p className="mt-2 text-sm text-zinc-400">{games.length ? "Tente outro nome ou remova os filtros para ver o catálogo completo." : "O catálogo será atualizado assim que os jogos estiverem prontos."}</p><button type="button" onClick={clear} className="mt-5 min-h-10 font-bold text-[#C6FF00]">Limpar filtros</button></div>}
      <div className="mt-12"><AdSlot placement="catalogo" /></div>
    </div></section>

    <section className="border-t border-white/10 bg-[#100f17] py-12 sm:py-16"><div className="mx-auto max-w-7xl px-4 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[0.14em] text-[#D86BFF]">Novidades</p><h2 className="mt-1 text-3xl font-black tracking-[-0.03em] text-white sm:text-4xl">Recém-chegados</h2></div><Link href="/guias" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold text-zinc-100 hover:bg-white/5"><BookOpen className="size-4" aria-hidden="true" />Guias de todos os jogos</Link></div>
      <ul className="no-scrollbar -mx-4 mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">{newest.map(g => <li key={`new-${g.slug}`} className="w-[78%] shrink-0 snap-start sm:w-[45%] lg:w-[30%] xl:w-[23%]"><GameCard game={g} /></li>)}</ul>
    </div></section>
  </main><SiteFooter /></div>;
}
