"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Expand, LoaderCircle, Play, RotateCcw, Smartphone, X, ShoppingBag } from "lucide-react";
import type { Game } from "@/lib/games";
import Link from 'next/link';
import { createGameAccess } from '@/lib/game-access-client.mjs';
import { createGameWorld } from '@/lib/game-world-client.mjs';
import { createGameUsage } from "@/lib/game-usage-client.mjs";
import { TimeUpOverlay, FULL_PRICE } from "@/components/time-up-overlay";

type Phase = "cover" | "loading" | "playing" | "error";
const READY_TIMEOUT = 45000; // redes móveis lentas + jogos 3D precisam de mais tempo

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    // Match media is a browser subscription hydrated after SSR.
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

type OrientationLock = { lock?: (o: string) => Promise<void>; unlock?: () => void };

/**
 * Player do jogo (protocolo iframe-labs-v1).
 * - Desktop: área 16:9 na página, botões Reiniciar e Tela cheia.
 * - Celular: ao tocar em Jogar, entra em modo imersivo (tela inteira, fullscreen quando suportado).
 *   Jogos de paisagem tentam travar a orientação; se o aparelho não permitir (iOS), mostra "Gire o celular"
 *   até o jogador virar. Jogos de retrato ficam em pé.
 */
export function GamePlayer({ game }: { game: Game }) {
  const [accessStatus,setAccessStatus]=useState<{remainingSeconds?:number|null;unlimited?:boolean;account?:boolean;reason?:string|null;message?:string}>({});
  const timeUp = accessStatus.reason === "daily-limit";
  const lowTime = !accessStatus.unlimited && typeof accessStatus.remainingSeconds === "number" && accessStatus.remainingSeconds > 0 && accessStatus.remainingSeconds <= 300;
  const [phase, setPhase] = useState<Phase>("cover");
  const [key, setKey] = useState(0);
  const [error, setError] = useState("");
  const [immersive, setImmersive] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const enteredFullscreen = useRef(false);
  const ownedOutfits = useRef<string[]>([]);
  const unlimitedRef = useRef(false);
  const baseAccess = useRef<{account?:boolean;unlimited?:boolean}>({});
  const accountName = useRef<string|null>(null);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_LABS_PLAY_ENABLED !== 'true') return;
    let alive = true;
    fetch('/api/account/me', { cache: 'no-store' }).then(r => r.json()).then(d => { if (alive && typeof d?.account?.username === 'string') { accountName.current = d.account.username; frame.current?.contentWindow?.postMessage({ labs: 1, type: 'account', account: { username: d.account.username } }, window.location.origin); } if (alive && Array.isArray(d?.account?.entitlements?.outfits)) ownedOutfits.current = d.account.entitlements.outfits; if (alive && d?.account) { unlimitedRef.current = !!d.account.unlimited; baseAccess.current = { account: true, unlimited: !!d.account.unlimited }; setAccessStatus(prev => ({ ...baseAccess.current, ...prev })); } }).catch(() => {});
    return () => { alive = false; };
  }, [game.slug]);
  const isTouch = useMediaQuery("(pointer: coarse)");
  const isPortrait = useMediaQuery("(orientation: portrait)");
  const wantsLandscape = game.orientacao === "paisagem";
  const gameUrl = game.entrada?.endsWith("/") ? `${game.entrada}index.html` : game.entrada;

  const send = (type: string) => frame.current?.contentWindow?.postMessage({ labs: 1, type }, window.location.origin);

  const enterImmersive = async () => {
    setImmersive(true);
    try {
      if (shell.current?.requestFullscreen) {
        await shell.current.requestFullscreen({ navigationUI: "hide" });
        enteredFullscreen.current = true;
      }
    } catch { /* iOS Safari não permite fullscreen de elementos; o modo imersivo cobre a tela mesmo assim */ }
    if (wantsLandscape) {
      try { await (screen.orientation as unknown as OrientationLock).lock?.("landscape"); } catch { /* sem suporte: mostra o aviso para girar */ }
    }
  };

  const exitImmersive = () => {
    try { (screen.orientation as unknown as OrientationLock).unlock?.(); } catch { /* ignore */ }
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    enteredFullscreen.current = false;
    setImmersive(false);
  };

  const start = () => {
    setAccessStatus({ ...baseAccess.current });
    setProgress(null);
    setError("");
    setPhase("loading");
    setKey((value) => value + 1);
    // Todo jogo abre ocupando a tela inteira (fullscreen quando o navegador permite; senão, cobre a janela).
    // O clique em Jogar é o gesto que o navegador exige para o fullscreen.
    void enterImmersive();
  };

  const stop = () => {
    send("destroy");
    exitImmersive();
    setPhase("cover");
    setKey(0);
  };

  // Capture this frame so retry/unmount never destroys a newer instance.
  useEffect(() => {
    if (key === 0) return;
    const target = frame.current?.contentWindow;
    if (!target) return;
    let timeout: ReturnType<typeof setTimeout>;
    let ready = false, startSent = false, started = false, pausedForRotation = false, failed = false;
    let measuredStart = false, checked = false;
    const usage = createGameUsage({ game: game.slug, enabled: process.env.NEXT_PUBLIC_LABS_USAGE_ENABLED === "true" });
    const portrait = matchMedia("(orientation: portrait)");
    const touch = matchMedia("(pointer: coarse)");
    const blocked = () => touch.matches && portrait.matches && wantsLandscape;
    const enforceAccess=process.env.NEXT_PUBLIC_LABS_PLAY_ENABLED==='true';
    // Só o Vale manda 'gameplay'/'access-request'; nos demais o portal liga e desliga o relógio.
    const portalTimed=game.slug!=='valleyblocks';
    const cloudSaves=process.env.NEXT_PUBLIC_LABS_WORLDS_ENABLED==='true' && game.slug==='valleyblocks';
    const post = (type: string, data:object={}) => target.postMessage({ labs: 1, type, ...data }, location.origin);
    const access=enforceAccess?createGameAccess({game:game.slug,send:post,onStatus:setAccessStatus}):null;
    const worlds=cloudSaves?createGameWorld({send:post}):null;
    const metric = (type: string) => window.dispatchEvent(new CustomEvent("labs-game-event", { detail: { type, slug: game.slug } }));
    const fail = (message: string) => { failed = true; usage.state(false); clearTimeout(timeout); post("destroy"); setError(message); setPhase("error"); metric("error"); };
    const arm = () => { clearTimeout(timeout); timeout = setTimeout(() => fail("O jogo demorou demais para iniciar. Verifique a conexão e tente novamente."), READY_TIMEOUT); };
    const updateOrientation = () => {
      if (!ready || failed) return;
      if (!startSent && !blocked() && portalTimed && access && !checked) {
        // Pergunta ao servidor antes de começar; sem tempo, o jogo nem inicia e o aviso aparece.
        checked = true; void access.check().then(data => { if (failed) return; if (data.allowed) updateOrientation(); else setPhase("playing"); });
        return;
      }
      if (!startSent && !blocked()) { startSent = true; arm(); post("start",{playAccess:enforceAccess&&!portalTimed,cloudSaves,outfits:ownedOutfits.current,unlimited:unlimitedRef.current,multiplayer:process.env.NEXT_PUBLIC_LABS_MULTIPLAYER_ENABLED==="true"&&!!baseAccess.current.account,accounts:enforceAccess,account:accountName.current?{username:accountName.current}:null}); }
      if (started && blocked() && !pausedForRotation) { post("pause"); pausedForRotation = true; if (portalTimed) { access?.state(false); usage.state(false); } }
      if (started && !blocked() && pausedForRotation) { post("resume"); pausedForRotation = false; frame.current?.focus(); if (portalTimed) { access?.state(true); usage.state(true); } }
    };
    const onMessage = (event: MessageEvent) => {
      if (failed || event.origin !== location.origin || event.source !== target || event.data?.labs !== 1) return;
      const data = event.data;
      if (data.type === "ready" && !ready) { ready = true; clearTimeout(timeout); updateOrientation(); }
      if (data.type === "started" && startSent) {
        clearTimeout(timeout); started = true; setPhase("playing"); updateOrientation();
        if (!blocked()) frame.current?.focus();
        if (game.slug !== "valleyblocks" && !measuredStart) { metric("started"); measuredStart = true; }
        if (portalTimed) { access?.state(!blocked()); usage.state(!blocked()); }
      }
      if(data.type==='access-request'&&access&&typeof data.requestId==='string'&&data.requestId.length<=64) void access.request(data.requestId);
      if(data.type==='world-request'&&worlds) void worlds.request(data);
      if (data.type === "gameplay" && started && typeof data.active === "boolean") {
        usage.state(data.active && !blocked());
        access?.state(data.active && !blocked());
        if (data.active && !measuredStart) { metric("started"); measuredStart = true; }
      }
      if (data.type === "progress" && Number.isFinite(data.loaded) && Number.isFinite(data.total) && data.total > 0)
        setProgress(Math.round(Math.max(0, Math.min(1, data.loaded / data.total)) * 100));
      if (data.type === "error") fail(typeof data.message === "string" ? data.message.slice(0, 250) : "Não foi possível carregar o jogo.");
      if (data.type === "completed") metric("completed");
      if (data.type === "purchase-request" && typeof data.product === "string" && /^[a-z0-9-]{1,64}$/.test(data.product)) {
        // The game only asks; the checkout page handles sign-in, coupon and payment.
        location.assign(`/comprar/${data.product}`);
      }
      if (data.type === "login-request") location.assign(`/conta/entrar?next=${encodeURIComponent(location.pathname)}`);
      if (data.type === "fullscreen-request" && game.telaCheia) { setImmersive(true); void shell.current?.requestFullscreen?.().then(() => { enteredFullscreen.current = true; }).catch(() => {}); }
    };
    // Ao voltar para a aba: nos jogos cronometrados pelo portal, retoma o jogo e o relógio se ainda houver tempo.
    const onVisible = () => {
      if (!portalTimed || !started || failed || blocked() || document.hidden) return;
      if (!access) { post("resume"); usage.state(true); return; }
      void access.check().then(data => { if (failed || !data.allowed || document.hidden) return; post("resume"); usage.state(true); });
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("message", onMessage);
    portrait.addEventListener("change", updateOrientation);
    touch.addEventListener("change", updateOrientation);
    arm();
    return () => {
      usage.dispose();access?.dispose();worlds?.dispose();
      window.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisible);
      portrait.removeEventListener("change", updateOrientation);
      touch.removeEventListener("change", updateOrientation);
      clearTimeout(timeout); post("destroy");
    };
  }, [key, game.slug, game.telaCheia, wantsLandscape]);

  // Se o sistema sair do fullscreen (botão voltar), sai do modo imersivo também
  useEffect(() => {
    const onChange = () => { if (enteredFullscreen.current && !document.fullscreenElement) { enteredFullscreen.current = false; setImmersive(false); } };
    document.addEventListener("fullscreenchange", onChange);
    return () => { document.removeEventListener("fullscreenchange", onChange); try { (screen.orientation as unknown as OrientationLock).unlock?.(); } catch { /* unsupported */ } };
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    if (immersive) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [immersive]);

  if (game.status !== "disponivel" || !game.entrada) {
    return <div className="rounded-2xl bg-[#171426] p-8 text-center text-white"><p className="text-lg font-bold">Este jogo está em preparação.</p></div>;
  }

  const active = phase === "loading" || phase === "playing";
  const showRotate = isTouch && wantsLandscape && isPortrait;
  const incompatible = isTouch && !game.dispositivos.includes("mobile");

  return (
    <div ref={shell} className={immersive ? "fixed inset-0 z-[100] flex h-dvh flex-col bg-black pb-[env(safe-area-inset-bottom)]" : "overflow-hidden rounded-2xl bg-[#0B0B10]"}>
      {process.env.NEXT_PUBLIC_LABS_PLAY_ENABLED==='true'&&!immersive&&<div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-white ${lowTime || timeUp ? "bg-[#4a0a6b]" : "bg-purple-950"}`}><span>{timeUp ? (accessStatus.account ? "Seu tempo de hoje acabou." : "Seus 15 minutos de hoje acabaram.") : accessStatus.unlimited ? "Acesso ilimitado" : typeof accessStatus.remainingSeconds === "number" ? `Tempo hoje: ${Math.ceil(accessStatus.remainingSeconds/60)} min` : accessStatus.account ? "60 min por dia com a sua conta" : "15 min por dia como visitante · 60 min com conta"}{lowTime && <strong className="ml-2 text-[#C6FF00]">Acabando!</strong>}</span><span className="flex gap-4">{!accessStatus.unlimited && <Link className="font-bold text-[#C6FF00] underline" href="/comprar/vale-completo">{lowTime || timeUp ? 'Versão completa' : 'Comprar versão completa'} {FULL_PRICE}</Link>}<Link className="font-bold underline" href="/conta">Minha conta</Link></span></div>}
      {phase === "cover" && (
        <div className="flex min-h-80 flex-col items-center justify-center px-6 py-8 text-center text-white sm:aspect-video">
          <p className="text-sm font-bold tracking-[0.16em] text-[#C000FF]">PRONTO PARA JOGAR</p>
          <h2 className="mt-2 text-3xl font-black">{game.nome}</h2>
          <p className="mt-3 max-w-md text-zinc-300">{game.objetivo}</p>
          {wantsLandscape && <p className="mt-2 text-xs text-zinc-400 sm:hidden">No celular este jogo é jogado na horizontal.</p>}
          <button type="button" onClick={start} disabled={incompatible} className="btn-hero mt-6 disabled:opacity-60"><Play className="size-5 fill-current" aria-hidden="true" /> {incompatible ? "Jogue no computador" : "Jogar agora"}</button>
        </div>
      )}

      {active && (
        <div className={immersive ? "relative min-h-0 flex-1" : game.orientacao === "retrato" ? "relative h-[75dvh] min-h-96" : "relative aspect-video"}>
          <iframe
            ref={frame}
            key={key}
            src={gameUrl ?? undefined}
            title={game.nome}
            allow="fullscreen; gamepad; autoplay"
            allowFullScreen
            tabIndex={0}
            className={`absolute inset-0 h-full w-full border-0 bg-[#0B0B10] transition-opacity ${phase === "playing" ? "opacity-100" : "opacity-0"}`}
          />
          {phase === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
              <LoaderCircle className="size-7 animate-spin text-[#C6FF00]" aria-hidden="true" />
              <p role="status" className="font-bold">Carregando jogo…{progress !== null ? ` ${progress}%` : ""}</p>
              <p className="text-sm text-zinc-400">Os arquivos são carregados agora.</p>
            </div>
          )}
          {timeUp && phase === "playing" && <TimeUpOverlay account={!!accessStatus.account} onLeave={stop} />}
          {showRotate && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#0B0B10]/95 px-8 text-center text-white">
              <Smartphone className="size-14 rotate-90 text-[#C6FF00] animate-pulse" aria-hidden="true" />
              <p className="text-xl font-black">Gire o celular</p>
              <p className="max-w-xs text-sm text-zinc-300">Este jogo é jogado na horizontal. Vire o aparelho para começar.</p>
            </div>
          )}
        </div>
      )}

      {phase === "error" && (
        <div role="alert" className="flex min-h-80 flex-col items-center justify-center px-6 py-8 text-center text-white sm:aspect-video">
          <AlertTriangle className="size-8 text-[#C6FF00]" aria-hidden="true" />
          <p className="mt-3 text-lg font-bold">Não foi possível iniciar o jogo</p>
          <p className="mt-2 max-w-md text-sm text-zinc-300">{error}</p>
          <div className="mt-6 flex gap-2">
            <button type="button" onClick={start} className="min-h-11 rounded-lg bg-white px-4 font-bold text-[#0B0B10]">Tentar novamente</button>
            <button type="button" onClick={stop} className="min-h-11 rounded-lg bg-white/10 px-4 font-bold text-white">Sair</button>
          </div>
        </div>
      )}

      {active && (
        <div className={`flex flex-wrap items-center gap-2 border-t border-white/10 px-3 ${immersive ? "min-h-11 justify-between py-1" : "justify-end py-3"}`}>
          {immersive && <div className="flex items-center gap-2"><button type="button" onClick={stop} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-bold text-white"><X className="size-4" aria-hidden="true" /> Sair</button>{game.slug === 'valleyblocks' && !accessStatus.unlimited && <Link href="/comprar/vale-completo" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#C6FF00]/15 px-3 text-sm font-bold text-[#C6FF00]"><ShoppingBag className="size-4" aria-hidden="true" /> Versão completa {FULL_PRICE}</Link>}</div>}
          <div className="flex gap-2">
            <button type="button" disabled={phase !== "playing" || !game.reiniciar || showRotate} onClick={() => send("restart")} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-white/10 px-3 text-sm font-bold text-white hover:bg-white/15"><RotateCcw className="size-4" aria-hidden="true" /> Reiniciar</button>
            {game.telaCheia && !immersive && <button type="button" onClick={() => void enterImmersive()} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-white/10 px-3 text-sm font-bold text-white hover:bg-white/15"><Expand className="size-4" aria-hidden="true" /> Tela cheia</button>}
          </div>
        </div>
      )}
    </div>
  );
}
