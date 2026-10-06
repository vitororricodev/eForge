# EFORGE — F Forjado

Proposta vetorial refinada a partir do conceito 01 aprovado. O contorno e o lettering foram reconstruídos; não se trata de extração automática idêntica à imagem conceitual.

## Arquivos
- eforge-icone-app.svg: ícone com cantos arredondados, 1024 × 1024.
- eforge-icone-maskable.svg: fundo completo e símbolo central com margem para máscaras.
- eforge-favicon.svg: versão compacta.
- eforge-logo-header.svg: símbolo roxo e nome branco; fundo transparente.
- eforge-logo-horizontal-*.svg: assinatura de uma cor, transparente.
- eforge-simbolo-*.svg: símbolo isolado, transparente.
- eforge-proposta.svg e .png: prancha de apresentação; não usar como logo no app.

## Implementação
Use a assinatura header em superfícies escuras e a versão preta em superfícies claras. Preserve a proporção pelo viewBox; não estique nem recorte. Para cabeçalho mobile, experimente largura de 160–190 px, conforme espaço disponível. O nome está convertido em caminhos, sem dependência de fontes. Os SVG de produção não incluem imagens raster ou scripts.

Cores: roxo #AE75F5; grafite #101015; branco #FFFFFF. Mantenha margem livre em torno do símbolo. Para manifestos PWA e lojas que exigem PNG, exporte os ícones nos tamanhos requeridos; o SVG é o arquivo mestre.

Foram consultadas as diretrizes locais de arquitetura e manutenção: preservação da aplicação e das funcionalidades existentes. Esta entrega contém somente ativos de identidade visual; nenhum código, fonte de texto do app ou implantação foi alterado.
