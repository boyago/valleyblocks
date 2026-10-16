import { Keyboard, Hand, Target } from "lucide-react";
import type { Game } from "@/lib/games";

// "Como jogar": objective as a short lead, controls as key chips in a balanced grid.
// Catalog strings look like "WASD: mover; mouse: olhar", so each entry is split into
// key + action pairs. A device without controls is omitted instead of shown empty.
type Pair = { keys: string[]; action: string };

function pairs(entries: string[]): Pair[] {
  return entries.flatMap(entry => entry.split(";").map(part => part.trim()).filter(Boolean)).map(part => {
    const at = part.indexOf(":");
    if (at < 0) return { keys: [], action: part };
    const label = part.slice(0, at).trim(), action = part.slice(at + 1).trim();
    return { keys: label.split(/\s*\/\s*|\s+ou\s+/).filter(Boolean), action: action.charAt(0).toUpperCase() + action.slice(1) };
  });
}

function ControlList({ title, icon, items }: { title: string; icon: React.ReactNode; items: Pair[] }) {
  return <div>
    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">{icon}{title}</h3>
    <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {items.map(item => <li key={item.keys.join() + item.action} className="flex items-start gap-3 rounded-xl bg-surface p-3 shadow-[0_1px_0_rgba(11,11,16,.06)]">
        <span className="flex shrink-0 flex-wrap gap-1">{item.keys.map(key => <kbd key={key} className="min-w-8 rounded-md border border-white/10 border-b-[3px] bg-surface-2 px-2 py-0.5 text-center font-mono text-xs font-semibold text-white">{key}</kbd>)}</span>
        <span className="text-sm leading-snug text-zinc-300">{item.action}</span>
      </li>)}
    </ul>
  </div>;
}

export function GameControls({ game }: { game: Game }) {
  const keyboard = pairs(game.controles.teclado), touch = pairs(game.controles.toque);
  return <section className="mt-14 grid gap-6 sm:mt-20 lg:grid-cols-12" aria-labelledby="como-jogar">
    <div className="rounded-2xl bg-surface-2 p-6 text-white ring-1 ring-white/10 sm:p-8 lg:col-span-4">
      <Target className="size-6 text-[#C6FF00]" aria-hidden="true" strokeWidth={1.75} />
      <h2 id="como-jogar" className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Como jogar</h2>
      <p className="mt-3 text-base leading-relaxed text-zinc-300">{game.objetivo}</p>
      {touch.length === 0 && <p className="mt-6 text-sm text-zinc-400">Feito para computador com teclado e mouse.</p>}
    </div>
    <div className="space-y-8 rounded-2xl bg-surface-2 p-6 sm:p-8 lg:col-span-8">
      {keyboard.length > 0 && <ControlList title="Teclado e mouse" icon={<Keyboard className="size-4" aria-hidden="true" />} items={keyboard} />}
      {touch.length > 0 && <ControlList title="Toque" icon={<Hand className="size-4" aria-hidden="true" />} items={touch} />}
      {keyboard.length + touch.length === 0 && <p className="text-sm text-zinc-300">Use o mouse.</p>}
    </div>
  </section>;
}
