# Configuração de lançamento

Domínio canônico: https://labsgames.cloud
Contato padrão: app.boyago@gmail.com. Alterável com CONTACT_EMAIL no ambiente de build/servidor.

## Métricas e consentimento
Sem NEXT_PUBLIC_GA_MEASUREMENT_ID, nenhum script de métricas é carregado e não aparece um banner sem finalidade. Para habilitar, configurar um ID real G-... na Hostinger antes do build e reconstruir. No GA4, desativar medição aprimorada (incluindo mudanças de histórico) para evitar duplicação e coleta além dos eventos descritos, configurar retenção e revisar a política.

O visitante pode recusar ou permitir com botões equivalentes, e mudar de ideia em /privacidade. O script só carrega após aceite. São enviados page_view com origem+caminho, game_started, game_completed e game_error com slug. Não enviamos recordes, buscas ou mensagens. Rejeitar limpa cookies _ga e recarrega a página caso o script já esteja ativo. A preferência fica no navegador em labs-privacy-v1.

Validar em perfil limpo: sem escolha/recusa não deve haver chamadas a Google Analytics; aceite permite chamadas; revogação deve interrompê-las. A configuração real e o fluxo de coleta com uma propriedade Google ainda dependem do ID da conta.

## Search Console
Verificar propriedade por DNS (preferível para domínio) ou definir GOOGLE_SITE_VERIFICATION com o conteúdo do token HTML antes do build. Enviar https://labsgames.cloud/sitemap.xml. O token não é fornecido pelo código nem criado automaticamente.

## Publicidade
lib/ads.ts centraliza enabled, mode, partner e adsense. Todos os espaços atuais são placeholders. Banners próprios em mode: partner exigem image, alt e href. Use arte 970×250 (o espaço reserva essa proporção); não adicionar pixels rastreadores sem revisão de consentimento.

mode: adsense somente reserva a posição e os identificadores: não instala o anúncio real. Para ativação: conta/site aprovados, direitos dos ativos revisados, IDs reais, integração do script oficial, controle de consentimento exigido para público/região e atualização dos avisos. Obter ads.txt da própria conta, sem inventar publisher ID. O consentimento de métricas atual não autoriza anúncios personalizados.

## Build e publicação
1. Em cada jogo disponível: npm ci, testes disponíveis, npm run build.
2. Em site: npm ci (o postinstall gera o build) ou npm run build após atualizar fontes.
3. npm start usa PORT (padrão 3000); conferir páginas, CSS/JS, iframes, /sitemap.xml, /robots.txt e /llms.txt.
4. Commit de games guarda fontes e modelos; commit do site inclui catálogo e builds públicos. Somente o repositório site está conectado ao GitHub/Hostinger.
5. Push/deploy é separado de commit. Conferir a revisão implantada no painel.

Na hospedagem, sem ../games, a sincronização usa os builds versionados. Na máquina de criação, build ausente falha explicitamente. Builds antigos de um jogo são substituídos e jogos removidos do catálogo deixam de ser copiados/servidos. O protótipo PAC-MAN permanece apenas nas fontes arquivadas.

## Verificações manuais pendentes
Testar toque, áudio, rotação, saída e retomada em Android e iPhone físicos. Confirmar licenças dos modelos de Circuito. Conferir retenção real dos logs da Hostinger e textos operacionais de privacidade. Não há cadastro, upload público, pagamentos ou anúncios de rede ativos.
