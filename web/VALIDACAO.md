# Validação — 28/09/2026

- Build de produção Next.js e checagem TypeScript concluídos.
- ESLint sem erros; quatro avisos existentes de imagens HTML em vez de next/image. As capas mantêm proporção reservada.
- Builds dos cinco jogos publicados concluídos. Circuito avisa sobre o tamanho do chunk Three.js; o carregamento continua sob demanda.
- Testes de lógica: O Robô e as Peças 18, Encaixe 10, Circuito 58, Vale dos Blocos 58. SDK: 3 testes de origem, comandos e descarte. Total: 147.
- 56 verificações HTTP locais aprovadas: páginas, CSS/JS, imagens, builds, cabeçalhos noindex dos jogos, sitemap/robots/llms e 404 do protótipo PAC-MAN retirado.
- Navegador: busca e filtro Puzzle, busca vazia de resultados, navegação para Encaixe, carregamento e fullscreen, movimento/pausa/reinício de O Robô e as Peças, carregamento 3D do Circuito e troca Rota → Vale sem carregar iframe antes de Jogar. Um único iframe durante a sessão.
- Página de privacidade mostra o e-mail informado; configuração padrão não insere scripts Google.
- Layout estreito conferido em viewport de 390×844; não equivale a aparelho de toque. Rotação e fullscreen de Android/iPhone reais continuam pendentes.
- Integração GA4 com uma propriedade real, aceitação/recusa/revogação em produção e AdSense dependem dos IDs e configurações do proprietário.

Produção não é validada por este relatório local. Após publicar na Hostinger, conferir a revisão implantada, SSL, assets, links e jogos no domínio definitivo.

## Jogabilidade arcade

Labirinto simétrico próprio 23×25, 224 itens (sucata e baterias), quatro perseguidores, movimento contínuo e três vidas. Os 12 testes incluem conectividade, túnel, curva antecipada, sobrecarga, colisões, progressão e equivalência entre taxas de quadros. No navegador, confirmados coleta automática, perda de vidas, fim de turno, pausa, reinício com três vidas e ausência de erros de console.

## Cabeça e áudio mecânico

Personagem e capa usam uma cabeça roxa e verde, adaptada das referências enviadas pelo proprietário. Seis testes de áudio cobrem ativação por gesto, reutilização do motor, conclusão dos efeitos, limite de vozes, silêncio, pausa, descarte e ativação concorrente. No navegador: personagem carregado, botão Som alternando corretamente e nenhum erro ou aviso no console. O caráter e volume dos efeitos devem ser avaliados pelo proprietário em seus alto-falantes e aparelhos.
