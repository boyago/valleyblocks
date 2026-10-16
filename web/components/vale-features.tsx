import { Car, Hammer, Users, Shirt, Check, Minus, Fish, Sailboat, Swords } from "lucide-react";

// Sales content for the ValleyBlocks page. Images are real captures of the game
// (public/jogos/valleyblocks). Layout: one asymmetric bento (5 cells for 5 items),
// then a two-column free vs complete comparison. No eyebrows, no hairline tables.
const TILE = "rounded-2xl p-6 transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-0.5";
const FREE = ["15 minutos por dia como visitante", "60 minutos por dia com conta gratuita", "Mundo salvo neste navegador", "Entre na sala de um amigo com conta gratuita", "Modos Criativo e Sobrevivência, pets e veículos"];
const FULL = ["Sem limite diário de tempo", "Comece o mundo em qualquer terra, com casa pronta", "Crie salas e jogue com até 3 amigos", "Mundo salvo na nuvem, até 4 MB", "Continue em qualquer computador", "Tudo da versão grátis, para sempre"];
const TERRAS = [
  { slug: "sertao", nome: "Sertão", texto: "Portal de cobre. Mandacarus, ossadas, calangos e o Cangaceiro Fantasma.", alt: "Sertão no ValleyBlocks: terra rachada, mandacarus, um calango e o Cangaceiro Fantasma diante do portal de cobre" },
  { slug: "minas", nome: "Minas Gerais", texto: "Portal de diamante. Morros, rio, grutas com pedras preciosas, capivaras e onças.", alt: "Minas Gerais no ValleyBlocks: morros verdes, terra vermelha, capivaras e uma onça diante do portal de diamante" },
  { slug: "china", nome: "China", texto: "Portal de rubi. Pagode, bambuzais, pandas e a Grande Muralha.", alt: "China no ValleyBlocks: pagode vermelho, bambus, pandas e o portal de rubi" },
  { slug: "japao", nome: "Japão", texto: "Portal de ouro. Cerejeiras em flor e o monte Fuji.", alt: "Japão no ValleyBlocks: cerejeiras cor-de-rosa, o monte Fuji e o portal de ouro" },
  { slug: "eua", nome: "Estados Unidos", texto: "Portal de urânio. Grand Canyon com rio, mesas de rocha vermelha e bisões.", alt: "Estados Unidos no ValleyBlocks: paredões em degraus de rocha vermelha e o rio no fundo do cânion" },
  { slug: "triplice", nome: "Tríplice Fronteira", texto: "Portal de esmeralda. Foz do Iguaçu, Ponte da Amizade, as barraquinhas de Ciudad del Este, Puerto Iguazú e as Cataratas.", alt: "Tríplice Fronteira no ValleyBlocks: o rio Iguaçu entre Foz do Iguaçu e Puerto Iguazú, com os obeliscos do Marco das Três Fronteiras" },
  { slug: "submundo", nome: "Submundo", texto: "Portal de obsidiana. Lagos de lava, brasas no ar e o Golem de Magma.", alt: "Submundo no ValleyBlocks: lago de lava cercado de magma, basalto e espinhos de obsidiana" },
  { slug: "rio", nome: "Rio de Janeiro", texto: "Portal de pedra portuguesa. Copacabana, o calçadão, o Pão de Açúcar e o Cristo Redentor no Corcovado.", alt: "Rio de Janeiro no ValleyBlocks: calçadão de ondas, praia com guarda-sóis e o Pão de Açúcar saindo do mar" },
  { slug: "nyc", nome: "Nova York", texto: "Portal de aço. Arranha-céus, Central Park e a Estátua da Liberdade, que só se alcança de barco.", alt: "Nova York no ValleyBlocks: a Estátua da Liberdade na ilha, no meio da baía" },
];
// Novidades de jogo além das terras.
const EXTRAS = [
  { icon: Fish, titulo: "Pescaria", texto: "Vara de pesca, boia e cardumes nos rios. Do lambari ao pirarucu gigante, tudo vai para a churrasqueira." },
  { icon: Sailboat, titulo: "Barco e carretinha", texto: "Barco de alumínio para navegar pelos rios e pelo mar. Carretinha que engata no carro e leva carga." },
  { icon: Swords, titulo: "Ferramentas e armas", texto: "Picareta e foice modeladas em 3D, espadas, arco e espingarda de pressão. Tudo se desgasta com o uso, então é bom ter reserva." },
];

export function ValeFeatures() {
  return <>
    <section className="mt-14 sm:mt-20" aria-labelledby="encontra-titulo">
      <h2 id="encontra-titulo" className="max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">A vida acontece bloco a bloco</h2>
      <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-zinc-300">Um sandbox 3D tranquilo para construir, cuidar e explorar no seu ritmo. Grátis no navegador, sem instalar nada.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-12 md:grid-rows-[auto_auto]">
        <figure className="relative min-h-72 overflow-hidden rounded-2xl bg-[#1b3a2f] md:col-span-7 md:row-span-2 md:min-h-0">
          <img src="/jogos/valleyblocks/cena.jpg" alt="Cena do ValleyBlocks: casa de madeira, garagem com um carro e um cachorro na estrada" width={640} height={580} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0B0B10]/80 to-transparent p-6 pt-14 text-sm leading-relaxed text-white">Começa com uma casa, uma garagem e uma estrada. O resto do Vale é seu para transformar, de dia e de noite.</figcaption>
        </figure>
        <div className={`${TILE} bg-surface-2 md:col-span-5`}><Hammer className="size-6 text-[#D86BFF]" aria-hidden="true" strokeWidth={1.75} /><h3 className="mt-4 text-lg font-semibold text-white">Construa e minere</h3><p className="mt-2 text-sm leading-relaxed text-zinc-300">Mundo gerado por semente, inventário, receitas, pets e veículos. Criativo para imaginar sem limites, Sobrevivência para criar sua história.</p></div>
        <div className={`${TILE} bg-surface-2 md:col-span-5`}><Users className="size-6 text-[#D86BFF]" aria-hidden="true" strokeWidth={1.75} /><h3 className="mt-4 text-lg font-semibold text-white">Jogue com amigos</h3><p className="mt-2 text-sm leading-relaxed text-zinc-300">Crie uma sala, passe o código e construam juntos no mesmo mundo. Até 4 jogadores.</p></div>
        <div className={`${TILE} bg-[#C6FF00] md:col-span-5`}><Car className="size-6 text-white" aria-hidden="true" strokeWidth={1.75} /><h3 className="mt-4 text-lg font-semibold text-white">Dirija pelo Vale</h3><p className="mt-2 text-sm leading-relaxed text-white/75">Um compacto ou um utilitário, com carretinha engatada, para levar materiais entre a casa, a garagem e o que existe depois da estrada.</p></div>
        <div className={`${TILE} relative overflow-hidden bg-surface-2 text-white ring-1 ring-white/10 md:col-span-7`}><img src="/jogos/valleyblocks/casa.jpg" alt="" width={520} height={300} loading="lazy" className="pointer-events-none absolute -right-6 -top-6 hidden w-64 rotate-3 rounded-xl opacity-80 sm:block" /><Shirt className="size-6 text-[#C6FF00]" aria-hidden="true" strokeWidth={1.75} /><h3 className="mt-4 text-lg font-semibold">Sua aparência</h3><p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-zinc-300">Escolha o visual do personagem. Com o Pacote Expedição, quatro aparências com acessórios modelados no Blender.</p></div>
      </div>
    </section>
    <section className="mt-4 grid gap-4 md:grid-cols-3" aria-label="Mais para fazer">
      {EXTRAS.map(({ icon: Icon, titulo, texto }) => <div key={titulo} className={`${TILE} bg-surface-2`}><Icon className="size-6 text-[#D86BFF]" aria-hidden="true" strokeWidth={1.75} /><h3 className="mt-4 text-lg font-semibold text-white">{titulo}</h3><p className="mt-2 text-sm leading-relaxed text-zinc-300">{texto}</p></div>)}
    </section>
    <section className="mt-14 sm:mt-20" aria-labelledby="terras-titulo">
      <h2 id="terras-titulo" className="max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">Viaje para outras terras</h2>
      <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-zinc-300">São {TERRAS.length} terras. Monte uma moldura de blocos, espirre o spray de portal e atravesse: cada uma tem paisagem, bichos e um inimigo próprios. A bandeira do país aparece quando você chega.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {TERRAS.map((t, i) => <figure key={t.slug} className={`group relative min-h-56 overflow-hidden rounded-2xl bg-surface-2 ${TERRAS.length % 3 === 2 && i < 2 ? "lg:col-span-3" : "lg:col-span-2"} ${i === TERRAS.length - 1 && TERRAS.length % 2 ? "sm:col-span-2 lg:col-span-2" : ""}`}>
          <img src={`/jogos/valleyblocks/terra-${t.slug}.jpg`} alt={t.alt} width={720} height={480} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.03]" />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0B0B10]/85 to-transparent p-5 pt-12 text-white"><span className="block text-lg font-semibold">{t.nome}</span><span className="mt-1 block text-sm leading-relaxed text-white/80">{t.texto}</span></figcaption>
        </figure>)}
      </div>
    </section>
    <section className="mt-14 sm:mt-20" aria-labelledby="comparar-titulo">
      <h2 id="comparar-titulo" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Grátis ou versão completa?</h2>
      <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-zinc-300">A versão grátis é o jogo inteiro, com limite de tempo por dia. A completa tira o limite e guarda seu mundo no servidor.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-surface-2 p-6 sm:p-8"><h3 className="text-lg font-semibold text-white">Grátis</h3><ul className="mt-5 space-y-3 text-sm text-zinc-300">{FREE.map(item => <li key={item} className="flex items-start gap-3"><Minus className="mt-0.5 size-4 shrink-0 text-zinc-400" aria-hidden="true" strokeWidth={2} />{item}</li>)}</ul></div>
        <div className="rounded-2xl bg-surface-2 p-6 text-white ring-1 ring-white/10 sm:p-8"><h3 className="text-lg font-semibold">Versão completa</h3><ul className="mt-5 space-y-3 text-sm text-zinc-200">{FULL.map(item => <li key={item} className="flex items-start gap-3"><Check className="mt-0.5 size-4 shrink-0 text-[#C6FF00]" aria-hidden="true" strokeWidth={2} />{item}</li>)}</ul><p className="mt-6 text-sm text-zinc-400">Pagamento único, sem mensalidade.</p></div>
      </div>
    </section>
  </>;
}
