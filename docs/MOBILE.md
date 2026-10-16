# Versão mobile (Play Store e App Store)

## Decisão: Capacitor

O jogo é web (Three.js, WebGL 2, ES modules). Capacitor coloca exatamente esse build numa WebView nativa, com acesso a APIs do aparelho via plugins, e gera projetos Android Studio e Xcode normais. Não há reescrita; o mesmo `game/dist` serve web e app. React Native ou Unity exigiriam reescrever o jogo.

## O que já está pronto

- `mobile/capacitor.config.json`: `appId` **cloud.labsgames.valedosblocos** (confirmar antes da primeira publicação: não dá para mudar depois), `appName` Vale dos Blocos, `webDir ../game/dist`.
- Plataformas `android/` e `ios/` geradas (Capacitor 8), travadas em paisagem (`sensorLandscape` no AndroidManifest; só Landscape no Info.plist).
- Plugins instalados: `@capacitor/app`, `@capacitor/screen-orientation`, `@capacitor/status-bar`.
- `npm run sync` compila o jogo e copia para as duas plataformas. `npm run android` abre no Android Studio.
- O jogo não redireciona para o portal quando detecta `Capacitor.isNativePlatform()`.

## Requisitos de máquina

- Android: Android Studio (SDK 35+). JDK 17 já está instalado neste PC (Microsoft build); o SDK Android ainda não. Instalar o Android Studio e abrir `mobile/android`.
- iOS: macOS com Xcode. A pasta `ios/` já está gerada; build e envio à App Store só acontecem no Mac (ou em serviço de build na nuvem, como Codemagic).

## O que falta no jogo para ser jogável no celular (fase 5)

O jogo hoje é 100% teclado + mouse + Pointer Lock (`game/src/main.js` não tem nenhum handler de toque). Trabalho necessário, em ordem:

1. **Entrada por toque**: joystick virtual esquerdo (andar), arrastar na metade direita (olhar), botões de pular/agachar/correr, ação primária (minerar/atacar) por toque longo e secundária (colocar) por toque curto, barra de atalhos tocável, botão de mochila/menu/câmera. Substituir `requestPointerLock` por esse esquema quando `navigator.maxTouchPoints > 0`.
2. **UI responsiva**: menus, mochila, bancada e textos legíveis em 6 polegadas; safe areas (notch) via `env(safe-area-inset-*)`.
3. **Desempenho**: distância de renderização e `devicePixelRatio` menores em GPU móvel; medir em um Android médio real. Já existe um teto de pixel ratio em `resize()`.
4. **Áudio**: Web Audio só inicia após gesto do usuário; conferir o desbloqueio no primeiro toque.
5. **Voltar do Android**: tratar o botão voltar (`@capacitor/app`, evento `backButton`) para abrir o menu de pausa, não fechar o app.
6. **Catálogo**: marcar `"dispositivos": ["desktop","mobile"]` e preencher `controles.toque` só depois de validar em aparelho real.

## Modelo de negócio no app (fase 6)

Hoje no app o jogo roda em modo standalone: save local, sem limite de tempo, sem compras, sem nuvem e sem multiplayer. Duas opções:

- **App pago** (compra única na loja, sem login): mais simples, funciona offline, nenhuma mudança de servidor. A compra web de R$ 29,90 e a compra na loja ficam separadas.
- **App grátis + login na plataforma**: o jogo chama a API de `web/` (contas, tempo, mundo, multiplayer) via HTTPS em vez de `postMessage`. Exige CORS para a origem do app (`https://localhost` no Android, `capacitor://localhost` no iOS), sessão por token em vez de cookie SameSite=Strict, e as lojas exigem que benefícios digitais comprados dentro do app passem pelo faturamento delas (Google Play Billing / StoreKit). A compra web não pode ser anunciada dentro do app.

Recomendação inicial: lançar como **app pago** com a versão completa offline e, numa segunda etapa, oferecer login opcional para sincronizar o mundo na nuvem.

## Publicação

- Play Console: conta de desenvolvedor, ficha da loja, classificação de conteúdo (público com crianças exige a política de Famílias do Google Play), política de privacidade em URL própria (`/privacidade` da plataforma serve).
- App Store Connect: Apple Developer Program, mesmas fichas, revisão da Apple (jogos em WebView passam quando o app é o jogo completo, não um site embrulhado).
- Ícones e splash: gerar com `@capacitor/assets` a partir de um PNG 1024×1024 (ainda não feito).
