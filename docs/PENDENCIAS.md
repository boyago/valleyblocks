# Pendências deixadas pelo desmembramento (16/10/2026)

- [ ] Definir domínio e preencher `NEXT_PUBLIC_SITE_URL` e `LABS_ORIGIN`. Sem isso sitemap e canonical apontam para localhost.
- [ ] Confirmar `appId` do app (`cloud.labsgames.valedosblocos`) antes de qualquer upload às lojas.
- [ ] Página inicial: `web/app/page.tsx` ainda renderiza `CatalogExperience` (grade com categorias). Trocar por landing do jogo.
- [ ] Textos de `web/app/sobre`, `parceiros`, `privacidade`, `termos`, `contato` e `guias` falam de "portal de jogos gratuitos"; reescrever.
- [ ] `game/src/main.js` (perto das linhas 244 e 249): toast "A compra fica disponível no portal LABSGames" ao tentar comprar fora do portal; revisar quando o modelo do app for definido.
- [ ] `web/HOSTINGER.md`, `web/CONFIGURACAO.md`, `web/ESTRATEGIA.md`, `web/VALIDACAO.md` e `web/README.md` são do portal; revisar ou remover.
- [ ] `web/public/og.png` e favicon ainda são do LABSGames.
- [ ] Ícone e splash do app (`@capacitor/assets`).
- [ ] Instalar Android Studio neste PC para o primeiro build de teste.
