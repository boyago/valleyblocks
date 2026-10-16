# Multiplayer cooperativo (ValleyBlocks)

- Incluído na versão completa (R$ 29,90): só contas com acesso ilimitado criam sala.
  Qualquer conta logada entra na sala de um amigo com o código de 6 caracteres.
- Até 4 jogadores. O anfitrião é dono do mundo e o único que salva. O convidado recebe
  semente + blocos alterados (sem inventário nem posição do anfitrião) e nunca grava essa cópia.
- Transporte: WebSocket `/mp` no próprio `server.cjs` (biblioteca `ws`), lógica em
  `lib/server/multiplayer.mjs` (testável) e adaptador em `lib/server/multiplayer-ws.mjs`.
- Segurança: cookie de sessão HttpOnly obrigatório, Origin igual a `LABS_ORIGIN`, mensagens
  validadas (inteiros, faixas, tamanho), limite de 40 mensagens/s por conexão, snapshot só do
  anfitrião e só para quem está entrando, ping a cada 20 s derruba conexões mortas.
- Sincroniza: posição/olhar dos jogadores (10 por segundo), blocos colocados ou quebrados por
  pessoas, aparência. Água, areia e animais rodam em cada máquina.
- Variáveis: `LABS_MULTIPLAYER_ENABLED=true` (servidor) e `NEXT_PUBLIC_LABS_MULTIPLAYER_ENABLED=true`
  (build, mostra os botões no jogo).
- Teste local: `PREVIEW_ORIGIN=http://127.0.0.1:5196 NEXT_PUBLIC_LABS_MULTIPLAYER_ENABLED=true node .local/start-accounts-preview.mjs`
  e `node .local/mp-proxy.mjs`; abrir http://127.0.0.1:5196.
- Salas ficam em memória: um reinício do servidor fecha todas (os convidados voltam à tela inicial).
