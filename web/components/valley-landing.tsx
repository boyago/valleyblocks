import Link from "next/link";
import { PawPrint, Car, Fish, Users, Sun, Moon, Monitor, Smartphone, Check, Minus, Play, Pickaxe, Compass } from "lucide-react";

// Landing de divulgação do ValleyBlocks (valleyblocks.com / .com.br).
// Referência de estrutura: minecraft.net (arte grande, chamada direta para jogar,
// o que dá para fazer, lugares para visitar, onde jogar, versões, perguntas).
// Tema único escuro, verde de floresta com limão como único acento. Nenhum card
// gratuito: só onde a elevação separa conteúdo. Imagens: capturas reais do jogo
// em /jogos/vale-dos-blocos (as mesmas da página do jogo).
//
// TODO (arte): a arte principal do herói deve ser uma ilustração gerada (ChatGPT)
// em 1600x1000, salva em /public/jogos/vale-dos-blocos/arte-heroi.jpg. Enquanto
// não existe, usamos a captura de abertura do jogo.

export type ValleyLandingProps = {
  /** Para onde o botão "Jogar grátis" leva (página do jogo com o player). */
  playHref: string;
  /** Link da versão completa (checkout). */
  buyHref: string;
  /** Preço formatado da versão completa, ex.: "R$ 29,90". */
  fullPrice: string;
  /** Link de "Como jogar". */
  guideHref: string;
  /** Link da conta. */
  accountHref: string;
  /** Link de privacidade e termos. */
  privacyHref: string;
  termsHref: string;
  contactHref: string;
  /** Quando a landing mora dentro do portal LABSGames, mostra o caminho de volta. */
  portalHref?: string;
};

const IMG = "/jogos/vale-dos-blocos";

const TERRAS = [
  { slug: "sertao", nome: "Sertão", portal: "cobre", texto: "Mandacarus, ossadas, calangos e o Cangaceiro Fantasma." },
  { slug: "minas", nome: "Minas Gerais", portal: "diamante", texto: "Morros, rio, grutas com pedras preciosas, capivaras e onças." },
  { slug: "rio", nome: "Rio de Janeiro", portal: "pedra portuguesa", texto: "Copacabana, o calçadão, o Pão de Açúcar e o Cristo Redentor." },
  { slug: "triplice", nome: "Tríplice Fronteira", portal: "esmeralda", texto: "Foz do Iguaçu, a Ponte da Amizade, as barracas de Ciudad del Este e as Cataratas." },
  { slug: "nyc", nome: "Nova York", portal: "aço", texto: "Arranha-céus, Central Park e a Estátua da Liberdade, só de barco." },
  { slug: "eua", nome: "Grand Canyon", portal: "urânio", texto: "Paredões de rocha vermelha, o rio no fundo e bisões." },
  { slug: "china", nome: "China", portal: "rubi", texto: "Pagode, bambuzais, pandas e a Grande Muralha." },
  { slug: "japao", nome: "Japão", portal: "ouro", texto: "Cerejeiras em flor e o monte Fuji." },
  { slug: "submundo", nome: "Submundo", portal: "obsidiana", texto: "Lagos de lava, brasas no ar e o Golem de Magma." },
];

const FREE = ["15 minutos por dia como visitante", "60 minutos por dia com conta gratuita", "Mundo salvo neste navegador", "Entre na sala de um amigo", "Criativo, Sobrevivência, pets, carros e barcos"];
const FULL = ["Sem limite de tempo", "Comece em qualquer terra, com casa pronta", "Crie salas e jogue com até 3 amigos", "Mundo salvo na nuvem", "Continue em qualquer computador"];

const FAQ = [
  { q: "ValleyBlocks é grátis?", a: "Sim. No navegador você joga 15 minutos por dia como visitante e 60 minutos com conta gratuita. A versão completa, em pagamento único, tira o limite e guarda seu mundo na nuvem." },
  { q: "Preciso instalar alguma coisa?", a: "Não. O jogo roda direto no navegador do computador. No Android, o app está em teste e chega à Play Store em breve." },
  { q: "Funciona no celular?", a: "Sim, com joystick e botões de toque, na horizontal. O desempenho depende do aparelho." },
  { q: "Dá para jogar com amigos?", a: "Sim. Na versão completa você cria uma sala, passa o código e constrói junto com até 3 amigos no mesmo mundo." },
  { q: "É parecido com Minecraft?", a: "É um jogo de blocos em 3D feito no Brasil, com mundo próprio: casa, garagem, estrada, pets, carros, pescaria e nove terras ligadas por portais." },
  { q: "Para que idade?", a: "Para toda a família. Não há sangue nem conteúdo adulto. No modo Criativo os inimigos não causam dano." },
];

export function ValleyLanding(p: ValleyLandingProps) {
  return <div className="grain min-h-[100dvh] bg-[#0c1512] text-[#eef3e6]">
    <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#C6FF00] focus:px-4 focus:py-2 focus:text-[#0c1512]">Ir para o conteúdo</a>
    <LandingHeader playHref={p.playHref} guideHref={p.guideHref} accountHref={p.accountHref} />
    <main id="conteudo">
      <Hero playHref={p.playHref} />
      <Platforms />
      <Doing />
      <Terras />
      <Modes />
      <Versions buyHref={p.buyHref} fullPrice={p.fullPrice} playHref={p.playHref} />
      <Faq />
    </main>
    <LandingFooter {...p} />
  </div>;
}

function Logo() {
  // Marca: o cubo do ícone do jogo (favicon) ao lado do nome.
  return <span className="flex items-center gap-2.5 font-[family-name:var(--font-display)] text-xl font-black tracking-[-0.04em] text-white">
    <svg viewBox="0 0 64 64" className="size-9 shrink-0" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#19382f" /><path d="m12 23 20-11 20 11-20 12z" fill="#b7d184" /><path d="m12 23 20 12v21L12 44z" fill="#8fa966" /><path d="m32 35 20-12v21L32 56z" fill="#527744" /></svg>
    <span>Valley<span className="text-[#C6FF00]">Blocks</span></span>
  </span>;
}

function LandingHeader({ playHref, guideHref, accountHref }: { playHref: string; guideHref: string; accountHref: string }) {
  const links = [{ href: "#fazer", label: "O jogo" }, { href: "#terras", label: "Terras" }, { href: "#onde", label: "Onde jogar" }, { href: "#versoes", label: "Versões" }, { href: guideHref, label: "Como jogar" }];
  return <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0c1512]/80 backdrop-blur-md">
    <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:min-h-[72px] sm:px-8">
      <Link href="/" aria-label="ValleyBlocks, início"><Logo /></Link>
      <nav aria-label="Principal" className="hidden items-center gap-1 text-sm font-semibold text-[#c9d6bd] lg:flex">
        {links.map(l => <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 transition-colors hover:bg-white/5 hover:text-white">{l.label}</Link>)}
      </nav>
      <div className="flex items-center gap-2">
        <Link href={accountHref} className="hidden min-h-11 items-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-white transition hover:bg-white/5 active:translate-y-px sm:inline-flex">Minha conta</Link>
        <Link href={playHref} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#C6FF00] px-4 text-sm font-bold text-[#0c1512] shadow-[0_3px_0_#547c00] transition hover:bg-[#d5ff4a] active:translate-y-0.5 active:shadow-none"><Play className="size-4 fill-current" aria-hidden="true" />Jogar grátis</Link>
      </div>
    </div>
  </header>;
}

function Hero({ playHref }: { playHref: string }) {
  return <section className="relative overflow-hidden pb-14 pt-10 sm:pb-20 sm:pt-16">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_80%_10%,rgb(198_255_0/.16),transparent_60%),radial-gradient(40%_40%_at_10%_90%,rgb(82_119_68/.35),transparent_60%)]" aria-hidden="true" />
    <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-8 lg:grid-cols-12 lg:gap-8">
      <div className="rise lg:col-span-5">
        <h1 className="font-[family-name:var(--font-display)] text-5xl font-black leading-[0.95] tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">Construa o seu vale, bloco a bloco.</h1>
        <p className="mt-5 max-w-[38ch] text-lg leading-relaxed text-[#c9d6bd]">Casa, pets, carro, pescaria e nove terras para explorar. Grátis no navegador, sem instalar.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={playHref} className="btn-hero"><Play className="size-5 fill-current" aria-hidden="true" /> Jogar grátis</Link>
          <a href="#terras" className="inline-flex min-h-14 items-center gap-2 rounded-xl border border-white/20 px-5 text-base font-semibold text-white transition hover:bg-white/10 active:translate-y-px"><Compass className="size-4" aria-hidden="true" /> Ver as nove terras</a>
        </div>
      </div>
      <figure className="rise relative lg:col-span-7" style={{ animationDelay: ".12s" }}>
        <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[#C6FF00]/10 blur-2xl" aria-hidden="true" />
        <img src={`${IMG}/abertura.jpg`} alt="Tela de abertura do ValleyBlocks: casa de telhado laranja, garagem, estrada e pets num vale de blocos" width={1160} height={760} fetchPriority="high" className="aspect-[3/2] w-full rounded-2xl object-cover shadow-[0_40px_80px_-30px_rgba(0,0,0,.8)] ring-1 ring-white/10" />
      </figure>
    </div>
  </section>;
}

function Platforms() {
  // Faixa de plataformas logo abaixo do herói (nunca dentro dele).
  return <section id="onde" className="border-y border-white/10 bg-[#0f1a16]" aria-label="Onde jogar">
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-8 md:grid-cols-3 md:gap-10">
      <p className="flex items-start gap-3 text-sm leading-6 text-[#c9d6bd]"><Monitor className="mt-0.5 size-5 shrink-0 text-[#C6FF00]" aria-hidden="true" /><span><strong className="block text-white">Navegador</strong>Computador com teclado e mouse. Nada para instalar.</span></p>
      <p className="flex items-start gap-3 text-sm leading-6 text-[#c9d6bd]"><Smartphone className="mt-0.5 size-5 shrink-0 text-[#C6FF00]" aria-hidden="true" /><span><strong className="block text-white">Celular e tablet</strong>Joystick e botões de toque, na horizontal.</span></p>
      <p className="flex items-start gap-3 text-sm leading-6 text-[#c9d6bd]"><svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-[#C6FF00]" fill="currentColor" aria-hidden="true"><path d="M3.6 2.4 13.2 12l-9.6 9.6c-.4-.2-.6-.6-.6-1.1V3.5c0-.5.2-.9.6-1.1zm11 11 2.8 2.8-11 6.3zM16.2 10.9l-2.8 2.9L5.6 5.9zM20.3 11l-3.3-1.9-3 3 3 3 3.3-1.9c.9-.5.9-1.7 0-2.2z" /></svg><span><strong className="block text-white">Android</strong>App em teste. Chega à Play Store em breve.</span></p>
    </div>
  </section>;
}

function Doing() {
  const tile = "rounded-2xl p-6 transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-0.5";
  return <section id="fazer" className="scroll-mt-20 py-16 sm:py-24">
    <div className="mx-auto max-w-7xl px-4 sm:px-8">
      <h2 className="max-w-2xl font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-white sm:text-5xl">A vida acontece bloco a bloco</h2>
      <p className="mt-4 max-w-[58ch] text-lg leading-relaxed text-[#c9d6bd]">Um mundo tranquilo para construir, cuidar e explorar no seu ritmo. Começa com uma casa, uma garagem e uma estrada. O resto é seu.</p>
      <div className="mt-10 grid gap-4 md:grid-cols-12">
        <figure className="relative min-h-72 overflow-hidden rounded-2xl md:col-span-7 md:row-span-2">
          <img src={`${IMG}/cena.jpg`} alt="Casa de madeira, garagem com um carro e um cachorro na estrada do vale" width={640} height={580} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0c1512]/90 to-transparent p-6 pt-16 text-white"><span className="block text-lg font-semibold">Construa e minere</span><span className="mt-1 block max-w-[40ch] text-sm leading-relaxed text-white/80">Mundo gerado por semente, mochila, bancada, churrasqueira e receitas. Da madeira à picareta de diamante.</span></figcaption>
        </figure>
        <div className={`${tile} bg-[#16261f] md:col-span-5`}><PawPrint className="size-6 text-[#C6FF00]" aria-hidden="true" strokeWidth={1.75} /><h3 className="mt-4 text-lg font-semibold text-white">Adote um pet</h3><p className="mt-2 text-sm leading-relaxed text-[#c9d6bd]">Cachorros caçam e trazem a caça. Gatos protegem a casa de ratos, escorpiões e cobras. Dê nome, alimente e leve no carro.</p></div>
        <div className={`${tile} bg-[#C6FF00] text-[#0c1512] md:col-span-5`}><Car className="size-6" aria-hidden="true" strokeWidth={1.75} /><h3 className="mt-4 text-lg font-semibold">Dirija e navegue</h3><p className="mt-2 text-sm leading-relaxed text-[#0c1512]/75">Compacto ou utilitário com carretinha engatada. Barco de alumínio para rios e mar. Faróis para a noite.</p></div>
        <div className={`${tile} bg-[#16261f] md:col-span-4`}><Fish className="size-6 text-[#C6FF00]" aria-hidden="true" strokeWidth={1.75} /><h3 className="mt-4 text-lg font-semibold text-white">Pesque</h3><p className="mt-2 text-sm leading-relaxed text-[#c9d6bd]">Do lambari ao pirarucu gigante. Tudo vai para a churrasqueira.</p></div>
        <div className={`${tile} bg-[#16261f] md:col-span-4`}><Pickaxe className="size-6 text-[#C6FF00]" aria-hidden="true" strokeWidth={1.75} /><h3 className="mt-4 text-lg font-semibold text-white">Ferramentas e armas</h3><p className="mt-2 text-sm leading-relaxed text-[#c9d6bd]">Picareta, machado, foice, espada, arco e espingarda de pressão. Tudo se desgasta, então tenha reserva.</p></div>
        <div className={`${tile} relative overflow-hidden bg-[#16261f] md:col-span-4`}><img src={`${IMG}/casa.jpg`} alt="" width={520} height={300} loading="lazy" className="pointer-events-none absolute -right-10 -top-8 w-56 rotate-3 rounded-xl opacity-60" /><Users className="relative size-6 text-[#C6FF00]" aria-hidden="true" strokeWidth={1.75} /><h3 className="relative mt-4 text-lg font-semibold text-white">Jogue com amigos</h3><p className="relative mt-2 max-w-[28ch] text-sm leading-relaxed text-[#c9d6bd]">Crie uma sala, passe o código e construam juntos. Até 4 jogadores.</p></div>
      </div>
    </div>
  </section>;
}

function Terras() {
  // Galeria horizontal com rolagem por toque e setas do teclado (scroll-snap nativo).
  return <section id="terras" className="scroll-mt-20 border-t border-white/10 bg-[#0f1a16] py-16 sm:py-24">
    <div className="mx-auto max-w-7xl px-4 sm:px-8">
      <h2 className="max-w-2xl font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-white sm:text-5xl">Nove terras atrás dos portais</h2>
      <p className="mt-4 max-w-[58ch] text-lg leading-relaxed text-[#c9d6bd]">Monte uma moldura de blocos, espirre o spray de portal e atravesse. Cada terra tem paisagem, bichos e um inimigo próprios.</p>
    </div>
    <ul className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:px-8 lg:px-[max(2rem,calc((100vw-80rem)/2+2rem))]" aria-label="Terras do ValleyBlocks">
      {TERRAS.map(t => <li key={t.slug} className="group relative w-[78vw] shrink-0 snap-start overflow-hidden rounded-2xl sm:w-[26rem]">
        <img src={`${IMG}/terra-${t.slug}.jpg`} alt={`${t.nome} no ValleyBlocks`} width={720} height={480} loading="lazy" className="aspect-[3/2] w-full object-cover transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.03]" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0c1512]/90 to-transparent p-5 pt-14 text-white"><span className="block text-lg font-semibold">{t.nome}</span><span className="mt-1 block text-sm leading-relaxed text-white/80">{t.texto}</span><span className="mt-2 block text-xs font-medium text-[#C6FF00]">Portal de {t.portal}</span></div>
      </li>)}
    </ul>
  </section>;
}

function Modes() {
  return <section className="relative overflow-hidden py-16 sm:py-24">
    <img src={`${IMG}/terra-submundo.jpg`} alt="" width={720} height={480} loading="lazy" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20" aria-hidden="true" />
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0c1512] via-[#0c1512]/85 to-[#0c1512]/40" aria-hidden="true" />
    <div className="relative mx-auto max-w-7xl px-4 sm:px-8">
      <h2 className="max-w-2xl font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-white sm:text-5xl">Dois modos, dia e noite</h2>
      <div className="mt-10 grid max-w-4xl gap-8 sm:grid-cols-2">
        <div><Sun className="size-7 text-[#C6FF00]" aria-hidden="true" strokeWidth={1.75} /><h3 className="mt-3 text-xl font-semibold text-white">Criativo</h3><p className="mt-2 text-base leading-relaxed text-[#c9d6bd]">Blocos ilimitados, voo livre e inimigos que não causam dano. Para imaginar sem pressa.</p></div>
        <div><Moon className="size-7 text-[#C6FF00]" aria-hidden="true" strokeWidth={1.75} /><h3 className="mt-3 text-xl font-semibold text-white">Sobrevivência</h3><p className="mt-2 text-base leading-relaxed text-[#c9d6bd]">Fome, fôlego e ferramentas que gastam. À noite saem o Ceifador Rubro e o Espectro do Lodo. Paredes e tochas ajudam.</p></div>
      </div>
      <p className="mt-8 max-w-[58ch] text-base leading-relaxed text-[#c9d6bd]">Um dia dura 24 minutos. Em cavernas e túneis a luz some aos poucos, e só a sua tocha ilumina o caminho.</p>
    </div>
  </section>;
}

function Versions({ buyHref, fullPrice, playHref }: { buyHref: string; fullPrice: string; playHref: string }) {
  return <section id="versoes" className="scroll-mt-20 border-t border-white/10 bg-[#0f1a16] py-16 sm:py-24">
    <div className="mx-auto max-w-7xl px-4 sm:px-8">
      <h2 className="max-w-2xl font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-white sm:text-5xl">Grátis ou completo?</h2>
      <p className="mt-4 max-w-[58ch] text-lg leading-relaxed text-[#c9d6bd]">A versão grátis é o jogo inteiro, com limite de tempo por dia. A completa tira o limite e guarda seu mundo no servidor. Pagamento único, sem mensalidade.</p>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-[#16261f] p-6 sm:p-8"><h3 className="text-xl font-semibold text-white">Grátis</h3><p className="mt-1 text-sm text-[#c9d6bd]">No navegador, agora.</p><ul className="mt-6 space-y-3 text-sm text-[#c9d6bd]">{FREE.map(i => <li key={i} className="flex items-start gap-3"><Minus className="mt-0.5 size-4 shrink-0 text-[#8fa966]" aria-hidden="true" />{i}</li>)}</ul><Link href={playHref} className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/20 px-5 text-sm font-semibold text-white transition hover:bg-white/10 active:translate-y-px"><Play className="size-4 fill-current" aria-hidden="true" />Jogar grátis</Link></div>
        <div className="rounded-2xl bg-[#16261f] p-6 ring-1 ring-[#C6FF00]/40 sm:p-8"><h3 className="text-xl font-semibold text-white">Completo</h3><p className="mt-1 text-sm text-[#c9d6bd]">{fullPrice}, uma vez só.</p><ul className="mt-6 space-y-3 text-sm text-[#eef3e6]">{FULL.map(i => <li key={i} className="flex items-start gap-3"><Check className="mt-0.5 size-4 shrink-0 text-[#C6FF00]" aria-hidden="true" />{i}</li>)}</ul><Link href={buyHref} className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#C6FF00] px-5 text-sm font-bold text-[#0c1512] shadow-[0_3px_0_#547c00] transition hover:bg-[#d5ff4a] active:translate-y-0.5 active:shadow-none">Comprar versão completa</Link></div>
      </div>
    </div>
  </section>;
}

function Faq() {
  return <section className="py-16 sm:py-24" aria-labelledby="faq-titulo">
    <div className="mx-auto max-w-7xl px-4 sm:px-8">
      <h2 id="faq-titulo" className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-white sm:text-5xl">Perguntas frequentes</h2>
      <dl className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">{FAQ.map(f => <div key={f.q}><dt className="text-lg font-semibold text-white">{f.q}</dt><dd className="mt-2 max-w-[52ch] text-base leading-relaxed text-[#c9d6bd]">{f.a}</dd></div>)}</dl>
    </div>
  </section>;
}

function LandingFooter(p: ValleyLandingProps) {
  return <footer className="border-t border-white/10 bg-[#0a110e] text-[#c9d6bd]">
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
      <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-start">
        <div className="space-y-3"><Logo /><p className="max-w-sm text-sm leading-6">Jogo de blocos em 3D feito no Brasil. Jogue no navegador, no computador, tablet ou celular.</p></div>
        <nav className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm" aria-label="Rodapé">
          <Link href={p.playHref} className="hover:text-white">Jogar</Link>
          <Link href={p.guideHref} className="hover:text-white">Como jogar</Link>
          <Link href={p.accountHref} className="hover:text-white">Minha conta</Link>
          <Link href={p.contactHref} className="hover:text-white">Contato</Link>
          <Link href={p.privacyHref} className="hover:text-white">Privacidade</Link>
          <Link href={p.termsHref} className="hover:text-white">Termos</Link>
          {p.portalHref && <Link href={p.portalHref} className="hover:text-white">Mais jogos no LABSGames</Link>}
        </nav>
      </div>
      <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-[#8fa966] sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} ValleyBlocks, um jogo LABSGames.</p>
        <p>Desenvolvido por <a href="https://alexandreboyago.com.br" target="_blank" rel="author noopener" className="font-bold underline-offset-4 hover:text-white hover:underline">Alexandre Boyago</a></p>
      </div>
    </div>
  </footer>;
}
