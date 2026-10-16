# Pendências deixadas pelo desmembramento (16/10/2026)

- [ ] Definir domínio e preencher `NEXT_PUBLIC_SITE_URL` e `LABS_ORIGIN`. Sem isso sitemap e canonical apontam para localhost.
- [ ] Confirmar `appId` do app (`cloud.labsgames.valleyblocks`, renomeado em 16/10/2026 junto com a marca ValleyBlocks) antes de qualquer upload às lojas.
- [ ] Validar os controles de toque em um Android real (veja `docs/MOBILE.md`, "O que ainda falta no celular").
- [ ] `game/src/save.js`: o banco IndexedDB passou a se chamar `labs-valleyblocks`; saves locais feitos antes da troca de nome (banco `labs-vale-dos-blocos`) não são lidos. Sem impacto para o domínio novo, que ainda não tem jogadores.
- [ ] Página inicial: `web/app/page.tsx` ainda renderiza `CatalogExperience` (grade com categorias). Trocar por landing do jogo.
- [ ] Textos de `web/app/sobre`, `parceiros`, `privacidade`, `termos`, `contato` e `guias` falam de "portal de jogos gratuitos"; reescrever.
- [ ] `game/src/main.js` (perto das linhas 244 e 249): toast "A compra fica disponível no portal LABSGames" ao tentar comprar fora do portal; revisar quando o modelo do app for definido.
- [ ] `web/HOSTINGER.md`, `web/CONFIGURACAO.md`, `web/ESTRATEGIA.md`, `web/VALIDACAO.md` e `web/README.md` são do portal; revisar ou remover.
- [ ] `web/public/og.png` e favicon ainda são do LABSGames.
- [ ] Ícone e splash do app (`@capacitor/assets`).
- [ ] Instalar Android Studio neste PC para o primeiro build de teste.
