# Planejamento — ValleyBlocks

## Decisão registrada em 29/09/2026: multiplayer pago, para uma etapa futura

O proprietário do projeto decidiu adiar a implementação do multiplayer e registrar a proposta para retomá-la depois.

### Requisitos confirmados

- Permitir jogar com amigos, visitar vilas e participar de construções compartilhadas.
- O acesso multiplayer será pago.
- Após o pagamento, a pessoa terá uma **licença permanente** para jogar com seus amigos.
- Haverá restrições de uso, a definir antes da implementação e da oferta comercial.
- Nesta etapa, registrar o planejamento; não implementar multiplayer, cobrança ou ativação de licenças.

### Decisões ainda abertas

- Preço e forma de pagamento.
- Se todos os participantes precisarão de licença ou se a licença do anfitrião permitirá convidados.
- Quantidade de amigos simultâneos, mundos/vilas e limites de armazenamento por licença.
- Permissões de visitantes e membros: construir, minerar, acessar baús e conduzir veículos.
- Disponibilidade da vila quando o proprietário estiver desconectado.
- Infraestrutura, custos de operação, backups e política de retenção de mundos.
- Regras de recuperação de conta e uso da licença em dispositivos diferentes.

A meta de até oito jogadores mencionada na análise anterior é uma proposta técnica sujeita a testes; não é um limite comercial aprovado. A licença permanente está confirmada, mas não foram definidos recursos ilimitados nem condições de hospedagem dos mundos.

### Direção técnica proposta para quando o trabalho for retomado

- Manter o cliente Three.js integrado ao portal LABSGames e conectar a um servidor autoritativo, responsável pelas regras e pelo estado compartilhado.
- Separar apresentação, núcleo de simulação, comunicação de rede e persistência. Node.js com Colyseus e PostgreSQL foram sugeridos, sem contratação ou instalação nesta etapa.
- Associar a licença a uma identidade persistente. Confirmar o pagamento no servidor e registrar a concessão de acesso de forma que uma notificação repetida não duplique a compra.
- Validar licença, convite e permissões no servidor ao entrar em um mundo e ao executar ações; uma configuração no navegador não concede acesso pago.
- Salvar mundo, entidades, inventários por jogador/mundo, permissões e alterações de terreno. Prever reconexão e backups.
- Sincronizar apenas regiões e entidades relevantes para cada jogador. Calcular areia, água e física compartilhada no servidor.
- Adaptar pausa e reinício: abrir um menu não pausa os outros participantes; reiniciar o cliente não apaga a vila compartilhada.
- Versionar os saves, o gerador e os identificadores dos materiais para preservar construções existentes.

## Melhorias de jogabilidade implementadas na versão 1.1.0 — 29/09/2026

Estas melhorias do modo individual foram implementadas separadamente da futura comercialização do multiplayer:

- Personagem voxel original, com aparência própria, primeira pessoa e câmeras de frente e de costas.
- Mãos e ferramenta equipada visíveis, incluindo picareta.
- Gravidade para areia sem apoio, inclusive queda dentro da água.
- Reproduzir e corrigir os desníveis/degraus observados ao escavar o fundo sob a água, verificando geometria, fluxo e colisões.
- Corrigir a natação: o usuário esclareceu que **o personagem não afunda**. Comportamento combinado: afundar gradualmente sem nadar, Espaço para subir/sair pela margem e Ctrl para mergulhar mais rápido.
- Balde para coletar e transportar água, despejar no mundo e abastecer/retirar água de uma forja. A forja produz um lingote com ferro, carvão e água de resfriamento.
- Mais minérios, com nomes e propriedades próprios.
- Novos biomas na geração de mapas, com espaço para vilas e esculturas, preservando mundos anteriores por versionamento do gerador.

O multiplayer e a cobrança continuam adiados. O roteiro e as evidências dos recursos individuais estão em `../TESTES.md` e nos relatórios desta pasta.
