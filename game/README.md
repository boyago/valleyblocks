# Vale dos Blocos — LABSGames

Sandbox 3D de exploração, construção, carros e animais, feito em Three.js para computador com teclado e mouse. O jogo tem identidade, ilustrações, modelos cúbicos, texturas pixeladas e áudio originais. Integra o projeto [LABSGames](https://labs-games.alexandre-boyago.chatgpt.site/) como um build independente em `/games/vale-dos-blocos/`, pelo protocolo `iframe-labs-v1`.

## Executar e gerar o build

Requer Node.js 20.19 ou superior, npm e navegador com WebGL 2, Pointer Lock e Web Audio. Use um servidor HTTP local; abrir `index.html` diretamente como arquivo não carrega os módulos.

```sh
cd games/vale-dos-blocos
npm ci
npm test
npm run dev
```

Abra `http://127.0.0.1:5186`. Para verificar a versão de distribuição:

```sh
npm run build
npm run preview
```

O build sai em `dist/`, com caminhos relativos. Three.js está fixado em `0.170.0`, Vite em `6.0.0` e Playwright em `1.62.1` (apenas testes); `package-lock.json` registra as dependências transitivas. A aplicação usa HTML/CSS e JavaScript com módulos ES.

## Começar uma aventura

### Versão 1.6.0 — progressão de picaretas e machados

Pedra e minérios só podem ser removidos com uma picareta de nível suficiente **equipada e presente na mochila**, tanto no Sobrevivência quanto no Criativo. A tentativa com a mão, ferramenta insuficiente ou machado mantém o bloco e explica o requisito. Madeira, terra e demais materiais continuam acessíveis para iniciar a partida.

| Ferramenta | Receita | Pode extrair |
| --- | --- | --- |
| Picareta de madeira | 5 tábuas, sem bancada | Pedra e carvão |
| Picareta de pedra | 2 tábuas + 3 pedras, sem bancada | Anteriores + ferro e cobre |
| Picareta de ferro | 2 tábuas + 3 lingotes de ferro, na bancada | Anteriores + ouro, cristal e diamante |
| Picareta de diamante | 2 tábuas + 3 diamantes, na bancada | Pedra e todos os minérios, mais rápido |

Na churrasqueira, 1 minério de ferro + 1 carvão produz 1 lingote de ferro; a bandeja de água continua opcional. Comece cortando árvores, transforme madeira em tábuas e faça a picareta de madeira. O machado de pedra usa 2 tábuas + 2 pedras; os de ferro e diamante usam 2 tábuas + 3 unidades do respectivo material na bancada. Machados cortam madeira progressivamente mais rápido, mas não mineram pedra nem minérios. Não há desgaste das ferramentas nesta versão.

Os IDs antigos `pickaxe` e `axe` passam a representar as ferramentas de pedra, preservando quantidades e atalhos dos saves existentes. Novas ferramentas têm ícones e modelos nas cores do material, em primeira e terceira pessoa. A suíte testa a progressão completa com inventário inicialmente vazio, bloqueios, receitas, fundição e persistência.

### Versão 1.5.1 — física da lava e coleta de madeira

- Lava escoa por aberturas e desníveis, com níveis e superfície inclinada como a água. Fluxos recuam quando a fonte é removida e permanecem corretos ao salvar/reabrir o mundo. Água e lava não se substituem. A simulação respeita o mesmo orçamento de processamento da água e não carrega novas regiões por conta própria.
- O personagem afunda lentamente na lava, anda com 25% da velocidade normal e pode subir com Espaço ou descer com Ctrl. No Sobrevivência, contato causa **40 pontos de dano por segundo**, somente enquanto estiver na lava; Criativo é imune. O contato segue a altura real do líquido.
- **Madeira:** segure o botão esquerdo no tronco, com a mão ou qualquer item equipado (inclusive o estilingue). Machado corta mais rápido. **Resina:** pressione E, uma vez por árvore. Retirar resina não consome nem bloqueia a madeira. Fora dos troncos, o estilingue continua disparando normalmente.
- Regressões automatizadas: propagação, queda, limites de processamento, saves, contato, dano em diferentes taxas de quadros e coleta de madeira antes/depois da resina com vários equipamentos. Execute `npm test`.

### Versão 1.5.0 — estilingue, defesa dos javalis e Grutas de Brasa

- Javalis reagem aos cachorros em modo de caça: aproximam-se e atacam ao alcance, com linha de visão, por 18 de dano e intervalo de um segundo. Companheiros têm 100 de vida, preservada nos saves. Com 25 ou menos, abandonam a caça; com zero, ficam feridos e aguardam recuperação. Um biscoito pelo menu do pet recupera 30 de vida; para voltar a caçar são necessários pelo menos 50. Não há morte permanente do companheiro nesta versão.
- **Resina:** aponte para um tronco natural com copa e pressione E. Uma coleta por coluna de árvore, registrada no save; madeira recolocada não fornece resina. **Estilingue:** uma madeira + uma resina na bancada. **Munição:** uma pedra produz oito pedrinhas nas receitas. Equipe e clique com o botão esquerdo para disparar; cada tiro gasta uma pedrinha, causa 24 de dano e respeita gravidade, paredes e intervalo de 0,7 segundo. Não usa lava na receita.
- **Grutas de Brasa:** portal violeta perto de X 24 / Z −20, ativado com E, leva a uma caverna fechada com lava, passagens secas, cristais e diamantes. O portal de entrada serve para voltar. Companheiros que estão seguindo acompanham a travessia. Uma saída bloqueada é recusada. O portal e a caverna são deslocados na primeira migração caso haja edições anteriores no local; as posições ficam registradas no save.
- A lava subterrânea tem fundo de pedra e o mesmo dano já existente no Sobrevivência. Esta implementação usa portal, sem vulcões ou propagação de lava. Saves antigos conservam o inventário, o terreno editado e seus companheiros. Novos mundos continuam com mochila e nove atalhos vazios.
- Teste dedicado: `npm run test:hunting-underworld`. A demonstração local de caça permanece disponível no desenvolvimento em `http://127.0.0.1:5186/?demo=caca`, sem salvamento.

### Versão 1.4.0 — início vazio e modelos feitos no Blender

- Novos mundos no Sobrevivência e no Criativo começam com **zero itens**: mochila vazia e nove atalhos vazios, inclusive sem balde e sem biscoitos. Saves existentes mantêm os itens adquiridos. O catálogo criativo e as receitas permitem obter itens durante a partida.
- Churrasqueira e balde modelados no Blender conectado: churrasqueira de tijolos com grelha metálica, brasas, pegador e nicho para lenha; balde galvanizado oco, facetado, com aro e alça. O balde cheio mostra água e o modelo acompanha as câmeras de primeira e terceira pessoa. A churrasqueira também aparece como objeto na mão ao equipar.
- Fontes editáveis em `assets/blender/utensilios-labsgames.blend`; script reproduzível em `assets/blender/create_domestic.py`. Malhas trianguladas e cores exportadas em `src/assets/domestic-models.json`, sem carregamento externo. 1.128 triângulos na churrasqueira e 464 no balde. Churrasqueiras são agrupadas na malha de cada chunk.
- Balde: três minérios de ferro na bancada (ou um lingote na receita alternativa). Churrasqueira: oito tijolos e dois minérios de ferro na bancada. Coloque e abra com E para os oito preparos. A modelagem preserva as funções de água, receitas, colisão e saves.

### Correção da versão 1.3.3 — somente balde e biscoitos

Novos mundos dos dois modos começam exclusivamente com um balde vazio (tecla 3) e 32 biscoitos (tecla 9). Os outros sete atalhos ficam vazios, sem picareta, machado, churrasqueira, blocos ou peças. A churrasqueira continua disponível por fabricação ou catálogo criativo. Receitas exibidas na oficina não são itens possuídos. Conforme solicitado, a mudança vale apenas para novos mundos; Continuar conserva os itens do save existente.

### Novidades da versão 1.3.2 — kit inicial e churrasqueira

- Apenas novos mundos, nos dois modos, começam com churrasqueira (tecla 1), balde vazio (tecla 3) e 32 biscoitos (tecla 9). Os outros seis atalhos ficam vazios. Não há picareta, machado, materiais de construção, veículos ou peças no inventário inicial. Saves existentes conservam seus itens e atalhos.
- Coloque a churrasqueira com o botão direito. Aponte para ela e pressione E ou clique com o botão direito para abrir os oito preparos: frango, coelho, javali, lingotes de ferro/cobre/ouro, vidro e carvão de madeira. Todas as receitas aparecem mesmo sem ingredientes, com indicação do que falta.
- Baldes mantêm prioridade no botão direito para transferir água; use E para abrir o menu segurando um balde. No criativo, a churrasqueira segue a regra de blocos ilimitados; no sobrevivência, o kit fornece uma unidade. Materiais adicionais continuam disponíveis no catálogo criativo ou por coleta/criação.

### Novidades da versão 1.3.1 — poças de lava e diamantes

- Poças naturais de lava em diversas regiões, com bacia de pedra, duas camadas de lava e minério de diamante nas bordas. A primeira fica perto de **X 48 / Z 32**, salvo quando uma área modificada de um save anterior precisa ser preservada.
- Minério de diamante azul-claro também ocorre no subsolo, entre Y 2 e Y 7. Pode ser minerado e guardado; a picareta acelera a coleta. Diamante e lava estão disponíveis no catálogo criativo.
- A lava é atravessável, permanece visível à noite e tira 28 pontos de vida por segundo de contato no Sobrevivência. O Criativo não recebe esse dano. Animais evitam rotas pela lava.
- Saves antigos mantêm a versão do terreno. Na primeira atualização, poças próximas a edições existentes são excluídas; essa decisão é salva. Minerar uma borda depois não faz a poça inteira desaparecer ao recarregar.
- Nesta versão, lava forma poças estáticas: não há propagação, coleta por balde nem reação com água. O balde continua dedicado à água.

### Novidades da versão 1.3.0 — caça e sobrevivência

- Galinhas, coelhos e javalis com modelos originais, animação, fuga, colisão com o terreno e carne própria. Animais aparecem perto da área inicial e repovoam a vizinhança a cada 30 segundos quando a população local está baixa. Até 32 animais; distantes ficam inativos e os vivos além de 160 blocos podem ser substituídos por animais próximos. Carne deixada no chão nunca é descartada por esse repovoamento.
- Segure o botão esquerdo mirando uma presa até 3,6 blocos. Machado: 22 de dano; picareta: 14; mãos: 8. Cada golpe custa 5 de energia no Sobrevivência e respeita paredes/intervalo de 0,65 s. Cães e gatos não são alvos de caça. A carne é recolhida ao se aproximar.
- Domestique o cachorro com petisco e use E → Caçar e trazer a caça. Ele procura animais ou carne até 24–26 blocos do jogador, usa os caminhos existentes, carrega um pacote na boca e entrega na mochila. O comando Parar de caçar e seguir ou Espere aqui interrompe a busca. Desembarque antes de mandar caçar. Carne já carregada fica com ele até poder entregar; gatos não caçam.
- E na churrasqueira permite assar frango, coelho ou javali com uma carne crua + um carvão. Preparos continuam instantâneos nesta versão. Equipe o alimento pela mochila e use o botão direito para comer. Assados recuperam 30/34/40 de saciedade, 16/18/22 de energia e 6 de vida; crus alimentam menos. Petiscos também alimentam, mas perto de um pet abrem sua interação.
- Sobrevivência: saciedade e energia (0–100) no HUD. Correr, nadar, minerar e saltar gastam energia; descanso recupera. Energia esgotada bloqueia corrida até recuperar 25; saciedade de 10 ou menos também bloqueia corrida. Saltos exigem 8 de energia, sem bloquear a saída da água. Fome zero tira vida gradualmente. Respiração ofegante sintetizada acompanha a baixa energia e respeita volume, pausa e submersão. Criativo não sofre fome/cansaço.
- Fome, energia, presas, carne no chão, comando do cão e carne carregada são salvos. Saves anteriores ganham fauna e necessidades cheias sem perder inventário/terreno. Menus congelam a simulação. Não é necessário criar outro mundo.

### Novidades da versão 1.2.0

- Mochila com 54 espaços visíveis e expansão automática por pilhas, sem perder recursos ao ultrapassar esse total. A barra rápida mantém nove atalhos.
- Novos mundos dos dois modos começam sem blocos na mochila ou nos atalhos. Picareta, machado, balde e petiscos continuam disponíveis; no criativo, as peças e veículos iniciais também permanecem.
- No criativo, Tab → Catálogo criativo permite escolher os materiais e equipamentos. Apenas blocos escolhidos/coletados entram na mochila e ficam ilimitados.
- Balde vazio na tecla 3 em novos mundos, com ícone próprio. Botão direito coleta fontes de água, despeja em espaços livres e transfere água para a bandeja da churrasqueira.
- Churrasqueira doméstica de tijolos, grelha metálica e alça, substituindo a antiga churrasqueira (ID 24 preservado). Fabricada na bancada com 8 tijolos + 2 minérios de ferro; no criativo está no catálogo.
- E abre os preparos: ferro, cobre ou ouro + carvão produzem lingotes; 2 areias + carvão produzem 2 vidros; 2 madeiras produzem carvão. Água é opcional no preparo do ferro e é consumida se houver uma carga na bandeja.
- Saves antigos conservam itens, atalhos e estações. O kit sem blocos só é aplicado a novos mundos; não apaga recursos coletados. O inventário criativo antigo mantém os materiais que já estavam disponíveis.

### Expansão da versão 1.1.0

- Explorador original com chapéu, lenço e mochila; `C` alterna primeira pessoa, costas e frente. Mãos e itens equipados aparecem em primeira pessoa; a ferramenta acompanha o personagem nas outras câmeras.
- Areia sem apoio cai com aceleração, atravessa a água e se deposita no fundo. Quedas em andamento são salvas; regiões distantes ficam suspensas até serem carregadas novamente.
- O personagem afunda lentamente quando para de nadar. `Espaço` sobe, `Ctrl` mergulha mais rápido e `Espaço + WASD` permite sair pela margem. Superfícies de água corrente têm bordas contínuas entre células, sem paredes internas entre níveis.
- Baldes coletam fontes e transportam água. O botão direito enche/esvazia o balde ou abastece/retira água da churrasqueira. Correntes rasas não podem ser coletadas.
- Na bancada, 3 minérios de ferro criam um balde; 8 tijolos + 2 ferros criam uma churrasqueira. Coloque a churrasqueira e use `E`: 1 ferro + 1 carvão produzem 1 lingote; água é opcional. O lingote permite fabricar outro balde. Duas madeiras também produzem carvão.
- Novos mapas contêm carvão mineral, cobre, ferro, ouro e cristal violeta. Há pradarias, desertos, florestas densas, mesetas de argila e altos nevados, além dos ambientes iniciais.
- Saves antigos mantêm o gerador 1 e seus identificadores; mapas novos usam o gerador 2. **Os novos biomas e a distribuição dos novos minérios exigem um mundo novo**. Câmeras, ferramentas, baldes, receitas e física também funcionam em saves antigos. Criar um novo mundo substitui o save local quando ele for salvo.

Escolha Criativo ou Sobrevivência e informe uma seed, ou continue um mundo salvo. A área inicial tem chão firme, casa com bancada e baú, garagem, estrada, veículos e Pingo e Lua próximos da casa; Mel e Nino exploram os arredores. Há três pelagens por espécie.

1. Entre no mundo e clique na área de jogo para capturar o mouse.
2. Aponte para um bloco próximo e segure o botão esquerdo até completar a mineração.
3. Colete materiais ou, no criativo, escolha-os em Tab → Catálogo criativo. Clique no item da mochila para equipá-lo na barra rápida e coloque-o com o botão direito.
4. Aproxime-se de um animal e pressione `E`. Ofereça petisco, escolha um nome e peça para seguir ou esperar.
5. Aproxime-se de um carro e pressione `E`. Percorra a estrada, pare e abra o porta-malas com `Tab`.
6. Com um carro parado e próximo, abra o menu do pet e escolha embarcar. Ele ocupa um assento visível.
7. Em `Esc`, use **Salvar agora** ou **Salvar e sair**. **Continuar mundo salvo** restaura a partida.

## Controles

| A pé | Ação |
| --- | --- |
| `W A S D` | Movimentar; movimento diagonal normalizado |
| Mouse | Olhar ao redor com Pointer Lock |
| Espaço | Pular; subir durante voo ou natação; com WASD, sair pela margem |
| Shift | Correr |
| Ctrl | Agachar; descer durante voo ou mergulhar |
| Botão esquerdo, segurando | Minerar o bloco destacado ao alcance |
| Botão direito | Colocar bloco/veículo ou usar o balde equipado |
| `1–9` ou roda do mouse | Selecionar espaço da barra rápida |
| Tab | Abrir inventário e receitas |
| E | Interagir com carro, animal, baú, bancada, churrasqueira ou porta |
| C | Alternar primeira pessoa, costas e frente |
| V | Alternar voo no Criativo |
| Esc | Pausar, abrir menu e liberar o cursor |
| F | Solicitar tela cheia |

| No veículo | Ação |
| --- | --- |
| W | Acelerar |
| S | Frear e, ao parar, dar ré |
| A / D | Esterçar |
| Espaço | Freio de mão |
| C | Alternar câmera interna e externa |
| H | Buzina |
| L | Faróis |
| E | Sair em baixa velocidade, com o carro no chão e espaço seguro |
| Tab | Porta-malas com veículo parado no chão |
| Esc | Pausar |

Os menus suspendem ações do mundo. Para retomar o controle de câmera, é necessário um clique aceito pelo navegador. A tecla Esc também é reservada pelo próprio navegador para sair de Pointer Lock ou tela cheia.

## Mundo, construção e progressão

O terreno procedural é reproduzível por seed. Existem campinas, bosques, serras, áreas arenosas, praia, lago, cavernas e minério. As estruturas iniciais são geradas no mesmo ponto para tornar cada nova partida acessível.

Os chunks têm `16 × 16` colunas e 64 blocos de altura. O terreno carrega conforme a exploração e descarrega geometrias distantes. As modificações permanecem em um registro separado do terreno procedural. Mineração e construção atualizam imediatamente os dados de colisão; faces de chunks vizinhos são reconstruídas quando uma edição ocorre na borda. A renderização agrupa as faces visíveis e usa atlas de textura criado em memória.

Há 24 blocos: grama, terra, pedra, areia, madeira, folhas, vidro, tijolos, água, minério de ferro, asfalto, tábuas, tocha, porta, bancada, baú, rampa, carvão, cobre, ouro, cristal violeta, neve compacta, argila e churrasqueira. O raio de interação é limitado. A construção recusa posições ocupadas pelo jogador, animais, veículos e areia em queda.

- **Criativo:** blocos ilimitados e voo. Ferramentas, petiscos, peças e veículos têm quantidades próprias; o kit inicial permite experimentar esses sistemas.
- **Sobrevivência:** recursos limitados, coleta, fabricação e vida. Quedas e falta de ar causam dano. Ao perder toda a vida, o jogador retorna a um ponto seguro com a mochila preservada.
- **Inventário:** nove espaços rápidos e itens agrupados em pilhas de até 64; a mochila comporta novas pilhas para não descartar recursos silenciosamente.
- **Criação:** receitas explícitas para ferramentas, construção, petiscos, rodas, estrutura, motor, compacto e utilitário. As peças e os veículos exigem proximidade de bancada.
- **Petiscos renováveis:** três folhas produzem quatro petiscos; animais podem continuar recebendo alimento após o kit inicial.
- **Armazenamento:** baús e porta-malas transferem quantidades entre recipientes sem copiar o mesmo item. Cada clique no menu movimenta até oito unidades.

A água se propaga para espaços abertos, cai em buracos e recua quando perde a fonte. O fluxo lateral tem até sete níveis e a simulação usa uma fila limitada por atualização. Tochas exigem um bloco inteiro e seco por baixo; não podem ficar empilhadas e são recuperadas ao perder o apoio ou ser atingidas pela água.

Os carros têm aceleração gradual, marcha à ré, freio, esterçamento, rodas animadas, colisão e gravidade, inclusive estacionados. Rampas novas sobem na direção horizontal do olhar ao serem colocadas (norte, leste, sul ou oeste), com orientação preservada no save. Rampas antigas e a rampa inicial mantêm a direção norte (`−Z`); ao sair da ponta com velocidade, o carro conserva o impulso e faz uma trajetória de salto até aterrissar. Remover o chão sob um carro faz ele cair. Degraus altos e paredes bloqueiam o veículo. Embarcar, desembarcar e abrir o porta-malas exigem apoio no chão; a saída também procura uma posição livre próxima ao carro.

Cachorros e gatos têm modelos e animações distintos. Os pets podem ser alimentados, domesticados, nomeados, acariciados, seguir, esperar ou viajar de carro. A navegação consulta a ocupação voxel e refaz caminhos após alterações no terreno; há recuperação para situações em que um pet fica preso. A recuperação procura chão e espaço livres.

## Som e configurações

O áudio só é inicializado após interação do usuário. Efeitos e música têm controles independentes. Todos os sons são sintetizados por Web Audio: passos por material, mineração, construção, inventário, coleta, criação, portas, água, vento, pássaros, ambiente noturno, cachorro, gato, motor, buzina, freio e colisão. Panners espaciais posicionam animais, veículos e efeitos no mundo.

A música usa um motivo original de piano sintetizado com harmônicos e intervalos prolongados de silêncio. Não são carregadas faixas de terceiros.

Em **Som e imagem**, ajuste qualidade baixa/média/alta, sombras, neblina, música, efeitos, sensibilidade do mouse e indicador de desempenho. A qualidade controla a distância de visão e a resolução de renderização. O indicador informa FPS, resolução efetiva e chamadas de desenho. O objetivo é aproximar-se de 60 FPS, mas a taxa depende do dispositivo, navegador, resolução, sombras e exploração.

**Desempenho medido na versão 1.1.0:** no Edge 153 headless, com Ryzen 5 5600G e GTX 1650, a 1440 × 900, qualidade média e sombras ligadas, 12 amostras durante cerca de seis segundos de direção variaram entre **162 e 200 FPS**, média das janelas de **193,3 FPS**. Esse resultado não garante o mesmo desempenho em outros ambientes. Veja metodologia, dados e limites em [TESTES.md](TESTES.md).

## Salvamento e continuidade

O jogo mantém um mundo salvo por origem do navegador, com salvamento automático a cada 30 segundos de simulação e uma tentativa adicional quando a aba fica oculta. O botão de continuar recupera seed, modo, alterações nos blocos, níveis e atualizações pendentes da água, jogador, inventário, baús, portas, horário, carros (inclusive velocidade vertical e inclinação), porta-malas, pets, nomes/comportamentos e configurações. Também restaura areia em queda, câmera e água da churrasqueira. Mundos antigos continuam compatíveis, usando o gerador original.

O armazenamento principal é IndexedDB, banco `labs-vale-dos-blocos`, object store `snapshots`, chave `current`. O formato atual usa `version: 1`. Cada gravação é um snapshot completo em uma transação: os dados são copiados antes da operação assíncrona, validados e substituídos de uma vez. Restaurar a mochila não concede novamente o kit inicial. A restauração substitui as listas de entidades, sem anexar cópias.

Quando a API IndexedDB não existe no navegador, há fallback para localStorage na chave `labs-vale-dos-blocos:save:v1`. As preferências também são mantidas na chave `vale-settings`. Não existe conta, sincronização remota ou gravação em servidor. Limpar os dados do navegador remove a partida. Saves de `localhost` e do site publicado pertencem a origens diferentes. Erros de quota ou acesso ao armazenamento são reportados ao jogador; não significam que o mundo foi salvo.

Use **Salvar e sair** antes de encerrar a sessão; fechar o processo do navegador não garante a conclusão de uma transação pendente. Criar outro mundo substitui o save anterior quando o novo mundo é salvo.

## Arquitetura

| Módulo | Responsabilidade |
| --- | --- |
| `src/main.js` | Inicialização, integração entre sistemas, loop, interação e conexão com LABSGames |
| `src/world.js` | Seed, geração, chunks, atlas pixelado, faces visíveis, edição, colisão e raycast voxel |
| `src/blocks.js` | IDs e propriedades dos blocos |
| `src/player.js` | Primeira pessoa, gravidade, colisão, salto, voo, água e vida |
| `src/avatar.js` | Modelo original, mãos, ferramentas equipadas e câmeras externas com proteção contra paredes |
| `src/granular.js` | Queda de areia, interação com água, orçamento de simulação e persistência |
| `src/interactions.js` | Transferências de água por balde e produção da churrasqueira |
| `src/entities.js` | Veículos, câmeras, animais, navegação, assentos e serialização das entidades |
| `src/inventory.js` | Itens, pilhas, receitas, fabricação e transferências |
| `src/audio.js` | Efeitos, áudio espacial, motor e trilha sintetizada original |
| `src/save.js` | Validação e persistência local dos snapshots |
| `src/sky.js` | Céu, nuvens, ciclo de luz e atmosfera |
| `src/particles.js` | Partículas de interação com blocos |
| `src/ui.js` / `src/style.css` | Menus, HUD, inventário, configurações, guia e identidade visual |
| `src/labs-game-sdk.js` | Mensagens `iframe-labs-v1` com o portal |
| `tests/` | Regressões de mundo, inventário, criação, armazenamento e áudio |
| `public/capa.svg` / `public/miniatura.svg` | Ilustrações vetoriais originais para o catálogo |

## Integração com LABSGames

O registro fica em `games/catalogo.json`, slug `vale-dos-blocos`, categoria `aventura`, somente `desktop`. O portal deve disponibilizar `dist/` em `/games/vale-dos-blocos/` e incorporar o `index.html` pelo contrato de `games/CONTRATO.md`. O jogo não importa código do site. O build inclui os SVGs da capa e miniatura automaticamente.

O build e o catálogo foram sincronizados para o portal local com `node site/scripts/sync-games.mjs` (a partir da raiz do projeto). A página local é `http://localhost:5174/jogos/vale-dos-blocos`. Para publicar a atualização no endereço público, use o fluxo de publicação do projeto LABSGames.

Para funcionar em iframe, o contexto deve permitir teclado, tela cheia, WebGL, áudio após gesto e Pointer Lock. Se o portal usar `sandbox`, é necessário permitir explicitamente Pointer Lock e as demais capacidades utilizadas. Em standalone, o jogo usa sua própria tela inicial.

## Verificação

Execute `npm test` e `npm run build`. Os testes automatizados incluem:

Resultado verificado: **66 testes Node**, **29 verificações gerais no navegador**, **11 verificações de física**, **17 verificações da expansão** e **9 verificações no iframe do portal**, todos passando. `npm run test:browser`, `npm run test:physics`, `npm run test:expansion` e `npm run test:portal` repetem os roteiros com Playwright e Microsoft Edge. Servidores locais devem estar rodando; detalhes e resultados em [TESTES.md](TESTES.md).

- Área inicial e rampa, bordas positivas/negativas de chunks, preservação de edições após descarregamento e restauração.
- Raycast, faces de entrada, alcance e determinismo por seed; água, minério e descarte de geometrias.
- Pilhas de até 64 e quantidades conservadas, kit inicial não repetido no reload e bloqueio de quantidades inválidas.
- Fabricação atômica, falta de ingredientes, necessidade de bancada, carro completo e reposição de petiscos.
- Transferências repetidas entre mochila, baú e porta-malas sem duplicação; recusas não consomem itens.
- Snapshot independente do estado vivo, validação de números, substituição completa, exclusão de save e fallback localStorage.
- Áudio inerte antes de inicialização e controle de volumes.

Esses testes exercitam lógica e geometria. Não substituem a verificação visual, a experiência de Pointer Lock, áudio real, IndexedDB em navegador ou medição de renderização.

### Roteiro manual de regressão

| Cenário | Resultado esperado |
| --- | --- |
| Quebrar/colocar em `x=15/16` e `x=−1/0`, inclusive cantos de chunks | Faces e colisões corretas nos dois lados; alteração persiste ao voltar |
| Andar diagonalmente, pular contra teto, agachar e tentar levantar | Velocidade consistente e ausência de passagem por blocos |
| Colocar um bloco junto ao jogador, carro e animal | Ocupação recusada sem gastar item |
| Minerar sob/à frente de uma colisão | Física passa a usar o terreno editado |
| Escavar junto ao lago e sob a água | Água ocupa os vazios, respeita paredes e cai em níveis inferiores |
| Entrar na água, mergulhar e sair pela margem | Ctrl mergulha; Espaço sobe; Espaço + WASD sai sem voo ou passagem por paredes |
| Colocar tocha sobre outra e remover a base de uma tocha | Empilhamento recusado sem consumo; perder apoio recupera a tocha uma única vez |
| Remover o chão sob um carro parado | Veículo cai mesmo sem motorista e aterrissa no próximo piso |
| Dirigir rápido por várias regiões | Terreno físico preparado antes da travessia; nenhuma queda no vazio |
| Colidir com parede, acelerar pela ponta da rampa e tentar subir degrau alto | Parede e degrau bloqueiam; rampa permite salto com impulso e gravidade |
| Estacionar junto a parede e sair | Saída para área livre ou recusa clara; jogador fora da carroceria |
| Alternar inventário, pausa, caminhada e direção | Ações suspensas nos menus; mouse liberado e retomado por clique |
| Domesticar, renomear, seguir, esperar e acariciar pets | Estado, reação e som coerentes |
| Construir parede entre jogador e pet; remover e reconstruir | Rota é refeita; recuperação mantém posição segura |
| Embarcar pet parado, viajar e desembarcar | Um único pet ocupa o assento e reaparece em posição segura |
| Salvar com blocos, baú, peças, carro e pet alterados; recarregar | Mesmo mundo e quantidades, sem concessão de kits ou entidades duplicadas |
| Explorar/editar e voltar repetidamente | Recursos gráficos distantes liberados; alterações permanecem |
| Qualidades, sombras, neblina e volumes | Mudanças aplicadas e restauradas após salvar |
| Portal: iniciar, pausar, retomar, tela cheia e destruir iframe | Fluxo do contrato sem listeners ou áudio persistentes após descarte |

## Escopo e limitações

- Experiência individual de navegador; não há multiplayer, servidor, compartilhamento de mundos, touch/gamepad ou sincronização entre dispositivos.
- Sobrevivência simplificada: vida, mineração e criação; não há fome, inimigos, combate, durabilidade de ferramentas ou cadeia industrial.
- Água tem propagação voxel simplificada em até sete níveis laterais; não há simulação de pressão ou conservação volumétrica de líquidos.
- Até oito veículos por mundo. Quatro animais iniciais, com uma vaga de passageiro por veículo.
- Mundo com altura de 64 blocos; os chunks são gerados de forma incremental no thread principal, sem geração em Web Workers.
- A física dos veículos combina condução pelo relevo, gravidade e saltos. Não simula suspensão mecânica completa, capotamentos, deformação ou destruição dos carros.
- Rampas têm uma orientação fixa para o norte; não há ferramenta de rotação de blocos.
- Navegação animal é local. Labirintos muito grandes ou mudanças repetidas podem exigir recuperação de posição.
- A geometria agrega faces expostas, sem greedy meshing. Renderização de transparências e iluminação de tochas são aproximações adequadas ao estilo.
- Sons são síntese estilizada, não gravações realistas. Limitações de autoplay podem exigir novo clique para iniciar áudio.

## Planejamento futuro

O multiplayer foi reservado para uma etapa futura paga, com **licença permanente após o pagamento** e restrições ainda a definir. A implementação atual permanece individual. Decisões comerciais pendentes, proposta técnica e melhorias de jogabilidade solicitadas estão registradas em [docs/ROADMAP.md](docs/ROADMAP.md).

## Autoria e licenças

Texturas são geradas em código; modelos de casa, carros e animais usam formas cúbicas; capas são SVGs desenhados para este projeto; efeitos e composição de piano são sintetizados originalmente. Não há assets, marcas, texturas, modelos ou gravações extraídos de Minecraft. A inspiração em construção voxel não implica afiliação a Mojang ou Microsoft.

Three.js e Vite são distribuídos sob licença MIT; os textos de licença estão nos respectivos pacotes instalados. O código e os assets produzidos para este jogo pertencem ao projeto LABSGames; este README não atribui uma nova licença pública ao repositório. Preserve as licenças das dependências ao redistribuir.

## Ferramentas e mineração — 1.6.0

Novos mundos continuam sem itens nos dois modos. Corte troncos com a mão, transforme cada madeira em quatro tábuas e fabrique a picareta de madeira com cinco tábuas. Ela extrai pedra e carvão; a picareta de pedra (três pedras e duas tábuas) libera ferro e cobre.

Na churrasqueira, cada minério de ferro com um carvão produz um lingote. Na bancada, três lingotes e duas tábuas criam a picareta de ferro, capaz de extrair ouro, cristal e diamante. Três minérios de diamante e duas tábuas criam a picareta de diamante, que extrai todos os minérios mais rápido. Existem também machados de madeira, pedra, ferro e diamante para cortar madeira.

Pedra e todos os minérios exigem a picareta adequada em ambos os modos. Mãos, machados e atalhos sem ferramenta não removem esses blocos nem recebem recursos; a mira informa a ferramenta necessária. Picaretas e machados antigos preservam seus IDs e agora são chamados de pedra. A mochila e o catálogo mostram todas as receitas.

## Casa equipada e encontros noturnos — 1.7.0

O campo de seed fica vazio por padrão: cada novo mundo sorteia uma seed, variando relevo, biomas, árvores e lago. Digitar uma seed reproduz aquele cenário. O gerador 3 mantém a clareira inicial nivelada com casa, churrasqueira em (-8, 9, -5), bancada, baú, carros e cachorros. Mundos salvos mantêm seu gerador e terreno; na primeira atualização, a churrasqueira só é adicionada à casa antiga se o espaço estiver vazio e nunca tiver sido editado. Remover a churrasqueira e salvar não a faz reaparecer.

Das 17h30 às 6h, surgem no máximo oito inimigos, fora da clareira inicial e em áreas carregadas. Eles perseguem o personagem com colisões locais e desaparecem ao amanhecer. Ceifador Rubro: camisa e boné vermelhos, barba e foice, 64 de vida; prepara o golpe por 0,65 s e causa 16 de dano com intervalo de 1,3 s. Espectro do Lodo: fantasma claro com brilho verde, 36 de vida; ao chegar perto prepara uma explosão por 1,5 s, causando 26 de dano e deixando ácido por 8 s (8 de dano por segundo). Derrotá-lo antes da explosão cancela o ataque.

Ataques e ácido respeitam paredes; não destroem construções. No criativo não causam dano ao personagem. Ferramentas e estilingue atingem inimigos e animais conforme o alvo mais próximo. Estado dos inimigos, preparação de ataques e tempo restante do ácido são preservados no salvamento. A IA usa perseguição e desvios locais, sem planejamento de rotas por grandes labirintos.

## Casa e companheiros — 1.8.0

A sala inicial tem sofá de dois módulos em (-11, 9, 0) e (-10, 9, 0), além da TV em (-10, 9, -4). E no sofá abre o descanso noturno: após três segundos, avança para 6h30, recupera energia e consome oito pontos de saciedade no Sobrevivência. É possível cancelar antes da conclusão; inimigos a menos de dez blocos impedem descansar. E na TV liga/desliga uma paisagem original desenhada no modelo; o estado permanece no salvamento. Os móveis também podem ser fabricados na bancada. Espaços alterados pelo jogador são preservados na atualização da casa.

Q no carro parado toca um assovio de duas notas e chama o cachorro domesticado mais próximo em até 18 blocos. Ele caminha até uma entrada livre e embarca no carro escolhido. Com passageiro, Q pede desembarque; fora do veículo também funciona a até seis blocos de um carro ocupado, sem precisar mirar no animal. O porta-malas tem um botão direto para desembarcar. O assovio não domestica animais, não embarca em movimento nem desembarca dentro de paredes. O comando de aproximação é cancelado se o carro começar a andar; assovie de novo após parar.

O Ceifador Rubro agora usa pernas articuladas pelo quadril, com botas presas às pernas e passos opostos proporcionais ao deslocamento. Para os passos durante o golpe ou ao encontrar obstáculos.

## Gatos e pequenos invasores — 1.9.0

Gatos domesticados caçam ratos, escorpiões, aranhas e cobras próximos enquanto seguem o jogador. Mire no gato e pressione E → **Proteger este local** para fixar uma área de proteção de 12 blocos. Ele retorna ao ponto escolhido depois de caçar; **Parar de proteger e seguir** retoma o acompanhamento. **Espere aqui** suspende a caça. Gatos embarcados ou com vida igual ou inferior a 25 não caçam; ofereça alimento para recuperar suas forças. A simulação local fica suspensa longe do jogador.

Ratos procuram comida na mochila e em baús próximos. No Sobrevivência, cada rato rouba uma unidade e tenta fugir; derrotá-lo devolve o alimento à mochila. Quando encontram uma parede de madeira, tábuas ou terra no caminho da comida, podem roer um bloco após cinco segundos. Cada rato abre no máximo um buraco, com intervalo global de dois minutos entre danos; pedra e tijolo resistem. Roubo, buracos e mordidas ficam desativados no Criativo.

Escorpiões, aranhas e cobras são raros e mordem por proximidade. A cada 45 segundos há uma tentativa de surgimento: 55% rato, 4% para cada outra espécie e 33% sem aparecimento. Existem no máximo seis invasores ativos (até quatro ratos e dois das demais espécies). Modelos são originais, feitos em código. Comida roubada, animais e local de proteção do gato persistem no salvamento. A navegação é local; paredes extensas podem impedir os ratos ou gatos de alcançar o alvo.

## Espaço entre companheiros — 1.9.1

Cachorros e gatos consideram o espaço ocupado pelos demais companheiros ao traçar rotas e caminhar. Desviam lateralmente ou aguardam quando não existe passagem livre. Animais já sobrepostos se afastam gradualmente, respeitando paredes, carros e o piso. A recuperação de companheiros distantes também procura um lugar livre. Passageiros e animais em andares distintos não se empurram.
