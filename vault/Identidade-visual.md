# Identidade visual — F Forjado

Atualização de 06/10/2026, autorizada pelo usuário para substituir símbolo e lettering. Os SVG do pacote `eforge-forjado-svg(1).zip` são os mestres oficiais, copiados sem edição para `public/brand/forjado/`. O lettering já está convertido em caminhos; não depende de fontes.

## Arquivos e aplicação

| Arquivo oficial | Uso |
| --- | --- |
| `eforge-logo-header.svg` | Assinatura com símbolo roxo e nome branco nos cabeçalhos e superfícies escuras. |
| `eforge-logo-horizontal-preto.svg` | Assinatura em superfícies claras; `Brand surface="light"`. |
| `eforge-simbolo-roxo.svg` | Símbolo isolado; `Brand compact` e selo da bigorna na abertura. |
| `eforge-icone-app.svg` | Mestre dos PNGs de instalação `purpose="any"` e launchers Android tradicionais. |
| `eforge-icone-maskable.svg` | Mestre dos PNGs `purpose="maskable"`, touch icon, ícone redondo e foreground adaptativo Android. |
| `eforge-favicon.svg` | Favicon vetorial; PNG de 32px como fallback. |
| Demais versões horizontal/símbolo branco, preto e roxo | Alternativas oficiais conservadas no mesmo diretório; não recolorir via CSS. |
| `eforge-proposta.svg` e `.png` | Referências em `docs/identidade/forjado/`; não importadas nem renderizadas na interface. |

Preserve caminhos, recortes, cores e viewBox. Não desenhe outro F, não substitua lettering por texto/fonte, não estique, recorte ou aplique efeitos à marca. Roxo `#AE75F5`, branco `#FFFFFF`, preto `#111115` e grafite `#101015` seguem os arquivos fornecidos; tokens da paleta geral do app permanecem iguais.

Teko 600/700 e sua aplicação atual continuam nos demais textos. A exceção de fonte de sistema no mapa muscular permanece. A antiga Forega foi retirada das regras de marca e do preload; seus arquivos antigos continuam apenas para compatibilidade com versões previamente carregadas.

## Componente e inventário

`Brand.tsx` centraliza a imagem e mantém `compact`. Default é superfície escura; a opção `surface="light"` seleciona o arquivo preto sem introduzir outro tema. Todas as imagens têm alternativa acessível “eForge”. A largura regular é 176px, limitada pelo espaço disponível; compacto tem 32px, abertura 190px e lateral do mapa 164px. Altura acompanha a proporção do SVG. Links e ações dos elementos que envolvem o componente não foram alterados.

Locais conferidos:

- `AuthShell`: login, cadastro, recuperação e redefinição de senha. A decoração do fundo é limitada horizontalmente com `overflow-x-clip`; a linha da marca tem 8px de espaço, evitando transbordamento em 320px sem cortar campos/foco vertical.
- Layout autenticado: cabeçalho comum e lateral desktop do mapa. Links continuam apontando para início e conquistas; navegação inferior e menu da Evolução são preservados.
- Execução de treino: símbolo compacto no cabeçalho e assinatura completa após finalizar.
- Boas-vindas e compartilhamento: componente existente e destinos dos links preservados.
- `ForgeIntro` e prévia da abertura: assinatura completa e selo vetorial fornecido na bigorna. Efeitos da ilustração ficam nos grupos de metal, sem sombra aplicada ao SVG da marca; duração, som, revelação e pular são mantidos.
- `offline.html`: assinatura oficial no lugar do título usado como marca, mantendo mensagem e botão existentes.
- Head web, `capacitor.html` e prévia: favicon/touch icon oficiais; carregamento e tipografia de conteúdo preservados.
- Manifesto, recursos Android e bitmaps de splash: nova marca nas exportações reais.

## PNGs, PWA e Android

`scripts/export-brand-assets.py` é um utilitário de desenvolvimento: usa CairoSVG e Pillow para exportar os mestres, sem dependência nova no aplicativo ou no npm. Os PNGs já acompanham o projeto. Para reproduzir: instale essas duas ferramentas no ambiente Python e execute `python3 scripts/export-brand-assets.py`.

PWA: PNGs de 192/512px com `purpose="any"` e outros de 192/512px com `purpose="maskable"`. Touch icon tem 180px e fundo completo do mestre maskable. Favicon PNG tem 32px. `id`, nome, escopo, início e cores do manifesto permanecem iguais, evitando mudar a identidade da instalação.

Android: recursos existentes em `android/app/src/main/res`, nas cinco densidades mdpi–xxxhdpi. Launchers tradicionais têm 48/72/96/144/192px. Foregrounds adaptativos têm 108/162/216/324/432px, mantendo os caminhos do mestre e adicionando apenas margem. A camada de fundo usa o grafite oficial; ícones redondos aplicam máscara somente fora do símbolo. As onze imagens de splash mantêm dimensões/orientações anteriores e fundo preto, com assinatura oficial centralizada. Manifest, appId, Gradle e temas não foram modificados.

O cálculo de margem considera o círculo seguro de 66dp no canvas Android de 108dp e o círculo de diâmetro 80% do mestre PWA. Referências: [Android](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive) e [Web App Manifest](https://www.w3.org/TR/appmanifest/#icon-masks).

`npm run build:mobile` e `npm run cap:sync -- android` foram executados localmente. Não há projeto nativo iOS neste pacote; a atualização para iOS cobre o touch icon da PWA. APK/AAB, lojas e instalação física não foram validados/publicados; o SDK Android não está disponível no ambiente desta entrega.

## Cache e dados locais

Arquivos novos usam `/brand/forjado/`, separados das URLs anteriores. O manifesto recebe versão na URL e o service worker passa a `eforge-shell-v5-forjado`, com precache dos SVG/PNGs e fallback offline. A limpeza de ativação continua restrita a caches `eforge-shell-*`; não acessa localStorage, IndexedDB, sessões ou treinos. Registro usa `updateViaCache: "none"`, conforme [MDN](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/updateViaCache).

O fluxo existente “Nova versão • Atualizar” permanece: não força atualização/reload durante treino ativo. Depois da atualização permitida, o cache da marca nova atende inclusive offline. URLs antigas de símbolo/favicon/ícones continuam válidas como aliases com a arte nova. A atualização do ícone já instalado também depende do ciclo de atualização do navegador/sistema; não instrua o usuário a apagar seus dados locais.

Validação e capturas reais: [F Forjado](../validation/forjado-20261006/README.md). Nenhum SQL, autenticação, regra de negócio, dado remoto, commit/push ou publicação foi alterado.

Relacionados: [[Arquitetura]], [[Treinos]], [[Muscle-Map]], [[Evolucao]], [[Manutencao]].
