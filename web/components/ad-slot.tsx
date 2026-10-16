import { ads, type AdPlacement } from "@/lib/ads";
export function AdSlot({ placement }: { placement: AdPlacement }) {
  const slot = ads[placement];
  if (!slot.enabled) return null;
  if (slot.mode === "partner" && slot.partner) return <aside aria-label="Publicidade" className="overflow-hidden rounded-xl border border-white/10 bg-surface"><a href={slot.partner.href} target="_blank" rel="noreferrer sponsored" className="block"><img src={slot.partner.image} alt={slot.partner.alt} width={970} height={250} className="aspect-[970/250] w-full object-contain" /><span className="block px-3 py-2 text-center text-[11px] font-bold tracking-[0.16em] text-zinc-400">PUBLICIDADE</span></a></aside>;
  if (slot.mode === "adsense" && slot.adsense) return <aside aria-label="Publicidade" className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/10 bg-surface-2 px-5 text-center text-sm text-zinc-300" data-ad-client={slot.adsense.client} data-ad-slot={slot.adsense.slot}><span className="text-[11px] font-bold tracking-[0.16em] text-zinc-400">PUBLICIDADE</span><span>Espaço configurado para anúncio</span></aside>;
  return <aside aria-label="Publicidade" className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/10 bg-surface-2 px-5 text-center text-sm text-zinc-300"><span className="text-[11px] font-bold tracking-[0.16em] text-zinc-400">PUBLICIDADE</span><span>{slot.label}</span></aside>;
}
