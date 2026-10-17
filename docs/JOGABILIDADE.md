# Análise de jogabilidade e roteiro de funções (17/10/2026)

Objetivo: dar ao ValleyBlocks ritmo e objetivos de longo prazo, buscando **funções e sensações** de jogos de referência (Minecraft, Stardew Valley, Terraria, Animal Crossing), sem copiar código, arte, nomes ou textos de nenhum deles.

## Sobre "clonar" jogos

A skill REA (`D:\projetos\001 - SKILLS\rea-main`) faz engenharia reversa de binários e aplicativos. Não a usamos para extrair código, texturas ou modelos do Minecraft ou de outros jogos: isso violaria os termos de uso e direitos autorais desses jogos, e o resultado não poderia ir para a Play Store. Mecânicas de jogo (trocar com aldeões, ciclo dia e noite, encantar ferramentas) não são protegidas; implementamos as ideias do zero, com arte e nomes próprios. É o que foi feito com os vendedores da Tríplice Fronteira.

## O que o jogo já tem

Mundo procedural com nove terras por portais, mineração e construção, receitas na bancada e churrasqueira, durabilidade de ferramentas, Criativo e Sobrevivência com fome e fôlego, inimigos noturnos, pets que caçam e protegem, carros, barco, carretinha, pescaria, multiplayer na versão completa, controles de toque e aparências compráveis.

## O que falta: o "porquê continuar jogando"

| Lacuna | Sintoma | Referência de função |
| --- | --- | --- |
| Objetivos depois do primeiro capítulo | Os 4 objetivos iniciais acabam na primeira meia hora | Conquistas e "livro de missões" (Stardew, Minecraft) |
| Economia | Minérios raros só servem para ferramentas | Trocas com aldeões (Minecraft), lojas (Stardew) |
| Gente no mundo | Terras bonitas, mas vazias de quem converse | Aldeias com moradores e pedidos |
| Progressão de equipamento | Picareta de diamante é o fim | Armaduras, encantamentos, melhorias na bigorna |
| Motivo para viajar entre terras | Cada terra é visitada uma vez | Itens e pedidos exclusivos de cada terra |
| Construção com propósito | Construir não muda nada no jogo | Moradores que se mudam quando há casa (Terraria) |

## Roteiro proposto, em ordem

1. **Vendedores e esmeraldas (feito nesta etapa).** Três bancas em Ciudad del Este (ferragens, comidas, importados), troca por esmeralda, estoque que se renova a cada 4 minutos e fica salvo no mundo. Modelo do vendedor feito no Blender (`game/assets/blender/create_vendor.py`).
2. **Livro de missões.** Pedidos curtos por terra, com recompensa em esmeraldas: "Leve 5 tilápias para a Doña Rosa", "Encontre a ossada do Sertão", "Atravesse a Ponte da Amizade de carro". Reaproveita `this.goals` e o painel "Seu primeiro capítulo".
3. **Um morador por terra.** Mesma base do vendedor, com ofertas temáticas: vaqueiro no Sertão (couro, carne de sol), garimpeiro em Minas (pedras preciosas), pescador no Rio (iscas, vara melhor), monge na China, guia no Grand Canyon. Cada um entrega uma missão e vende algo que só existe ali.
4. **Armaduras.** Capacete, peitoral, calça e bota em couro, ferro e diamante, que reduzem dano dos inimigos noturnos. Modeladas no Blender no mesmo formato das aparências; desgaste como nas ferramentas.
5. **Vila própria.** Ao construir uma casa com porta, cama (sofá) e tocha, um morador se muda para o Vale e abre banca ali. Dá sentido à construção.
6. **Melhorias de ferramenta na churrasqueira/bigorna.** Gastar esmeraldas e minérios raros (rubi, topázio, urânio) para "Eficiência" e "Durabilidade". Dá destino aos minérios das terras.
7. **Conquistas e diário.** Lista de descobertas (todas as terras, todos os peixes, todos os bichos), com recompensas cosméticas. Bom gancho para a Play Store.

## Personagens e mundos: direção visual

- Moradores com silhueta clara a 20 blocos de distância: chapéu ou acessório marcante por terra, cor de camisa variada, bandeja ou ferramenta na mão.
- Mesmo estilo voxel do jogo, só caixas e cores chapadas, sem texturas fotográficas.
- Cada terra com uma "assinatura" sonora e uma criatura que só vive ali (já existe para os inimigos; falta para os moradores).

## Antes da Play Store

- Validar em Android real (pendente desde 16/10).
- Ícone e splash do app, capturas de tela e arte de destaque (1024x500).
- Classificação etária (IARC): violência leve e fantasiosa, sem sangue.
- Política de privacidade publicada no domínio do jogo.
- Decidir se a compra dentro do app usa o Google Play Billing (obrigatório para bens digitais vendidos no app).
