import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Maximize, Monitor, Play, Smartphone } from "lucide-react";
import { paymentsEnabled } from "@/lib/site-config";
import { PRODUCTS, formatPrice, productList } from "@/lib/products.mjs";
import { AdSlot } from "@/components/ad-slot";
import { GameCard } from "@/components/game-card";
import { GameControls } from "@/components/game-controls";
import { GamePlayer } from "@/components/game-player";
import { GameStore } from "@/components/game-store";
import { ValeFeatures } from "@/components/vale-features";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { absoluteUrl, categoryLabels, deviceLabel, games, SITE_NAME, SITE_URL, type Game } from "@/lib/games";

export function generateStaticParams() { return games.map((game) => ({ slug: game.slug })); }

const genreMap: Record<Game["categoria"], string> = { acao: "Action", corrida: "Racing", aventura: "Adventure", puzzle: "Puzzle", casual: "Casual" };

function faqFor(game: Game) {
  const controls = [...game.controles.teclado, ...game.controles.toque].join("; ");
  return [
    { q: `Como jogar ${game.nome}?`, a: `${game.objetivo} Basta abrir a página e tocar em Jogar: o jogo roda no navegador, sem download e sem cadastro.` },
    { q: `Quais são os controles de ${game.nome}?`, a: controls || "Use o mouse ou o toque na tela." },
    { q: `${game.nome} funciona no celular?`, a: game.dispositivos.includes("mobile") ? `Sim. ${game.nome} oferece controles de toque no celular${game.orientacao === "paisagem" ? " e é jogado na horizontal, em tela cheia" : ""}. O desempenho depende do aparelho e do navegador.` : `${game.nome} é indicado para computador, com teclado.` },
    { q: `${game.nome} é grátis?`, a: game.slug === "vale-dos-blocos" ? `Sim, para jogar no navegador: 15 minutos por dia como visitante e 60 minutos com conta gratuita. A versão completa, por ${formatPrice(PRODUCTS["vale-completo"].priceCents)} em pagamento único, remove o limite de tempo e salva o mundo na nuvem.` : `Sim. ${game.nome} é gratuito no navegador, dentro do tempo diário: 15 minutos como visitante e 60 minutos com conta.` },
  ];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const game = games.find((item) => item.slug === slug);
  if (!game) return {};
  const title = game.slug === "vale-dos-blocos" ? "Vale dos Blocos: jogo de construir em blocos online no navegador" : `${game.nome}: jogar grátis online`;
  const description = `${game.resumo} Jogue ${game.nome} grátis no navegador, ${deviceLabel(game.dispositivos).toLowerCase()}, sem cadastro.`;
  const shareImage = game.capa.endsWith(".svg") ? "/og.png" : game.capa;
  return {
    title,
    description,
    alternates: { canonical: `/jogos/${game.slug}` },
    openGraph: { type: "website", locale: "pt_BR", siteName: SITE_NAME, url: `/jogos/${game.slug}`, title: `${game.nome} | ${SITE_NAME}`, description, images: [{ url: shareImage, width: shareImage === "/og.png" ? 1200 : 1280, height: shareImage === "/og.png" ? 630 : 720, alt: `Capa de ${game.nome}` }] },
    twitter: { card: "summary_large_image", title: `${game.nome} | ${SITE_NAME}`, description, images: [shareImage] },
    robots: game.status === "disponivel" ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = games.find((item) => item.slug === slug);
  if (!game) notFound();
  const others = games.filter((item) => item.slug !== game.slug && item.status === "disponivel");
  const related = [...others.filter((item) => item.categoria === game.categoria), ...others.filter((item) => item.categoria !== game.categoria)].slice(0, 3);
  const faq = faqFor(game);
  const sales = game.slug === "vale-dos-blocos";
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "VideoGame", "@id": `${absoluteUrl(`/jogos/${game.slug}`)}#game`, name: game.nome, url: absoluteUrl(`/jogos/${game.slug}`), description: game.descricao, image: absoluteUrl(game.capa),
        genre: genreMap[game.categoria], inLanguage: "pt-BR", isAccessibleForFree: true, playMode: "SinglePlayer", applicationCategory: "Game", operatingSystem: "Web browser", gamePlatform: game.dispositivos.map((d) => (d === "mobile" ? "Mobile" : "Desktop")),
        datePublished: game.publicadoEm, author: { "@id": `${SITE_URL}/#organization` }, publisher: { "@id": `${SITE_URL}/#organization` },
        offers: sales
          ? [{ "@type": "Offer", name: "Jogar grátis (15 a 60 min por dia)", price: "0", priceCurrency: "BRL", availability: "https://schema.org/InStock", url: absoluteUrl(`/jogos/${game.slug}`) },
             { "@type": "Offer", name: PRODUCTS["vale-completo"].title, price: (PRODUCTS["vale-completo"].priceCents / 100).toFixed(2), priceCurrency: "BRL", availability: "https://schema.org/InStock", url: absoluteUrl("/comprar/vale-completo") }]
          : { "@type": "Offer", price: "0", priceCurrency: "BRL", availability: game.status === "disponivel" ? "https://schema.org/InStock" : "https://schema.org/PreOrder" },
        ...(sales ? { alternateName: ["Vale dos Blocos", "jogo de blocos brasileiro"], keywords: "jogo de construir, blocos, voxel, portais, Brasil, Rio de Janeiro, Nova York, pets, pescaria, navegador", gameItem: ["picareta", "espada", "espingarda", "pá", "foice", "barco", "carretinha"], gameLocation: ["Sertão", "Minas Gerais", "Rio de Janeiro", "Tríplice Fronteira", "Nova York", "Estados Unidos", "China", "Japão", "Submundo"], screenshot: [absoluteUrl("/jogos/vale-dos-blocos/abertura.jpg"), absoluteUrl("/jogos/vale-dos-blocos/terra-rio.jpg"), absoluteUrl("/jogos/vale-dos-blocos/terra-nyc.jpg")], howToPlay: absoluteUrl(`/jogos/${game.slug}/como-jogar`) } : {}),
      },
      { "@type": "BreadcrumbList", itemListElement: [ { "@type": "ListItem", position: 1, name: "Jogos", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: categoryLabels[game.categoria], item: absoluteUrl(`/?categoria=${game.categoria}`) }, { "@type": "ListItem", position: 3, name: game.nome, item: absoluteUrl(`/jogos/${game.slug}`) } ] },
      { "@type": "FAQPage", mainEntity: faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) },
    ],
  };

  return <div className="grain min-h-[100dvh] bg-[#0B0B10] text-zinc-100"><SiteHeader /><main>
    <section className="relative overflow-hidden pb-12 pt-6 text-white sm:pb-16"><div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_85%_0%,rgb(192_0_255/.28),transparent_60%)]" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-8">
        <nav aria-label="Caminho" className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-400"><Link href="/#catalogo" className="inline-flex items-center gap-2 transition-colors hover:text-white"><ArrowLeft className="size-4" aria-hidden="true" /> Jogos</Link><span aria-hidden="true">/</span><span>{categoryLabels[game.categoria]}</span><span aria-hidden="true">/</span><span className="text-white">{game.nome}</span></nav>
        <div className="mt-8 grid items-center gap-8 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-5">
            <h1 className="text-5xl font-black leading-[0.95] tracking-[-0.04em] sm:text-6xl lg:text-7xl">{game.nome}</h1>
            <p className="mt-4 max-w-[40ch] text-lg leading-relaxed text-zinc-300">{game.resumo}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#jogar" className="btn-hero"><Play className="size-5 fill-current" aria-hidden="true" /> Jogar grátis</a>
              <Link href={`/jogos/${game.slug}/como-jogar`} className="inline-flex min-h-14 items-center gap-2 rounded-xl border border-white/20 px-5 text-base font-semibold text-white transition hover:bg-white/10 active:translate-y-px"><BookOpen className="size-4" aria-hidden="true" /> Como jogar</Link>
              {sales && <a href="#loja" className="inline-flex min-h-14 items-center gap-2 rounded-xl border border-[#C6FF00]/40 px-5 text-base font-semibold text-[#C6FF00] transition hover:bg-[#C6FF00]/10 active:translate-y-px">Versão completa {formatPrice(PRODUCTS["vale-completo"].priceCents)}</a>}
            </div>
          </div>
          <figure className="overflow-hidden rounded-3xl border border-white/10 bg-[#14131c] shadow-[0_40px_80px_-30px_rgba(192,0,255,.6)] md:col-span-7">
            <img src={sales ? "/jogos/vale-dos-blocos/abertura.jpg" : game.capa} alt={sales ? "Tela de abertura do Vale dos Blocos: casa, garagem, estrada e pets em um mundo de blocos" : `Capa de ${game.nome}`} width={sales ? 1160 : 1280} height={sales ? 760 : 720} fetchPriority="high" className="aspect-[3/2] h-auto w-full object-cover" />
          </figure>
        </div>
      </div>
    </section>
    <section className="py-8 sm:py-12"><div className="mx-auto max-w-7xl px-4 sm:px-8"><p className="mb-3 inline-flex items-center gap-2 text-sm text-zinc-400"><Maximize className="size-4 text-[#C6FF00]" aria-hidden="true" />Ao tocar em Jogar, o jogo abre na tela inteira. Use Sair para voltar.</p><div id="jogar" className="scroll-mt-24"><GamePlayer key={game.slug} game={game} /></div>
      <section className="mt-10 max-w-[70ch]" aria-label="Sobre o jogo"><p className="text-base leading-relaxed text-zinc-300">{game.descricao}</p><p className="mt-4 flex flex-wrap gap-5 text-sm font-medium text-zinc-400">{game.dispositivos.includes("desktop") && <span className="inline-flex items-center gap-2"><Monitor className="size-4" aria-hidden="true" /> Computador</span>}{game.dispositivos.includes("mobile") && <span className="inline-flex items-center gap-2"><Smartphone className="size-4" aria-hidden="true" /> Celular{game.orientacao === "paisagem" ? " (horizontal)" : ""}</span>}</p></section>
      {sales && <><ValeFeatures /><GameStore products={productList()} returnTo={`/jogos/${game.slug}`} /></>}
      <GameControls game={game} />
      <section className="mt-14 sm:mt-20"><h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Perguntas frequentes sobre {game.nome}</h2><dl className="mt-4 grid gap-4 md:grid-cols-2">{faq.map((item) => <div key={item.q} className="rounded-2xl border border-white/10 bg-[#14131c] p-5"><dt className="font-bold text-white">{item.q}</dt><dd className="mt-2 text-sm leading-6 text-zinc-300">{item.a}</dd></div>)}</dl></section>
      <div className="mt-10"><AdSlot placement="jogo" /></div>
      {related.length > 0 && <section className="mt-14 sm:mt-20"><h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Jogos relacionados</h2><div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{related.map((item) => <GameCard key={item.slug} game={item} />)}</div></section>}
    </div></section>
  </main><SiteFooter /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /></div>;
}
