import catalog from "@/content/catalogo.json";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const SITE_NAME = "Vale dos Blocos";

export const categoryLabels = { todos: "Todos", acao: "Ação", corrida: "Corrida", aventura: "Aventura", puzzle: "Puzzle", casual: "Casual" } as const;
export type Category = Exclude<keyof typeof categoryLabels, "todos">;
export type Device = "desktop" | "mobile";
export type Orientation = "paisagem" | "retrato" | "qualquer";
export type Game = { slug:string; nome:string; resumo:string; descricao:string; categoria:Category; status:"disponivel"|"em-breve"; demonstracao:boolean; destaque:boolean; publicadoEm:string; capa:string; miniatura:string; entrada:string|null; integracao:"iframe-labs-v1"|null; proporcao:"16:9"; orientacao?:Orientation; dispositivos:Device[]; objetivo:string; controles:{teclado:string[];toque:string[]}; requisitos:string[]; telaCheia:boolean; iniciarTelaCheia?:boolean; reiniciar:boolean };
export const games = (catalog.jogos as Game[]).map(game =>
  game.slug === 'vale-dos-blocos' && process.env.NEXT_PUBLIC_LABS_WORLDS_ENABLED === 'true'
    ? { ...game, descricao: game.descricao.replace('salvamento local no navegador', 'salvamento no navegador e nuvem para contas com esse benefício liberado') }
    : game);
export function deviceLabel(devices: Device[]) { return devices.includes("desktop") && devices.includes("mobile") ? "Computador e celular" : devices.includes("desktop") ? "Computador" : "Celular"; }
export function absoluteUrl(path: string) { return new URL(path, SITE_URL).toString(); }
