// Copia o build do jogo (../game/dist) para public/games/valleyblocks e gera sitemap, robots e llms.txt.
// Fora da máquina de criação (sem ../game), usa o build já versionado em public/games.
import { cp, mkdir, readFile, stat, lstat, readdir, rm, writeFile } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";

const siteRoot = resolve(import.meta.dirname, "..");
const gameRoot = resolve(siteRoot, "..", "game");
const catalogPath = resolve(siteRoot, "content/catalogo.json");
const publicRoot = resolve(siteRoot, "public");
const publicGames = resolve(publicRoot, "games");
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
if (!SITE_URL) console.warn("[sync-games] NEXT_PUBLIC_SITE_URL não definido: sitemap, robots e llms.txt usarão http://localhost:3000.");
const BASE = SITE_URL || "http://localhost:3000";
const exists = async p => { try { await stat(p); return true; } catch (e) { if (e.code === "ENOENT") return false; throw e; } };
const hasSources = await exists(resolve(gameRoot, "package.json"));
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const slugs = new Set();
for (const g of catalog.jogos) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(g.slug) || slugs.has(g.slug)) throw Error(`Slug inválido ou duplicado: ${g.slug}`);
  slugs.add(g.slug);
  if (!["disponivel", "em-breve"].includes(g.status)) throw Error(`Status inválido: ${g.slug}`);
  if (g.status !== "disponivel") continue;
  if (!["/games/" + g.slug + "/", "/games/" + g.slug + "/index.html"].includes(g.entrada)) throw Error(`Entrada deve ser local: ${g.slug}`);
  for (const p of [g.capa, g.miniatura]) if (!new RegExp(`^/games/${g.slug}/[a-zA-Z0-9._-]+$`).test(p)) throw Error(`Imagem inválida: ${p}`);
  const root = hasSources ? resolve(gameRoot, "dist") : resolve(publicGames, g.slug);
  for (const file of ["index.html", basename(g.capa), basename(g.miniatura)]) {
    if (!await exists(resolve(root, file))) throw Error(`Arquivo ausente: ${root}/${file}. Execute "npm run build" em game/ antes de publicar.`);
  }
}
await mkdir(publicGames, { recursive: true });
if ((await lstat(publicGames)).isSymbolicLink()) throw Error("public/games não pode ser um link.");
const removeGame = async name => {
  const target = resolve(publicGames, name);
  if (dirname(target) !== publicGames || !/^[a-z0-9-]+$/.test(name)) throw Error(`Caminho inseguro: ${target}`);
  if (await exists(target)) {
    if ((await lstat(target)).isSymbolicLink()) throw Error(`Link não permitido: ${target}`);
    await rm(target, { recursive: true });
  }
};
const published = catalog.jogos.filter(g => g.status === "disponivel");
if (hasSources) {
  for (const g of published) {
    await removeGame(g.slug);
    await cp(resolve(gameRoot, "dist"), resolve(publicGames, g.slug), { recursive: true });
  }
} else console.log("[sync-games] Usando o build versionado em public/games.");
for (const entry of await readdir(publicGames, { withFileTypes: true })) {
  if (entry.isDirectory() && !slugs.has(entry.name)) await removeGame(entry.name);
}
const xml = value => String(value).replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);
const pages = ["/", "/guias", "/sobre", "/parceiros", "/contato", "/privacidade", "/termos"].map(loc => ({ loc }));
for (const g of published) pages.push({ loc: `/jogos/${g.slug}`, image: g.capa, title: g.nome }, { loc: `/jogos/${g.slug}/como-jogar` });
await writeFile(resolve(publicRoot, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${pages.map(p => `  <url><loc>${xml(BASE + p.loc)}</loc>${p.image ? `<image:image><image:loc>${xml(BASE + p.image)}</image:loc><image:title>${xml(p.title)}</image:title></image:image>` : ""}</url>`).join("\n")}\n</urlset>\n`);
await writeFile(resolve(publicRoot, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\n# Buscadores e assistentes de IA podem ler e citar as páginas públicas.\nUser-agent: GPTBot\nAllow: /\nUser-agent: OAI-SearchBot\nAllow: /\nUser-agent: ChatGPT-User\nAllow: /\nUser-agent: ClaudeBot\nAllow: /\nUser-agent: Claude-SearchBot\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\nUser-agent: Google-Extended\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`);
await writeFile(resolve(publicRoot, "llms.txt"), `# ValleyBlocks\n\n> Jogo brasileiro de construir em blocos 3D (voxel), estilo sandbox, que roda direto no navegador, sem download. Portais levam a lugares do Brasil e do mundo.\n\n- Página: ${BASE}/jogos/valleyblocks\n- Guia (objetivo e controles): ${BASE}/jogos/valleyblocks/como-jogar\n- Para quem: famílias e crianças que gostam de construir e explorar; também adultos fãs de jogos de blocos.\n- O que dá para fazer: construir casa, adotar pets, minerar, criar ferramentas na bancada (picareta, pá, espada, espingarda), pescar, usar barco e carretinha no carro.\n- Terras por portais: Sertão, Minas Gerais (com ET de Varginha, capivara e onça), Rio de Janeiro (Cristo Redentor), Tríplice Fronteira (Foz do Iguaçu, Ciudad del Este, Puerto Iguazú), Nova York (Estátua da Liberdade), Estados Unidos, China, Japão e Submundo.\n- Preço: grátis no navegador com tempo diário (15 minutos como visitante, 60 minutos com conta gratuita). Versão completa por R$ 29,90 em pagamento único: sem limite de tempo, mundo salvo na nuvem e multiplayer cooperativo.\n- Aparelhos: computador (teclado e mouse); abre em tela inteira. Versão para celular em desenvolvimento.\n- Criador: Alexandre Boyago (LABSGames, Brasil).\n\n## Informações\n- [Guia](${BASE}/guias)\n- [Sobre](${BASE}/sobre)\n- [Contato](${BASE}/contato)\n- [Privacidade](${BASE}/privacidade)\n- [Termos](${BASE}/termos)\n`);
console.log(`[sync-games] ${published.length} jogo validado; ${pages.length} URLs no sitemap.`);
