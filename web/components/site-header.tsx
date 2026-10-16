import Link from "next/link";
import { BookOpen, Gamepad2, Menu, UserRound } from "lucide-react";

export function Brand() {
  return <Link href="/" className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xl font-black tracking-[-0.06em] text-white" aria-label="ValleyBlocks, ir ao início"><span className="grid size-9 place-items-center rounded-xl bg-[#C6FF00] text-[#0B0B10] shadow-[0_4px_0_#547c00]"><Gamepad2 className="size-5" aria-hidden="true" /></span><span>LABS<span className="text-[#D86BFF]">Games</span></span></Link>;
}

const LINKS = [
  { href: "/#catalogo", label: "Jogos" },
  { href: "/guias", label: "Como jogar" },
  { href: "/sobre", label: "Sobre" },
  { href: "/parceiros", label: "Para parceiros" },
];

export function SiteHeader() {
  return <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0B0B10]/85 text-white backdrop-blur-md supports-[backdrop-filter]:bg-[#0B0B10]/70">
    <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:min-h-20 sm:px-8">
      <Brand />
      <nav aria-label="Principal" className="hidden items-center gap-1 text-sm font-semibold text-zinc-300 lg:flex">
        {LINKS.map(l => <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 transition-colors hover:bg-white/5 hover:text-white">{l.label}</Link>)}
      </nav>
      <div className="flex items-center gap-2">
        <Link href="/conta" className="hidden min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold text-zinc-100 transition hover:bg-white/5 active:translate-y-px sm:inline-flex"><UserRound className="size-4" aria-hidden="true" />Minha conta</Link>
        <Link href="/#catalogo" className="hidden min-h-11 items-center gap-2 rounded-xl bg-[#C6FF00] px-4 text-sm font-bold text-[#0B0B10] shadow-[0_3px_0_#547c00] transition hover:bg-[#d5ff4a] active:translate-y-0.5 active:shadow-none md:inline-flex"><Gamepad2 className="size-4" aria-hidden="true" />Jogar</Link>
        {/* Menu do celular/tablet sem JS: <details> abre e fecha nativamente, acessível por teclado. */}
        <details className="group relative lg:hidden">
          <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-xl bg-white/10 transition hover:bg-white/15 [&::-webkit-details-marker]:hidden" aria-label="Abrir menu"><Menu className="size-5" aria-hidden="true" /></summary>
          <nav aria-label="Menu" className="absolute right-0 top-14 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-[#14131c] p-2 shadow-[0_24px_60px_-12px_rgb(0_0_0/.7)]">
            {LINKS.map(l => <Link key={l.href} href={l.href} className="flex min-h-12 items-center rounded-xl px-4 text-base font-semibold text-zinc-100 hover:bg-white/5">{l.label}</Link>)}
            <Link href="/conta" className="flex min-h-12 items-center gap-2 rounded-xl px-4 text-base font-semibold text-zinc-100 hover:bg-white/5 sm:hidden"><UserRound className="size-4" aria-hidden="true" />Minha conta</Link>
          </nav>
        </details>
      </div>
    </div>
  </header>;
}

export function SiteFooter() {
  return <footer className="border-t border-white/10 bg-[#08080c] text-zinc-300">
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
      <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-start">
        <div className="space-y-3"><Brand /><p className="max-w-sm text-sm leading-6 text-zinc-400">Jogos para jogar no navegador, no computador, tablet ou celular. Comece grátis e libere a versão completa quando quiser.</p></div>
        <nav className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3" aria-label="Rodapé">
          <Link href="/#catalogo" className="hover:text-white">Jogos</Link>
          <Link href="/guias" className="inline-flex items-center gap-1.5 hover:text-white"><BookOpen className="size-3.5" aria-hidden="true" />Como jogar</Link>
          <Link href="/sobre" className="hover:text-white">Sobre</Link>
          <Link href="/parceiros" className="hover:text-white">Para parceiros</Link>
          <Link href="/contato" className="hover:text-white">Contato</Link>
          <Link href="/conta" className="hover:text-white">Minha conta</Link>
          <Link href="/privacidade" className="hover:text-white">Privacidade e cookies</Link>
          <Link href="/termos" className="hover:text-white">Termos</Link>
        </nav>
      </div>
      <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} ValleyBlocks.</p>
        <p>Desenvolvido por <a href="https://alexandreboyago.com.br" target="_blank" rel="author noopener" className="font-bold text-zinc-300 underline-offset-4 hover:text-white hover:underline">Alexandre Boyago</a></p>
      </div>
    </div>
  </footer>;
}
