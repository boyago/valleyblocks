# Verificação — Vale dos Blocos

## Caça e Grutas de Brasa 1.5.0 — 09/10/2026

- 92 testes Node passaram. Novos casos: extração de resina natural sem duplicação após reload, receita e munição do estilingue, consumo de munição e bloqueio de projéteis por paredes, reação do javali/recuperação do cachorro e travessia dos portais com preservação de terreno e posição.
- 11 verificações do cenário `test:hunting-underworld` passaram no navegador: inventário vazio, E no tronco, segunda coleta recusada, fabricação pela interface, tiro com clique esquerdo, dano ao cachorro, cura consumindo biscoito, portal, save/reload subterrâneo e retorno seguro. Nenhum erro de execução.
- 14 verificações de sobrevivência passaram, incluindo caça, entrega pelo cachorro, cozinha, alimentação, necessidades, pausa e persistência.
- 10 verificações do portal passaram no build 1.5.0, inclusive zero itens e nove atalhos vazios em novos mundos. Build Vite de 30 módulos sincronizado pelo script oficial. Não houve publicação pública.
- Inspeção visual: estilingue na mão, menu do pet com vida, portal e caverna com lava. Relatórios em docs/hunting-underworld-report.json, docs/survival-report.json e docs/portal-report.json. Capturas em test-results/slingshot-equipped.png, boar-pet-health.png, underworld-portal.png e underworld-cavern.png.

Receita adotada: madeira e resina, sem lava. Acesso adotado: portal de ida e volta. A caverna é uma região subterrânea do mesmo mundo, com teto e paredes; vulcões e lava fluindo não foram acrescentados.

## Início vazio e modelos Blender 1.4.0 — 09/10/2026

- 87 testes Node passaram. Inventários novos completamente vazios nos dois modos, com nove atalhos vazios, inclusive depois de serializar/restaurar. Testes de ferramentas e biscoitos recebem seus recursos explicitamente.
- 29 verificações de mochila/churrasqueira passaram: ausência de itens equipáveis no início, mochila vazia nos dois modos, catálogo, estação adquirida, oito receitas, consumo de ingredientes e persistência.
- 17 verificações de expansão passaram, incluindo modelos na mão, câmeras, coleta e transporte de água, churrasqueira, areia e compatibilidade de saves antigos.
- 10 verificações do portal passaram no build 1.4.0, incluindo confirmação de inventário com zero itens e nove atalhos vazios no iframe de produção.
- Modelos originais criados e inspecionados no Blender conectado, depois conferidos no navegador. Fonte editável: assets/blender/utensilios-labsgames.blend. Churrasqueira com 1.128 triângulos agrupada por chunk; balde com 464 triângulos e geometrias compartilhadas pelas mãos/vistas do avatar. Recursos GPU são descartados com o mundo/avatar.
- Build Vite de 25 módulos sincronizado pelo script oficial do portal local. Evidências: test-results/empty-inventory-*.png, barbecue-world.png, expansion-bucket.png e docs/backpack-report.json, expansion-report.json, portal-report.json. Não houve publicação pública.

## Kit mínimo 1.3.3 — 09/10/2026

- Novos mundos começam apenas com balde e 32 biscoitos nos dois modos: nenhuma ferramenta ou bloco, sete atalhos vazios. Saves existentes são preservados.
- 87 testes Node passaram; 27 verificações de mochila/churrasqueira passaram no navegador. O cenário de churrasqueira fornece sua própria estação após conferir o kit mínimo.
- 10 verificações do portal passaram, incluindo uma confirmação explícita do inventário e dos atalhos no build de produção 1.3.3. Build sincronizado localmente pelo script oficial.
- Inspeção visual confirmou apenas dois itens na mochila. A oficina passou a se chamar “Receitas para fabricar”, distinguindo receitas de itens possuídos. Relatórios em docs/backpack-report.json e docs/portal-report.json.

## Kit inicial e churrasqueira 1.3.2 — 09/10/2026

- 87 testes Node passaram, incluindo kit restrito nos dois modos e preservação de inventários salvos. Os testes antigos passaram a considerar a churrasqueira inicial e os 32 biscoitos também no criativo.
- 27 verificações de mochila/churrasqueira passaram no navegador: apenas três itens no kit, atalhos, 54 espaços, layout compacto, colocação nos dois modos, consumo no sobrevivência, receitas completas sem ingredientes, abertura por E e botão direito, produção e save/reload.
- 14 verificações de caça e sobrevivência passaram. O cenário fornece explicitamente o machado de teste e olha para fora da churrasqueira antes de comer, pois o botão direito mirando a estação agora abre seus preparos.
- 9 verificações do portal passaram com build 1.3.2; sem erros de execução. Build sincronizado pelo script oficial do portal local; sem publicação pública.
- Painel da churrasqueira inspecionado visualmente: oito receitas em duas colunas no desktop, ingredientes e materiais faltantes. Evidências: test-results/barbecue-recipes.png e docs/backpack-report.json, docs/survival-report.json, docs/portal-report.json.

A alteração do kit vale somente para novos mundos, conforme solicitado; nenhum inventário existente é limpo na atualização.

## Lava e diamantes 1.3.1 — 08/10/2026

- 87 testes Node passaram, incluindo poças com fundo fechado, minério exposto e subterrâneo, geração determinística entre chunks positivos/negativos, preservação de áreas editadas na migração e persistência depois de minerar.
- 6 verificações no navegador passaram: poça natural, malha de lava visível, mineração real com picareta, dano sem coletar lava, save/reload e ausência de erros de execução. Capturas em test-results/geology-lava-pool.png e geology-lava-contact.png.
- 9 verificações do portal passaram no build 1.3.1, sincronizado com o script oficial. Build Vite com 23 módulos, sem erros.
- Testes confirmaram que o Criativo não recebe dano da lava, pets recusam posições sobre lava e a tentativa de coleta com balde vazio não altera o inventário.
- Relatórios: docs/geology-report.json e docs/portal-report.json. Comando para repetir o cenário: npm run test:geology.

A lava desta versão é estática. Não foram implementadas propagação, reação com água ou coleta em balde. Validação e sincronização locais; não houve publicação no site público.

## Sobrevivência 1.3.0 — 08/10/2026

Galinhas, coelhos e javalis podem ser caçados; cães domesticados caçam e trazem carne ao jogador. A churrasqueira prepara as três carnes com carvão. Saciedade, energia, exaustão e respiração ofegante funcionam no sobrevivência, com recuperação ao comer ou descansar e persistência nos saves existentes.

- 83 testes Node passaram. Os sete testes novos cobrem necessidades, restrições de corrida, alimentação, receitas, caça, entrega única pelo cachorro, persistência e agendamento do áudio. Esses sete também passaram após o ajuste final que remove da barra rápida o alimento consumido por completo.
- 14 verificações do navegador passaram no ciclo de caça, coleta, churrasqueira, alimentação, corrida, descanso, comando do cachorro, transporte visível da carne, entrega, pausa e save/reload; sem erros de execução.
- 29 verificações da sessão geral passaram, incluindo construção, pets, veículos, inventário e salvamento.
- 9 verificações do portal passaram com a versão 1.3.0 no iframe; sem erros de execução. Build Vite sincronizado pelo script oficial do portal local.
- Evidências: docs/survival-report.json, docs/browser-report.json, docs/portal-report.json e test-results/survival-*.png.

Os testes de navegador usam um perfil isolado e cenários controlados no desenvolvimento. O teste do portal usa o build de produção. Não houve publicação no site público. O preparo na churrasqueira continua instantâneo; não foi acrescentado um ciclo de cozimento por tempo.

## Correção 1.2.1 — 08/10/2026

Rampas colocadas acompanham a direção horizontal do personagem, em quatro orientações. A malha, a altura de apoio e as colisões usam a mesma orientação, persistida nas edições do mundo; saves antigos continuam voltados ao norte.

- 76 testes Node passaram, incluindo subida a pé e salto de carro nas quatro direções, geometria/normais, colisão parcial e coordenadas negativas em bordas de chunks.
- 12 verificações no navegador passaram: colocação real por clique direito nos dois modos, débito correto no sobrevivência e save/reload com as quatro orientações.
- 9 verificações do portal passaram com build 1.2.1. Build sincronizado pelo script oficial.
- Evidências: docs/ramps-report.json e test-results/ramp-facing-*.png.

### Registro da validação anterior

Executada em 29/09/2026, versão 1.1.0. Build de produção gerado e copiado para o portal local pelo script oficial `site/scripts/sync-games.mjs`.

## Resultado

| Verificação | Resultado |
| --- | --- |
| `npm test` | 66 testes passaram; nenhuma falha |
| `npm run build` | Vite compilou 19 módulos; build estático com caminhos relativos |
| `npm run test:browser` | 29 verificações passaram; nenhum erro de execução no navegador |
| `npm run test:physics` | 11 verificações passaram; água, natação, tochas, queda e salto de veículos, persistência e ausência de erros |
| `npm run test:expansion` | 17 verificações passaram; avatar, três câmeras, ferramenta, mergulho, balde, forja, areia, cinco biomas e saves antigos |
| `npm run test:portal` | 9 verificações passaram no iframe do LABSGames; nenhum erro de execução |
| Inspeção visual | Tela inicial, primeira pessoa, inventário, pet, direção, configurações, portal e iluminação noturna |

O build do jogo contém 7 arquivos, cerca de 657 kB sem compressão. Os dois bundles JavaScript somam aproximadamente 169,1 kB com gzip. Não há texturas, fontes, áudio ou modelos dependentes de CDN em tempo de execução.

## Atualização 1.2.0 — 08/10/2026

- 72 testes Node passaram: novos inventários sem blocos nos dois modos, catálogo persistente, migração de saves, mais de 54 pilhas sem perda e receitas atômicas da churrasqueira.
- 17 verificações do navegador para mochila/churrasqueira passaram, incluindo nove colunas no desktop, layout compacto, tecla 3 com balde, catálogo, colocação com botão direito, interação E e reload.
- 17 verificações da expansão passaram (baldes com coleta/transporte/resfriamento, água, areia, avatar e biomas).
- 29 verificações da sessão completa passaram (criação, construção, pets, veículos, transferências, menus e salvamentos).
- 9 verificações do portal passaram: versão 1.2.0 no iframe, pointer lock, movimento, pausa, reinício e destruição; sem erros de execução.
- Build Vite gerado e sincronizado pelo script oficial do portal. Capturas: test-results/backpack-*.png e barbecue-*.png. O modelo da churrasqueira é geometria procedural original, sem arquivos externos do Blender.
- O cenário antigo de criação passou a fornecer seus materiais explicitamente: novos mundos não recebem blocos. O clique com pointer lock usa down/up sem mover o cursor, para não alterar a mira no teste.

## Expansão 1.1.0

Os testes novos verificam areia acelerando e depositando no fundo da água, colunas, save durante a queda e regiões descarregadas sem impedir quedas próximas. Água tem bordas contínuas e não cria colisão ao escavar o fundo. Baldes conservam itens em coleta, recusa, despejo, abastecimento e produção da forja; correntes rasas são recusadas. O gerador 1 continua disponível para saves antigos, e o gerador 2 produz os novos minérios e biomas. O avatar equipa a mesma ferramenta nas vistas internas/externas e a câmera recua antes de paredes.

No navegador foram usados C, teclado, clique direito e interface da forja; testados o afundamento passivo, saída pela margem, queda de areia até o fundo e persistência de câmera, forja, lingote e terreno. Os cinco biomas foram conferidos visualmente. A restauração sem os novos campos foi exercitada e conserva inventário/edições no gerador 1. Capturas ficam em `test-results/expansion-*.png`.

## Cobertura automatizada

Os testes Node verificam movimento diagonal, corrida, salto, teto, agachamento, voo, rampas, quedas, paredes, spawn e restauração seguros. Também cobrem aceleração/frenagem/ré, obstáculos em alta velocidade, buracos, saída da garagem, faróis, sobreposição de carros rotacionados, posicionamento de veículos e embarque/desembarque.

A regressão 1.0.1 acrescenta propagação, queda e recuo de água; sete níveis laterais; fronteiras positivas/negativas de chunks; descarga e restauração de fluxos; orçamento de simulação; apoio de tochas, remoção por água e devolução única do item. Natação é verificada a 120, 30 e 10 FPS, com saída por margem, mergulho, afundamento passivo e subida controlada, paredes altas, teto e amortecimento de quedas. Veículos são testados em saltos, queda sem motorista, colisão de cantos, queda rápida, aterrissagem e restauração de saves antigos ou durante um salto.

O roteiro `test:physics` prepara cenários reproduzíveis no build de desenvolvimento e usa teclado e mouse para nadar, tentar empilhar uma tocha e acelerar pela rampa. Confirma a água preenchendo dois espaços abertos durante a simulação, carro estacionado caindo de y=9 até o piso em y=6 e trajetória que sobe além da ponta da rampa e depois desce. O save restaura o nível da água corrente. Capturas desses cenários ficam em `test-results/physics-water-bank.png` e `test-results/physics-ramp-jump.png`.

O mundo foi explorado e editado em 24 regiões, de `z=−768` a `z=704`. Em qualidade equivalente à baixa, o teste confirmou no máximo 49 chunks de dados residentes e 27 meshes de terreno, com todas as alterações preservadas após recriar o mundo. Asfalto e espaço livre foram verificados em ambos os sentidos da estrada; testes separados cobrem bordas de chunks negativos, determinismo, raycast e descarte de geometrias.

Inventário/criação: pilhas de até 64; nenhuma concessão de kit após restore; transações atômicas; materiais insuficientes; receitas que exigem bancada; montagem do carro; reposição de petiscos; transferências repetidas sem duplicação. Porta-malas com 25.000 itens é restaurado sem truncamento. Velocidade, esterçamento, nomes, pelagens, comandos e passageiro são preservados.

O roteiro de navegador usa cliques, mouse e teclado reais via Playwright para minerar, construir, abrir menus, fabricar, domesticar, nomear, embarcar, dirigir, frear, guardar materiais, abrir porta/baú e salvar. Pontos de inspeção determinísticos são posicionados por uma ferramenta de teste disponível **somente no build de desenvolvimento**. O jogo de produção não expõe essa ferramenta.

Foram verificados IndexedDB real, salvamento automático, **Salvar e sair**, reload e continuação, preservando inventário, alterações do terreno, porta aberta, baú, porta-malas, veículo e pet passageiro. Menus liberam Pointer Lock e interrompem a simulação.

No portal local, o build de produção foi testado em `/jogos/vale-dos-blocos`: mensagens `ready`/`started`, carregamento do iframe, Pointer Lock, teclado, pausa, reinício e `destroy`. Esta verificação foi local; ela não constitui publicação no endereço público.

## Desempenho medido

| Ambiente | Valor |
| --- | --- |
| Sistema | Windows, navegador 64 bits |
| CPU | AMD Ryzen 5 5600G; 12 processadores lógicos expostos ao navegador |
| GPU usada pelo WebGL | NVIDIA GeForce GTX 1650, ANGLE / Direct3D 11 |
| Navegador | Microsoft Edge 153.0.4234.48, **headless**, via Playwright 1.62.1 |
| Servidor do jogo | Vite local; versão de desenvolvimento |
| Resolução efetiva | 1440 × 900, DPR 1 |
| Configuração | Média, sombras e neblina ligadas, 7 × 7 regiões visíveis |
| Cenário | Cerca de 6 segundos dirigindo pela estrada e atravessando chunks, com pet no banco; quatro animais no mundo |
| Amostras | 12 janelas de aproximadamente 0,5 segundo |
| FPS observado por janela | 162–200 FPS |
| Média aritmética das janelas | 193,3 FPS |
| Última amostra | 192 FPS; 114 draw calls; 23.960 triângulos |

Esses são resultados observados nessa execução, com outros aplicativos abertos. A medição headless não representa uma garantia de FPS em monitor, iframe, outros navegadores ou dispositivos. Os valores por janela não equivalem ao pior frame individual; não foi calculado percentil de frame time. O início da partida, compilação de shaders e carregamento inicial não fazem parte desse trecho de direção. O indicador de desempenho do jogo permite medir o ambiente real do jogador.

Dados completos: [browser-report.json](docs/browser-report.json), [physics-report.json](docs/physics-report.json), [expansion-report.json](docs/expansion-report.json) e [portal-report.json](docs/portal-report.json).

## Repetir

```sh
npm ci
npm test
npm run build
npm run dev
```

Em outro terminal, com Microsoft Edge instalado:

```sh
npm run test:browser
npm run test:physics
npm run test:expansion
```

Para o portal, primeiro sincronize os builds e execute o site na porta 5174, conforme o README do LABSGames. Em seguida:

```sh
npm run test:portal
```

`GAME_URL` e `PORTAL_URL` substituem os endereços locais usados nos testes. `BROWSER_CHANNEL` substitui `msedge` por outro canal Playwright instalado, como `chrome`. `PLAYWRIGHT_MODULE` permite usar uma instalação externa do Playwright. Capturas e relatórios de cada execução ficam em `test-results/`.

## Limites da verificação

Não foi feito teste de horas de duração, benchmark móvel, comparação entre GPUs ou teste de stress com milhões de edições. Os sons foram verificados pela inicialização e execução do grafo Web Audio, sem análise subjetiva auditiva. Água sem pressão ou conservação volumétrica, sobrevivência simplificada, rampas voltadas ao norte e navegação local são simplificações desta versão, descritas no README. O benchmark de direção não mede carga máxima de fluidos.

## Progressão de ferramentas — 1.6.0 (10/10/2026)

`npm test`: 101 testes aprovados. `npm run test:tools`: 24 verificações no navegador, cobrindo mãos e ferramentas insuficientes nos dois modos, receitas reais da churrasqueira e bancada, todos os minérios com diamante, modelo na mão e persistência. `npm run test:geology`: 6 verificações aprovadas com picareta de ferro. `npm run test:portal`: 10 verificações aprovadas na versão de produção 1.6.0. Nenhum erro de execução no navegador. Build Vite concluído e copiado para o portal local. Relatórios em docs/tools-report.json, docs/geology-report.json e docs/portal-report.json.

## Casa, geração aleatória e inimigos — 1.7.0 (10/10/2026)

`npm test`: 107 testes passaram, incluindo seis cenários novos para diversidade de mundos com estruturas garantidas, compatibilidade do gerador, janela noturna, limite de inimigos, golpes e colisões, explosão/ácido, imunidade criativa, combate com estilingue e persistência. `npm run test:night`: 13 verificações no navegador passaram, incluindo a churrasqueira inicial e suas receitas, novas seeds, surgimento automático ao entardecer, modelos renderizados, ataques reais, ácido, salvamento e amanhecer. `npm run test:portal`: 10 verificações passaram na versão 1.7.0. Nenhum erro de execução. Build Vite concluído. Relatórios: docs/night-report.json e docs/portal-report.json. Capturas em test-results/starter-grill.png, night-enemies.png e specter-acid.png.

## Sofá, TV, assovio e caminhada — 1.8.0 (10/10/2026)

113 testes Node passaram. Seis testes novos cobrem geometria e persistência dos móveis, descanso, aproximação/embarque/desembarque real do cachorro, restrições de segurança, articulação das pernas e as duas notas do assovio. `npm run test:home`: 13 verificações no navegador passaram, usando E e Q reais, incluindo áudio Web Audio ativo, cancelamento do descanso e persistência após recarregar. `npm run test:portal`: 10 verificações passaram no build 1.8.0, sem erros de execução. Relatórios em docs/home-report.json e docs/portal-report.json. Capturas: test-results/home-sofa.png, home-tv.png, whistle-passenger.png e reaper-walk.png.

## Gatos e invasores — 1.9.0 (10/10/2026)

118 testes Node passaram. Cinco cenários novos verificam a raridade e os limites de população, roubo de comida e recuperação sem duplicação, danos limitados em paredes, proteção do gato contra as quatro espécies, imunidade criativa, combate e persistência. `npm run test:pests`: nove verificações no navegador passaram, incluindo roubo real, recarga com comida roubada, comando pelo menu, caça, abertura do buraco e entrada do rato até o baú. Os quatro modelos e o menu foram inspecionados visualmente. `npm run test:portal`: dez verificações aprovadas na versão 1.9.0, sem erros de execução. Build Vite concluído e copiado para o portal local. Relatórios: docs/pests-report.json e docs/portal-report.json. Capturas: test-results/cat-guard-menu.png, rat-wall-hole.png e pest-species.png.

## Separação entre gatos e cachorros — 1.9.1 (11/10/2026)

120 testes Node aprovados. Dois novos cenários cobrem animais sobrepostos seguindo o jogador em três direções, distância ao parar, parede, passageiros e andares diferentes. `node tests/browser-pet-spacing.mjs`: quatro verificações aprovadas na simulação real, sem erros de execução. `npm run test:portal`: dez verificações aprovadas no build 1.9.1. Build copiado para o portal local. Relatórios em docs/pet-spacing-report.json e docs/portal-report.json; captura em test-results/pet-spacing.png.
