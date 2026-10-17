"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Silkscreen } from "next/font/google";
import { ChevronRight, ChevronLeft, ArrowRight, ArrowUpRight, Monitor, Smartphone, Play, User, Star } from "lucide-react";

// Landing de divulgação do ValleyBlocks, no formato de portal de jogo: herói em
// carrossel, grade de destaques, cartões de terras, faixa de novidade, oferta,
// carrossel de extras, vitrine de modos com abas, perguntas e rodapé completo.
// Tudo é nosso: textos, capturas reais em /jogos/vale-dos-blocos e arte gerada.
// Para trocar uma arte, salve o arquivo com o mesmo nome em public/.

const pixel = Silkscreen({ subsets: ["latin"], weight: ["400", "700"], display: "swap" });

export type ValleyLandingProps = {
  playHref: string;
  buyHref: string;
  fullPrice: string;
  guideHref: string;
  accountHref: string;
  privacyHref: string;
  termsHref: string;
  contactHref: string;
  /** Quando a landing mora dentro do portal LABSGames, mostra o caminho de volta. */
  portalHref?: string;
};

const IMG = "/jogos/vale-dos-blocos";
const ORANGE = "bg-[#ff9f1c] text-[#1b1206] shadow-[0_4px_0_#a85d00] hover:bg-[#ffb347]";
const GREEN = "bg-[#3c8527] text-white shadow-[0_4px_0_#1f4d12] hover:bg-[#4a9e31]";
const YELLOW = "bg-[#ffd23f] text-black shadow-[0_4px_0_#9c7a00] hover:bg-[#ffe066]";
const btn = "inline-flex min-h-12 items-center gap-2 px-6 text-sm font-bold uppercase tracking-wide transition active:translate-y-1 active:shadow-none";

const SLIDES = [
  { img: "arte-heroi.jpg", kicker: "Grátis no navegador", title: "Construa o seu vale", text: "Casa, garagem, estrada, pets e um mundo inteiro de blocos para moldar do seu jeito.", cta: "Jogar grátis", href: "play" },
  { img: "arte-portal.jpg", kicker: "Nove terras", title: "Atravesse o portal", text: "Do Sertão a Nova York: monte a moldura, espirre o spray e chegue a outra terra.", cta: "Ver as terras", href: "#terras" },
  { img: "arte-noite.jpg", kicker: "Sobrevivência", title: "Aguente a noite", text: "Quando escurece, saem o Ceifador Rubro, o Saci e o Boitatá. Tochas e paredes ajudam.", cta: "Conhecer os modos", href: "#modos" },
];

const TERRAS = [
  { slug: "sertao", nome: "Sertão", tags: "Caatinga, Calor", extra: "Portal de cobre", texto: "Mandacarus, ossadas e calangos." },
  { slug: "minas", nome: "Minas Gerais", tags: "Morros, Grutas", extra: "Portal de diamante", texto: "Grutas, capivaras e onças." },
  { slug: "rio", nome: "Rio de Janeiro", tags: "Praia, Cidade", extra: "Portal de pedra portuguesa", texto: "Copacabana e o Cristo." },
  { slug: "japao", nome: "Japão", tags: "Cerejeiras, Montanha", extra: "Portal de ouro", texto: "Cerejeiras e o monte Fuji." },
  { slug: "triplice", nome: "Tríplice Fronteira", tags: "Cataratas, Comércio", extra: "Portal de esmeralda", texto: "Ponte da Amizade e Cataratas." },
  { slug: "nyc", nome: "Nova York", tags: "Arranha-céus, Porto", extra: "Portal de aço", texto: "Central Park e a Liberdade." },
  { slug: "eua", nome: "Grand Canyon", tags: "Cânion, Deserto", extra: "Portal de urânio", texto: "Paredões vermelhos e bisões." },
  { slug: "china", nome: "China", tags: "Bambu, Muralha", extra: "Portal de rubi", texto: "Pagode, pandas e a Muralha." },
  { slug: "submundo", nome: "Submundo", tags: "Lava, Perigo", extra: "Portal de obsidiana", texto: "Lava e o Golem de Magma." },
];

const EXTRAS = [
  { img: "arte-pets.jpg", tag: "Pets", nome: "Cachorros e gatos", by: "Três pelagens cada", note: "Adote" },
  { img: "arte-carro.jpg", tag: "Veículos", nome: "Carro e carretinha", by: "Compacto ou utilitário", note: "Na garagem" },
  { img: "arte-pesca.jpg", tag: "Pesca", nome: "Do lambari ao pirarucu", by: "Rios e mar", note: "Vara" },
  { img: "arte-morador.jpg", tag: "Missões", nome: "Livro de missões", by: "Um morador por terra", note: "Tecla J" },
  { img: "arte-trocas.jpg", tag: "Trocas", nome: "Vendedores e moradores", by: "Pague em esmeraldas", note: "Negocie" },
  { img: "arte-bichos.jpg", tag: "Bichos", nome: "Pandas, onças, bisões", by: "Cada terra tem os seus", note: "Explore" },
  { img: "arte-noite.jpg", tag: "Noite", nome: "Onze inimigos", by: "Do Saci ao Golem", note: "Cuidado" },
  { img: "arte-amigos.jpg", tag: "Amigos", nome: "Sala com amigos", by: "Até 4 jogadores", note: "Completo" },
];

const MODOS = [
  { id: "criativo", nome: "Criativo", img: "arte-heroi.jpg", texto: "Blocos ilimitados, voo livre e inimigos que não causam dano. Para imaginar sem pressa." },
  { id: "sobrevivencia", nome: "Sobrevivência", img: "arte-noite.jpg", texto: "Fome, fôlego e ferramentas que gastam. Um dia dura 24 minutos, e a noite traz perigo." },
  { id: "terras", nome: "Viagem", img: "arte-portal.jpg", texto: "Portais ligam nove terras com paisagem, bichos, moradores e inimigos próprios." },
  { id: "amigos", nome: "Com amigos", img: "arte-amigos.jpg", texto: "Na versão completa, crie uma sala, passe o código e construam juntos no mesmo mundo." },
];

const FAQ = [
  { q: "ValleyBlocks é grátis?", a: "Sim. No navegador você joga 15 minutos por dia como visitante e 60 minutos com conta gratuita. A versão completa, em pagamento único, tira o limite e guarda seu mundo na nuvem." },
  { q: "Preciso instalar alguma coisa?", a: "Não. O jogo roda direto no navegador. No Android, o app está em teste e chega à Play Store em breve." },
  { q: "Funciona no celular?", a: "Sim, com joystick e botões de toque, na horizontal. O desempenho depende do aparelho." },
  { q: "Dá para jogar com amigos?", a: "Sim. Na versão completa você cria uma sala e joga com até 3 amigos no mesmo mundo." },
  { q: "Para que idade?", a: "Para toda a família. Não há sangue nem conteúdo adulto. No Criativo os inimigos não causam dano." },
  { q: "Quem faz o jogo?", a: "ValleyBlocks é feito no Brasil pela LABSGames, com terras inspiradas em lugares reais." },
];

function Logo() {
  return <span className={`${pixel.className} flex items-center gap-2 text-xl font-bold uppercase tracking-tight text-white sm:text-2xl`}>
    <svg viewBox="0 0 64 64" className="size-8 shrink-0" aria-hidden="true"><path d="m12 23 20-11 20 11-20 12z" fill="#b7d184" /><path d="m12 23 20 12v21L12 44z" fill="#8fa966" /><path d="m32 35 20-12v21L32 56z" fill="#527744" /></svg>
    <span>Valley<span className="text-[#7fd34e]">Blocks</span></span>
  </span>;
}

function H2({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <h2 id={id} className={`${pixel.className} text-3xl font-bold uppercase leading-[1.05] sm:text-5xl ${className}`}>{children}</h2>;
}

export function ValleyLanding(p: ValleyLandingProps) {
  const go = (href: string) => (href === "play" ? p.playHref : href);
  return <div className="min-h-[100dvh] bg-[#1e1e1f] text-[#e6e6e6]">
    <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-[#ff9f1c] focus:px-4 focus:py-2 focus:text-black">Ir para o conteúdo</a>
    <Header {...p} />
    <main id="conteudo">
      <Hero go={go} />
      <Destaques {...p} />
      <Terras playHref={p.playHref} />
      <Novidade playHref={p.playHref} />
      <Oferta accountHref={p.accountHref} />
      <Extras playHref={p.playHref} />
      <Modos buyHref={p.buyHref} fullPrice={p.fullPrice} playHref={p.playHref} />
      <Faq />
    </main>
    <Footer {...p} />
  </div>;
}

function Header(p: ValleyLandingProps) {
  const [open, setOpen] = useState(false);
  const links = [{ href: "#destaques", label: "Jogo" }, { href: "#terras", label: "Terras" }, { href: "#extras", label: "Explorar" }, { href: p.guideHref, label: "Aprenda" }, { href: p.contactHref, label: "Suporte" }];
  return <header className="sticky top-0 z-40 bg-[#131313]/95 shadow-[0_2px_0_rgba(0,0,0,.4)] backdrop-blur">
    <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-8">
      <Link href="/" aria-label="ValleyBlocks, início"><Logo /></Link>
      <nav aria-label="Principal" className="hidden items-center gap-7 text-[13px] font-bold uppercase tracking-wide text-white lg:flex">
        {links.map(l => <Link key={l.label} href={l.href} className="py-2 hover:text-[#7fd34e]">{l.label}</Link>)}
      </nav>
      <div className="flex items-center gap-3">
        <Link href={p.playHref} className="hidden min-h-9 items-center gap-1 border border-[#7fd34e] px-3 text-xs font-bold uppercase text-[#7fd34e] transition hover:bg-[#7fd34e] hover:text-black sm:inline-flex">Jogar grátis <ChevronRight className="size-3.5" aria-hidden="true" /></Link>
        <Link href={p.accountHref} className="inline-flex min-h-9 items-center gap-1.5 text-xs font-bold uppercase text-white hover:text-[#7fd34e]"><User className="size-4" aria-hidden="true" />Conta</Link>
        <button type="button" className="inline-flex size-10 items-center justify-center text-white lg:hidden" aria-expanded={open} aria-controls="menu-movel" aria-label="Menu" onClick={() => setOpen(o => !o)}>
          <span className="flex flex-col gap-1.5" aria-hidden="true"><span className="block h-0.5 w-6 bg-current" /><span className="block h-0.5 w-6 bg-current" /><span className="block h-0.5 w-6 bg-current" /></span>
        </button>
      </div>
    </div>
    {open && <nav id="menu-movel" aria-label="Menu" className="border-t border-white/10 bg-[#131313] px-4 py-3 lg:hidden">
      {links.map(l => <Link key={l.label} href={l.href} onClick={() => setOpen(false)} className="block py-3 text-sm font-bold uppercase text-white">{l.label}</Link>)}
      <Link href={p.playHref} className={`${btn} ${GREEN} mt-2 w-full justify-center`}>Jogar grátis</Link>
    </nav>}
  </header>;
}

function Hero({ go }: { go: (href: string) => string }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI(n => (n + 1) % SLIDES.length), 7000);
    return () => clearInterval(t);
  }, [paused]);
  const s = SLIDES[i];
  return <section className="relative isolate flex min-h-[78vh] items-end overflow-hidden bg-black sm:items-center" aria-roledescription="carrossel" aria-label="Destaques" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
    {SLIDES.map((sl, n) => <img key={sl.img} src={`${IMG}/${sl.img}`} alt="" width={1600} height={1000} fetchPriority={n === 0 ? "high" : "low"} className={`absolute inset-0 -z-10 h-full w-full object-cover transition-opacity duration-700 ${n === i ? "opacity-100" : "opacity-0"}`} />)}
    <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/30 to-black/10 sm:bg-gradient-to-r sm:from-black/80 sm:via-black/35 sm:to-transparent" aria-hidden="true" />
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-20 pt-24 sm:px-8 sm:pb-24">
      <div key={i} className="rise max-w-xl" aria-live="polite">
        <p className="text-sm font-bold uppercase tracking-[.2em] text-[#7fd34e]">{s.kicker}</p>
        <h1 className={`${pixel.className} mt-3 text-5xl font-bold uppercase leading-[.95] text-white drop-shadow-[0_4px_0_rgba(0,0,0,.6)] sm:text-7xl`}>{s.title}</h1>
        <p className="mt-5 max-w-[42ch] text-lg leading-relaxed text-white/85">{s.text}</p>
        <Link href={go(s.href)} className={`${btn} ${ORANGE} mt-8 min-h-14 px-8 text-base`}>{s.cta} <ChevronRight className="size-5" aria-hidden="true" /></Link>
      </div>
    </div>
    <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-1">
      <button type="button" aria-label="Anterior" onClick={() => setI(n => (n + SLIDES.length - 1) % SLIDES.length)} className="inline-flex size-10 items-center justify-center text-white hover:text-[#7fd34e]"><ChevronLeft className="size-6" aria-hidden="true" /></button>
      {SLIDES.map((sl, n) => <button key={sl.img} type="button" aria-label={`Destaque ${n + 1}: ${sl.title}`} aria-current={n === i} onClick={() => setI(n)} className="flex size-10 items-center justify-center"><span className={`block size-3 border-2 border-white ${n === i ? "bg-white" : "bg-transparent"}`} /></button>)}
      <button type="button" aria-label="Próximo" onClick={() => setI(n => (n + 1) % SLIDES.length)} className="inline-flex size-10 items-center justify-center text-white hover:text-[#7fd34e]"><ChevronRight className="size-6" aria-hidden="true" /></button>
    </div>
  </section>;
}

function Card({ img, alt, title, link, href, className = "", big }: { img: string; alt: string; title: string; link: string; href: string; className?: string; big?: boolean }) {
  return <Link href={href} className={`group flex flex-col overflow-hidden bg-[#262626] ring-2 ring-transparent transition hover:shadow-[0_0_24px_rgba(76,195,255,.35)] hover:ring-[#4cc3ff]/70 ${className}`}>
    <span className="relative block flex-1 overflow-hidden"><img src={`${IMG}/${img}`} alt={alt} width={800} height={500} loading="lazy" className="h-full min-h-44 w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" /></span>
    <span className="block p-4 sm:p-5">
      <span className={`${pixel.className} block uppercase text-white ${big ? "text-xl sm:text-2xl" : "text-base sm:text-lg"}`}>{title}</span>
      {big ? <span className={`${btn} ${ORANGE} mt-4`}>{link} <ChevronRight className="size-4" aria-hidden="true" /></span>
        : <span className="mt-1.5 inline-flex items-center gap-1 text-sm font-bold text-[#ff9f1c]">{link} <ArrowUpRight className="size-3.5" aria-hidden="true" /></span>}
    </span>
  </Link>;
}

function Destaques(p: ValleyLandingProps) {
  return <section id="destaques" className="scroll-mt-16 bg-[#0d2a45] bg-[radial-gradient(ellipse_at_top,#14507d,transparent_70%)] py-10 sm:py-14">
    <div className="mx-auto grid max-w-[1440px] gap-4 px-4 sm:px-8 lg:grid-cols-2">
      <Card big img="arte-heroi.jpg" alt="Casa, garagem e estrada no vale do ValleyBlocks" title={`Versão completa por ${p.fullPrice}`} link="Comprar agora" href={p.buyHref} className="lg:row-span-2" />
      <Card img="arte-portal.jpg" alt="Jogador atravessando um portal de esmeralda para Copacabana" title="Explore uma nova terra" link="Ver os portais" href="#terras" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card img="arte-pets.jpg" alt="Cachorros e gatos de blocos brincando no gramado" title="Adote um pet" link="Cães e gatos" href="#extras" />
        <Card img="arte-morador.jpg" alt="Morador do Sertão oferecendo uma missão" title="Ajude os moradores" link="Livro de missões" href="#novidade" />
      </div>
    </div>
  </section>;
}

function Terras({ playHref }: { playHref: string }) {
  const [all, setAll] = useState(false);
  const list = all ? TERRAS : TERRAS.slice(0, 4);
  return <section id="terras" className="scroll-mt-16 bg-[#161616] py-14 sm:py-20">
    <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><H2 className="text-white">Escolha sua terra</H2>
        <button type="button" onClick={() => setAll(a => !a)} aria-expanded={all} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold uppercase text-[#ff9f1c] hover:underline">{all ? "Mostrar menos" : "Ver as nove"} <ChevronRight className="size-4" aria-hidden="true" /></button></div>
      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {list.map(t => <li key={t.slug}><Link href={playHref} className="group block">
          <span className="block overflow-hidden"><img src={`${IMG}/terra-${t.slug}.jpg`} alt={`${t.nome} no ValleyBlocks`} width={720} height={720} loading="lazy" className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" /></span>
          <span className="mt-4 block text-xl font-semibold text-white">{t.nome}</span>
          <span className="mt-1 block text-sm text-white/60">{t.tags}</span>
          <span className="mt-0.5 block text-sm text-white/60">{t.extra}</span>
          <span className="mt-3 flex items-center gap-3 border-t border-white/10 pt-3 text-white/50"><Monitor className="size-4 shrink-0" aria-label="Computador" /><Smartphone className="size-4 shrink-0" aria-label="Celular" /><span className="text-xs">{t.texto}</span></span>
        </Link></li>)}
      </ul>
    </div>
  </section>;
}

function Novidade({ playHref }: { playHref: string }) {
  return <section id="novidade" className="relative scroll-mt-16 overflow-hidden bg-[#0b3a66] py-14 sm:py-20">
    <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(#ffffff22_2px,transparent_2px),linear-gradient(90deg,#ffffff22_2px,transparent_2px)] [background-size:48px_48px]" aria-hidden="true" />
    <div className="relative mx-auto grid max-w-[1200px] items-center gap-10 px-4 sm:px-8 lg:grid-cols-[1.3fr_1fr]">
      <div className="border-[6px] border-[#6fe3ff] bg-black p-1 shadow-[0_0_40px_rgba(111,227,255,.45)]"><img src={`${IMG}/arte-morador.jpg`} alt="Zé do Gibão, morador do Sertão, oferecendo uma missão" width={900} height={560} loading="lazy" className="aspect-[16/10] w-full object-cover" /></div>
      <div>
        <p className="text-sm font-bold uppercase tracking-[.2em] text-[#6fe3ff]">Novidade</p>
        <H2 className="mt-3 text-white">Livro de missões</H2>
        <p className="mt-4 max-w-[46ch] text-lg leading-relaxed text-white/85">Cada terra tem um morador com um pedido. Leve calangos ao Zé do Gibão, rubis ao Mestre Wei, ouro ao Tony. Aperte J e veja o que falta.</p>
        <Link href={playHref} className={`${btn} ${ORANGE} mt-8`}>Começar a missão <ChevronRight className="size-4" aria-hidden="true" /></Link>
      </div>
    </div>
  </section>;
}

function Oferta({ accountHref }: { accountHref: string }) {
  return <section className="relative overflow-hidden bg-[#1a1a1a] py-16 sm:py-24">
    <div className="mx-auto grid max-w-[1100px] items-center gap-12 px-4 sm:px-8 md:grid-cols-2">
      <div>
        <H2 className="text-[#ffd23f] sm:text-6xl">Ganhe uma hora por dia</H2>
        <p className="mt-5 max-w-[42ch] text-lg leading-relaxed text-white/85">Visitantes jogam 15 minutos por dia. Crie sua conta grátis e o tempo sobe para 60 minutos, com seu personagem guardado.</p>
        <Link href={accountHref} className={`${btn} ${YELLOW} mt-8 w-full max-w-sm justify-center`}>Criar conta grátis <ChevronRight className="size-4" aria-hidden="true" /></Link>
      </div>
      <div className="relative mx-auto w-full max-w-xs">
        <div className="absolute -inset-8 bg-[#ffd23f]/25 blur-3xl" aria-hidden="true" />
        <div className="relative bg-[#3a3a3a] p-3 ring-2 ring-[#ffd23f]/60">
          <img src={`${IMG}/casa.jpg`} alt="Casa do jogador no vale" width={520} height={340} loading="lazy" className="aspect-[4/3] w-full object-cover" />
          <p className="mt-3 font-bold text-white">Conta gratuita</p>
          <p className="mt-1 text-sm text-white/70">60 minutos por dia · roupas salvas</p>
          <p className="mt-3 flex items-center justify-between text-sm"><span className="inline-flex items-center gap-1 text-white/80"><Star className="size-4 fill-[#ffd23f] text-[#ffd23f]" aria-hidden="true" />Para toda a família</span><span className={`${pixel.className} font-bold text-[#7fd34e]`}>Grátis</span></p>
        </div>
      </div>
    </div>
  </section>;
}

function Extras({ playHref }: { playHref: string }) {
  const scroll = (dir: number) => document.getElementById("extras-lista")?.scrollBy({ left: dir * 300, behavior: "smooth" });
  return <section id="extras" className="scroll-mt-16 bg-gradient-to-b from-[#222] to-[#3a2f0d] py-14 sm:py-20">
    <div className="mx-auto grid max-w-[1440px] gap-8 px-4 sm:px-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <div>
        <H2 className="text-[#ffd23f]">Tudo no seu vale</H2>
        <p className="mt-4 max-w-[38ch] text-base leading-relaxed text-white/80">Pets, carros, barco, pescaria, trocas e bichos de cada terra. Nada para comprar dentro do jogo: tudo se conquista jogando.</p>
        <Link href={playHref} className={`${btn} ${YELLOW} mt-6`}>Explorar o vale <ChevronRight className="size-4" aria-hidden="true" /></Link>
        <div className="mt-6 flex gap-2 text-white"><button type="button" aria-label="Voltar" onClick={() => scroll(-1)} className="inline-flex size-12 items-center justify-center hover:text-[#ffd23f]"><ArrowRight className="size-8 rotate-180" aria-hidden="true" /></button><button type="button" aria-label="Avançar" onClick={() => scroll(1)} className="inline-flex size-12 items-center justify-center hover:text-[#ffd23f]"><ArrowRight className="size-8" aria-hidden="true" /></button></div>
      </div>
      <ul id="extras-lista" className="no-scrollbar flex snap-x items-start gap-4 overflow-x-auto pb-2">
        {EXTRAS.map(e => <li key={e.nome} className="w-60 shrink-0 snap-start bg-[#3a3a3a] p-3">
          <span className="relative block"><img src={`${IMG}/${e.img}`} alt="" width={480} height={270} loading="lazy" className="aspect-video w-full object-cover" /><span className={`${pixel.className} absolute bottom-1.5 left-1.5 border-2 border-[#ffd23f] bg-black/70 px-1.5 text-xs text-[#ffd23f]`}>{e.tag}</span></span>
          <p className="mt-3 font-bold text-white">{e.nome}</p>
          <p className="mt-1 text-xs text-white/60">{e.by}</p>
          <p className={`${pixel.className} mt-3 text-right text-sm text-[#ffd23f]`}>{e.note}</p>
        </li>)}
      </ul>
    </div>
  </section>;
}

function Modos({ buyHref, fullPrice, playHref }: { buyHref: string; fullPrice: string; playHref: string }) {
  const [sel, setSel] = useState(MODOS[0].id);
  const m = MODOS.find(x => x.id === sel)!;
  return <section id="modos" className="scroll-mt-16 bg-[#161616] py-14 sm:py-20">
    <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
      <H2 className="text-center text-white">Veja como se joga</H2>
      <div className="mt-10 grid border-4 border-[#4a4a4a] bg-[#262626] lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div role="tablist" aria-label="Modos de jogo" className="no-scrollbar flex overflow-x-auto lg:flex-col">
          {MODOS.map(x => <button key={x.id} role="tab" type="button" aria-selected={x.id === sel} aria-controls="modo-painel" onClick={() => setSel(x.id)} className={`${pixel.className} shrink-0 border-b-4 border-[#1a1a1a] px-5 py-5 text-left text-base uppercase transition lg:text-lg ${x.id === sel ? "bg-[#3c8527] text-white" : "text-white/80 hover:bg-white/5"}`}>{x.nome}</button>)}
        </div>
        <div id="modo-painel" role="tabpanel" className="p-4 sm:p-6">
          <img src={`${IMG}/${m.img}`} alt={`Modo ${m.nome} no ValleyBlocks`} width={1100} height={620} loading="lazy" className="aspect-video w-full object-cover" />
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[60ch] text-base leading-relaxed text-white/85">{m.texto}</p>
            {m.id === "amigos" ? <Link href={buyHref} className={`${btn} ${GREEN} shrink-0`}>Completo por {fullPrice} <ChevronRight className="size-4" aria-hidden="true" /></Link>
              : <Link href={playHref} className={`${btn} ${GREEN} shrink-0`}><Play className="size-4 fill-current" aria-hidden="true" />Jogar grátis</Link>}
          </div>
        </div>
      </div>
    </div>
  </section>;
}

function Faq() {
  return <section className="bg-[#1e1e1f] py-14 sm:py-20" aria-labelledby="faq-titulo">
    <div className="mx-auto max-w-[1100px] px-4 sm:px-8">
      <H2 id="faq-titulo" className="text-white">Perguntas</H2>
      <div className="mt-8 divide-y divide-white/10 border-y border-white/10">{FAQ.map(f => <details key={f.q} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-white">{f.q}<ChevronRight className="size-5 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" /></summary><p className="mt-3 max-w-[70ch] text-base leading-relaxed text-white/75">{f.a}</p></details>)}</div>
    </div>
  </section>;
}

function Footer(p: ValleyLandingProps) {
  const cols = [
    { t: "Jogo", l: [{ h: p.playHref, n: "Jogar grátis" }, { h: p.buyHref, n: "Versão completa" }, { h: "#modos", n: "Modos de jogo" }] },
    { t: "Terras", l: [{ h: "#terras", n: "Sertão" }, { h: "#terras", n: "Rio de Janeiro" }, { h: "#terras", n: "Japão" }, { h: "#terras", n: "Todas as terras" }] },
    { t: "Aprenda", l: [{ h: p.guideHref, n: "Como jogar" }, { h: "#extras", n: "Pets e veículos" }, { h: "#novidade", n: "Missões" }] },
    { t: "Suporte", l: [{ h: p.contactHref, n: "Contato" }, { h: p.privacyHref, n: "Privacidade" }, { h: p.termsHref, n: "Termos" }] },
    { t: "Conta", l: [{ h: p.accountHref, n: "Minha conta" }, ...(p.portalHref ? [{ h: p.portalHref, n: "Mais jogos LABSGames" }] : [])] },
  ];
  return <footer className="bg-[#131313] text-white/70">
    <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-8">
      <div className="grid grid-cols-2 gap-10 md:grid-cols-[1.3fr_repeat(5,1fr)]">
        <div className="col-span-2 md:col-span-1"><Logo /><p className="mt-4 max-w-xs text-sm leading-6">Jogo de blocos em 3D feito no Brasil. No navegador do computador, tablet ou celular.</p></div>
        {cols.map(c => <nav key={c.t} aria-label={c.t}><p className="text-sm font-bold uppercase tracking-wide text-white">{c.t}</p><ul className="mt-4 space-y-2.5 text-sm">{c.l.map(l => <li key={l.n}><Link href={l.h} className="hover:text-white">{l.n}</Link></li>)}</ul></nav>)}
      </div>
      <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} ValleyBlocks, um jogo LABSGames.</p>
        <p>Desenvolvido por <a href="https://alexandreboyago.com.br" target="_blank" rel="author noopener" className="font-bold hover:text-white">Alexandre Boyago</a></p>
      </div>
    </div>
  </footer>;
}
