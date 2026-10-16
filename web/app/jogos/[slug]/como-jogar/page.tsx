import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Cpu, Maximize, Monitor, MousePointerClick, Play, RotateCw, Smartphone, Timer } from "lucide-react";
import { GameControls } from "@/components/game-controls";
import { ValeFeatures } from "@/components/vale-features";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { categoryLabels, deviceLabel, games, SITE_NAME } from "@/lib/games";

export function generateStaticParams() { return games.filter(g => g.status === "disponivel").map(g => ({ slug: g.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const game = games.find(g => g.slug === slug);
  if (!game) return {};
  const title = `Como jogar ${game.nome}: objetivo, controles e dicas`;
  const description = `Guia de ${game.nome}: ${game.objetivo} Veja os controles no ${game.dispositivos.includes("mobile") ? "computador e no celular" : "computador"} e comece a jogar no navegador.`;
  return { title, description, alternates: { canonical: `/jogos/${game.slug}/como-jogar` }, openGraph: { type: "article", locale: "pt_BR", siteName: SITE_NAME, url: `/jogos/${game.slug}/como-jogar`, title, description, images: [{ url: game.capa.endsWith(".svg") ? "/og.png" : game.capa }] } };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = games.find(g => g.slug === slug);
  if (!game || game.status !== "disponivel") notFound();
  const mobile = game.dispositivos.includes("mobile");
  const steps = [
    { icon: MousePointerClick, title: "Toque em Jogar", text: `Na página de ${game.nome}, toque em Jogar. Não precisa instalar nada.` },
    { icon: Maximize, title: "Tela inteira", text: "O jogo abre ocupando a tela toda. Para voltar ao site, use o botão Sair." },
    ...(mobile && game.orientacao === "paisagem" ? [{ icon: RotateCw, title: "Celular deitado", text: "No celular ou tablet, jogue com o aparelho na horizontal." }] : []),
    { icon: Timer, title: "Seu tempo do dia", text: game.slug === "vale-dos-blocos" ? "15 minutos por dia como visitante, 60 com conta. A versão completa não tem limite." : "15 minutos por dia como visitante e 60 com conta gratuita." },
  ];
  return <div className="grain min-h-[100dvh] bg-[#0B0B10] text-zinc-100"><SiteHeader /><main>
    <section className="relative overflow-hidden">
      <img src={game.capa} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-2xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0B0B10]/30 to-[#0B0B10]" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-8 sm:pb-14">
        <nav aria-label="Caminho" className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-400"><Link href="/guias" className="inline-flex items-center gap-2 hover:text-white"><ArrowLeft className="size-4" aria-hidden="true" />Guias</Link><span aria-hidden="true">/</span><Link href={`/jogos/${game.slug}`} className="hover:text-white">{game.nome}</Link></nav>
        <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#D86BFF]">Como jogar · {categoryLabels[game.categoria]}</p>
            <h1 className="mt-3 text-4xl font-black leading-[0.95] tracking-[-0.04em] text-white sm:text-6xl">{game.nome}</h1>
            <p className="mt-5 max-w-[60ch] text-lg leading-8 text-zinc-300">{game.descricao}</p>
            <div className="mt-7 flex flex-wrap gap-3"><Link href={`/jogos/${game.slug}#jogar`} className="btn-hero"><Play className="size-5 fill-current" aria-hidden="true" />Jogar agora</Link></div>
          </div>
          <figure className="overflow-hidden rounded-3xl border border-white/10 shadow-[0_40px_80px_-30px_rgb(192_0_255/.6)] lg:col-span-6"><img src={game.capa} alt={`Capa de ${game.nome}`} className="aspect-video w-full object-cover" /></figure>
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-7xl space-y-14 px-4 pb-16 sm:px-8 sm:space-y-20">
      <section aria-labelledby="objetivo" className="grid gap-6 rounded-3xl border border-white/10 bg-[#14131c] p-6 sm:p-8 md:grid-cols-[auto_1fr] md:items-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-[#C6FF00] text-[#0B0B10]"><Play className="size-6 fill-current" aria-hidden="true" /></span>
        <div><h2 id="objetivo" className="text-2xl font-black tracking-tight text-white sm:text-3xl">Objetivo</h2><p className="mt-2 max-w-[70ch] text-base leading-7 text-zinc-300 sm:text-lg">{game.objetivo}</p></div>
      </section>

      <section aria-labelledby="comecar">
        <h2 id="comecar" className="text-2xl font-black tracking-tight text-white sm:text-3xl">Para começar</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{steps.map(({ icon: Icon, title, text }, i) => <li key={title} className="relative rounded-2xl border border-white/10 bg-[#14131c] p-5"><span className="absolute right-4 top-3 font-[family-name:var(--font-display)] text-4xl font-black text-white/10" aria-hidden="true">{i + 1}</span><Icon className="size-6 text-[#C6FF00]" aria-hidden="true" /><h3 className="mt-4 font-bold text-white">{title}</h3><p className="mt-1 text-sm leading-6 text-zinc-400">{text}</p></li>)}</ol>
      </section>

      <GameControls game={game} />

      {game.slug === "vale-dos-blocos" && <ValeFeatures />}

      <section aria-labelledby="aparelhos" className="grid gap-4 md:grid-cols-2">
        <h2 id="aparelhos" className="sr-only">Aparelhos e requisitos</h2>
        <div className="rounded-2xl border border-white/10 bg-[#14131c] p-6"><h3 className="flex items-center gap-2 font-bold text-white">{mobile ? <Smartphone className="size-5 text-[#D86BFF]" aria-hidden="true" /> : <Monitor className="size-5 text-[#D86BFF]" aria-hidden="true" />}Onde jogar</h3><p className="mt-2 text-sm leading-6 text-zinc-300">{deviceLabel(game.dispositivos)}{mobile ? (game.orientacao === "paisagem" ? ", celular e tablet na horizontal." : ".") : ". Em celular e tablet ele ainda não tem controles de toque."}</p></div>
        <div className="rounded-2xl border border-white/10 bg-[#14131c] p-6"><h3 className="flex items-center gap-2 font-bold text-white"><Cpu className="size-5 text-[#D86BFF]" aria-hidden="true" />Requisitos</h3><ul className="mt-2 space-y-1 text-sm leading-6 text-zinc-300">{game.requisitos.map(r => <li key={r}>{r}</li>)}</ul></div>
      </section>

      <section className="flex flex-col items-start justify-between gap-5 rounded-3xl bg-[radial-gradient(90%_120%_at_0%_0%,rgb(192_0_255/.35),transparent_60%),#14131c] p-6 ring-1 ring-white/10 sm:flex-row sm:items-center sm:p-10">
        <div><h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Pronto para jogar?</h2><p className="mt-2 text-zinc-300">O jogo abre na tela inteira assim que você tocar em Jogar.</p></div>
        <Link href={`/jogos/${game.slug}#jogar`} className="btn-hero"><Play className="size-5 fill-current" aria-hidden="true" />Jogar {game.nome}</Link>
      </section>
    </div>
  </main><SiteFooter /></div>;
}
