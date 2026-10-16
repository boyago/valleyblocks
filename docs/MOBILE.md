# Versão mobile (Play Store e App Store)

## Decisão: Capacitor

O jogo é web (Three.js, WebGL 2, ES modules). Capacitor coloca exatamente esse build numa WebView nativa, com acesso a APIs do aparelho via plugins, e gera projetos Android Studio e Xcode normais. Não há reescrita; o mesmo `game/dist` serve web e app. React Native ou Unity exigiriam reescrever o jogo.

## O que já está pronto

- `mobile/capacitor.config.json`: `appId` **cloud.labsgames.valleyblocks** (confirmar antes da primeira publicação: não dá para mudar depois), `appName` ValleyBlocks, `webDir ../game/dist`. Pacote Android em `mobile/android/app/src/main/java/cloud/labsgames/valleyblocks/`.
- Plataformas `android/` e `ios/` geradas (Capacitor 8), travadas em paisagem (`sensorLandscape` no AndroidManifest; só Landscape no Info.plist).
- Plugins instalados: `@capacitor/app`, `@capacitor/screen-orientation`, `@capacitor/status-bar`.
- `npm run sync` compila o jogo e copia para as duas plataformas. `npm run android` abre no Android Studio.
- O jogo não redireciona para o portal quando detecta `Capacitor.isNativePlatform()`.

## Requisitos de máquina

- Android: Android Studio (SDK 35+). JDK 17 já está instalado neste PC (Microsoft build); o SDK Android ainda não. Instalar o Android Studio e abrir `mobile/android`.
- iOS: macOS com Xcode. A pasta `ios/` já está gerada; build e envio à App Store só acontecem no Mac (ou em serviço de build na nuvem, como Codemagic).

## Controles de toque (fase 5) — feito em 16/10/2026

Implementado em `game/src/touch.js` (classe `TouchControls`) e integrado em `main.js`, `ui.js` e `style.css`. Ativa quando o aparelho prefere toque (`pointer: coarse` com `maxTouchPoints > 0`), sempre no app Capacitor, e pode ser forçado no PC com `?touch=1` (ou desligado com `?touch=0`).

| Gesto / botão | O que faz | Equivalente no teclado |
| --- | --- | --- |
| Joystick flutuante na metade esquerda | Andar; na borda, corre. No carro e no barco acelera, dá ré e vira | W A S D (+ Shift) |
| Arrastar na metade direita | Olhar | Mouse |
| Toque longo (300 ms) à direita | Minerar, cortar, atacar, enquanto o dedo ficar | Botão esquerdo |
| Toque curto à direita | Colocar bloco, usar item, comer; com estilingue/arco/espingarda, dispara | Botão direito |
| Aviso de contexto ("Toque · Abrir porta") | Vira botão: portas, baú, bancada, churrasqueira, portais, carro, barco, animais | E / R |
| Pular (segurar) | Pula; no carro é o freio de mão; voando, sobe | Espaço |
| Agachar / Correr (alternam, exclusivos) | Agachar; mergulhar; descer voando / correr | Ctrl / Shift |
| Voar (só no criativo) | Liga e desliga o voo | V |
| Câmera | Primeira pessoa → costas → frente; no carro, câmera interna | C |
| Mochila | Inventário; no carro parado, porta-malas | Tab |
| Faróis / Buzina (só no carro) | | L / H |
| Barra de atalhos | Toque no espaço para equipar | 1–9 |
| Ⅱ no alto / Voltar do Android | Pausa. O Voltar fecha menus, pausa o jogo e só sai do app na tela inicial | Esc |

Outras mudanças para o celular:

- Sem Pointer Lock no modo toque; o mouse continua igual no PC. Eventos do mouse e teclas seguem funcionando num tablet com teclado.
- Qualidade padrão `low` e sombras desligadas quando o aparelho prefere toque (só se o jogador nunca salvou configurações). `devicePixelRatio` travado em 1 no toque, em qualquer qualidade.
- `index.html`: `viewport-fit=cover`, sem zoom, `mobile-web-app-capable`. CSS usa `env(safe-area-inset-*)` na barra de cima, status, atalhos e botões; status e coordenadas vão para o canto superior esquerdo; dicas de teclado somem; o toast aparece no alto para não cobrir os botões; painéis ocupam a tela com botões de 44 px.
- Guia (menu Controles e guia) ganha a seção "No celular" quando está no modo toque.
- Áudio: `audio.init()` roda no toque de "Entrar no meu mundo", que é um gesto do usuário; nada muda.

Verificação: `npm run test:touch` em `game/` (com `npm run dev` rodando) simula um celular em paisagem com toques reais via CDP: joystick, olhar, toque longo minerando, toque curto colocando, botão Pular, aviso de contexto abrindo a bancada, Mochila, Câmera e Voar. Relatório em `game/docs/touch-report.json`; capturas em `game/test-results/touch-*.png`.

## O que ainda falta no celular

1. **Testar em aparelho real** (Android médio): desempenho com `low`/`medium`, tamanho dos botões, sensibilidade do olhar (`LOOK_GAIN` em `touch.js`) e a zona morta do joystick. Ajustar os números a partir disso.
2. **Catálogo**: marcar `"dispositivos": ["desktop","mobile"]` e preencher `controles.toque` em `web/content/catalogo.json` depois da validação em aparelho.
3. **Assoviar (Q)** não tem botão; o menu do pet (Embarcar/Desembarcar) cobre o caso principal.
4. Ícone e splash do app (`@capacitor/assets`).

## Modelo de negócio no app (fase 6)

Hoje no app o jogo roda em modo standalone: save local, sem limite de tempo, sem compras, sem nuvem e sem multiplayer. Duas opções:

- **App pago** (compra única na loja, sem login): mais simples, funciona offline, nenhuma mudança de servidor. A compra web de R$ 29,90 e a compra na loja ficam separadas.
- **App grátis + login na plataforma**: o jogo chama a API de `web/` (contas, tempo, mundo, multiplayer) via HTTPS em vez de `postMessage`. Exige CORS para a origem do app (`https://localhost` no Android, `capacitor://localhost` no iOS), sessão por token em vez de cookie SameSite=Strict, e as lojas exigem que benefícios digitais comprados dentro do app passem pelo faturamento delas (Google Play Billing / StoreKit). A compra web não pode ser anunciada dentro do app.

Recomendação inicial: lançar como **app pago** com a versão completa offline e, numa segunda etapa, oferecer login opcional para sincronizar o mundo na nuvem.

## Publicação

- Play Console: conta de desenvolvedor, ficha da loja, classificação de conteúdo (público com crianças exige a política de Famílias do Google Play), política de privacidade em URL própria (`/privacidade` da plataforma serve).
- App Store Connect: Apple Developer Program, mesmas fichas, revisão da Apple (jogos em WebView passam quando o app é o jogo completo, não um site embrulhado).
- Ícones e splash: gerar com `@capacitor/assets` a partir de um PNG 1024×1024 (ainda não feito).
