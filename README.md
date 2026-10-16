# Vale dos Blocos — plataforma própria

Monorepositório do Vale dos Blocos, desmembrado do portal LABSGames em 16/10/2026.

| Pasta | O que é | Stack |
| --- | --- | --- |
| `game/` | O jogo (fonte, assets, testes). Build estático em `game/dist`. | Vite 6 + Three.js 0.170, ES modules |
| `web/` | Plataforma web: página do jogo, contas, tempo diário, mundo na nuvem, multiplayer, pagamentos, admin. | Next.js 16 + Node + MySQL |
| `mobile/` | App Android/iOS que embrulha o build do jogo. | Capacitor 8 |
| `docs/` | Arquitetura, banco de dados, mobile, pendências. | |

## Rodar

```powershell
# jogo
cd game; npm ci; npm test; npm run dev          # http://127.0.0.1:5186

# plataforma (precisa do build do jogo: cd game; npm run build)
cd web; copy .env.example .env.local; npm ci --ignore-scripts; npm run build; npm start   # http://localhost:3000

# app (Android Studio para Android; Xcode/macOS para iOS)
cd mobile; npm ci; npm run android
```

O `npm run build` de `web/` executa `scripts/sync-games.mjs`, que copia `game/dist` para `web/public/games/vale-dos-blocos` e gera sitemap, robots e llms.txt. Esse build copiado é versionado para a hospedagem poder publicar sem compilar o jogo.

## Banco de dados

Banco novo e exclusivo. Veja `docs/BANCO.md`. Resumo: configure `LABS_MYSQL_*` e rode `node web/scripts/setup-database.mjs`.

## Ordem de trabalho

1. [x] Desmembrar código (jogo, web, mobile) neste repositório.
2. [ ] Criar o banco novo e apontar `web/.env.local`; criar o primeiro admin (`web/scripts/configure-usage-session.mjs`).
3. [ ] Página inicial como landing do jogo (hoje ainda é a grade de catálogo do portal com um card).
4. [ ] Revisar textos institucionais (sobre, parceiros, privacidade, termos, contato) para a nova plataforma.
5. [ ] Controles de toque e desempenho no celular (o jogo é só teclado e mouse hoje). Veja `docs/MOBILE.md`.
6. [ ] Contas no app: login, tempo e mundo na nuvem pela API da plataforma.
7. [ ] Publicação: domínio, hospedagem, Play Console e App Store Connect.
