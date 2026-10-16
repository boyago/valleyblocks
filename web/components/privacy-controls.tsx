"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import Link from "next/link";
import { analyticsId, ownUsageEnabled } from "@/lib/site-config";

type Choice = "accepted" | "rejected";
const KEY = "labs-privacy-v2";
const EVENT = "labs-privacy-change";
function readChoice(): Choice | null {
  try { const value = localStorage.getItem(KEY); return value === "accepted" || value === "rejected" ? value : null; } catch { return null; }
}
function saveChoice(value: Choice) {
  try { localStorage.setItem(KEY, value); } catch { /* private browsers may disable storage */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
}
declare global { interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; } }
function clearAnalyticsCookies() {
  for (const item of document.cookie.split(";")) {
    const name = item.trim().split("=")[0];
    if (!/^_ga(?:_|$)/.test(name)) continue;
    for (const domain of ["", location.hostname, "." + location.hostname]) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? "; domain=" + domain : ""}; SameSite=Lax`;
    }
  }
}
function useChoice() {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    // Hydrate browser-only preferences after the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(readChoice()); setLoaded(true);
    const changed = (event: Event) => setChoice((event as CustomEvent<Choice>).detail);
    window.addEventListener(EVENT, changed);
    return () => window.removeEventListener(EVENT, changed);
  }, []);
  return { choice, loaded };
}
export function PrivacyChoices() {
  const { choice } = useChoice();
  const choose = (value: Choice) => {
    saveChoice(value);
    if (value === "rejected") {
      window.gtag?.("consent", "update", { analytics_storage: "denied" });
      clearAnalyticsCookies();
      if (window.gtag) location.reload();
    }
  };
  return <section aria-label="Preferências de métricas" className="rounded-xl border border-white/10 p-5">
    <p>{analyticsId || ownUsageEnabled ? `Métricas opcionais: ${choice === "accepted" ? "permitidas" : "desativadas"}.` : "Métricas opcionais não configuradas. Nenhum script de análise é carregado."}</p>
    {(analyticsId || ownUsageEnabled) && <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" className="min-h-11 rounded-lg border border-purple-700 px-4 font-bold text-[#D86BFF]" onClick={() => choose("rejected")}>Recusar métricas</button>
      <button type="button" className="min-h-11 rounded-lg border border-purple-700 px-4 font-bold text-[#D86BFF]" onClick={() => choose("accepted")}>Permitir métricas</button>
    </div>}
  </section>;
}
export function PrivacyRuntime() {
  const { choice, loaded } = useChoice();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready || choice !== "accepted") return;
    window.gtag?.("event", "page_view", { page_location: location.origin + pathname });
  }, [pathname, choice, ready]);
  useEffect(() => {
    if (!ready || choice !== "accepted") return;
    const onGame = (event: Event) => {
      const data = (event as CustomEvent<{ type: string; slug: string }>).detail;
      if (["started", "completed", "error"].includes(data?.type) && /^[a-z0-9-]+$/.test(data?.slug))
        window.gtag?.("event", "game_" + data.type, { game_id: data.slug });
    };
    window.addEventListener("labs-game-event", onGame);
    return () => window.removeEventListener("labs-game-event", onGame);
  }, [choice, ready]);
  if (pathname.startsWith("/conta") || pathname.startsWith("/admin")) return null;
  if (!analyticsId && !ownUsageEnabled) return null;
  return <>
    {loaded && choice === null && <aside aria-label="Métricas opcionais" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl rounded-2xl border border-white/10 bg-surface p-5 text-white shadow-xl">
      <p className="font-bold">Você escolhe</p><p className="mt-2 text-sm">Podemos medir o uso dos jogos {analyticsId ? "com Google Analytics" : "no próprio ValleyBlocks"}{analyticsId && ownUsageEnabled ? " e no próprio ValleyBlocks" : ""}? Você pode jogar sem aceitar e alterar a escolha em <Link className="underline" href="/privacidade">Privacidade e cookies</Link>.</p>
      <div className="mt-4 flex flex-wrap gap-3">{(["rejected", "accepted"] as const).map(value => <button key={value} type="button" className="min-h-11 rounded-lg border border-purple-700 px-4 font-bold text-[#D86BFF]" onClick={() => saveChoice(value)}>{value === "accepted" ? "Permitir métricas" : "Recusar métricas"}</button>)}</div>
    </aside>}
    {analyticsId && choice === "accepted" && <Script id="labs-analytics" src={`https://www.googletagmanager.com/gtag/js?id=${analyticsId}`} strategy="afterInteractive" onLoad={() => {
      window.dataLayer = window.dataLayer || [];
      // gtag expects Arguments objects, rather than an array of arguments.
      // eslint-disable-next-line prefer-rest-params
      window.gtag = function () { window.dataLayer!.push(arguments); };
      window.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      window.gtag("js", new Date());
      window.gtag("config", analyticsId, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
      setReady(true);
    }} />}
  </>;
}
