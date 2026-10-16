# Arquitetura

## Antes (portal LABSGames)

- `imersao/games/` (repositório próprio): 9 jogos, SDK `iframe-labs-v1`, `catalogo.json`.
- `imersao/site/` (repositório próprio, deploy na Hostinger): portal Next.js que serve cada jogo em `/games/<slug>/` dentro de um iframe e concentra HTTP, autenticação, banco e pagamentos.
- Jogo e portal conversam só por `postMessage` (ver `game/docs` e o antigo `games/CONTRATO.md`).

## Agora (este repositório)

```
vale-dos-blocos/
  game/    fonte do jogo (cópia de imersao/games/vale-dos-blocos)
  web/     plataforma (cópia de imersao/site reduzida ao Vale, catálogo com 1 jogo)
  mobile/  Capacitor: webDir = ../game/dist
  docs/
```

O que foi mudado na cópia do site:

- `content/catalogo.json` só com `vale-dos-blocos`; `public/games` só com o Vale (os outros 8 builds não vieram).
- `scripts/sync-games.mjs` lê `../game/dist` (antes `../games/<slug>/dist` + `../games/catalogo.json`).
- `SITE_URL` vem de `NEXT_PUBLIC_SITE_URL` (antes fixo em labsgames.cloud). `SITE_NAME` = "Vale dos Blocos".
- Marca "LABSGames" trocada por "Vale dos Blocos" em código, metadados e e-mails. Os textos longos das páginas institucionais ainda falam de "portal de jogos" e precisam de reescrita.
- `tests/play-quota.test.mjs` adaptado ao catálogo de um jogo (antes exigia 8+ jogos).
- `scripts/setup-database.mjs` novo: cria todas as tabelas de uma vez.
- `.env.example` novo com todas as variáveis.

O que foi mudado no jogo:

- `src/main.js`: em produção fora de iframe o jogo redirecionava para `/jogos/vale-dos-blocos`. Agora detecta `window.Capacitor.isNativePlatform()` e, no app, segue rodando sozinho (modo standalone: save local, sem compras nem multiplayer).

O que **não** mudou: protocolo iframe, nomes de tabelas (`labs_*`), nomes de variáveis (`LABS_*`), rotas (`/jogos/vale-dos-blocos`, `/api/*`, `/mp`). Renomear tudo não traria benefício e multiplicaria o risco; o prefixo "labs" fica como legado interno.

## Fronteiras

- `web/` nunca importa código de `game/`; só copia `game/dist` no build.
- `mobile/` nunca contém lógica de jogo; só a casca nativa e a configuração.
- O portal LABSGames continua existindo em `imersao/` e pode seguir publicando o Vale a partir do seu build versionado, ou passar a linkar para a nova plataforma. Essa decisão é de produto.
- Evoluções do jogo passam a acontecer **aqui** em `game/`. Se o portal LABSGames quiser continuar com o Vale, copiar `game/dist` para `imersao/games/vale-dos-blocos/dist` e rodar o build do site.
