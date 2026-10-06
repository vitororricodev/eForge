# Validação — F Forjado

06/10/2026. Rotas reais do aplicativo em Chromium local, com dados de teste e HTTP externo interceptado. Nenhuma chamada chegou ao Supabase da conta real. A prévia completa do pacote não é usada como interface.

## Fidelidade e recursos

- Dez SVGs de produção foram comparados byte a byte com o ZIP fornecido: todos idênticos. Sem lettering por fonte, raster embutido, scripts, filtros ou degradês adicionados.
- PNGs foram renderizados a partir dos mestres, com formato/dimensões conferidos; não são extensões renomeadas.
- PWA: 192/512px para `any` e `maskable`, touch icon 180px e favicon 32px. ID/início/escopo/cores do manifesto preservados.
- Android: 26 PNGs existentes substituídos, nas mesmas dimensões — quinze launchers/foregrounds e onze splashs. Círculos seguros adaptativos e maskable verificados; XML dos recursos válido. `appId`, manifest e Gradle permanecem iguais.
- Relatório e hashes: [Assets](assets-resultado.json).

## Layout e ações

Quarenta conferências passaram nas rotas de boas-vindas, login, cadastro, recuperação/redefinição de senha, compartilhamento, início, relatórios, mapa, treino e offline; larguras 320/360/390/430px e mapa desktop 1440px.

SVG carregado e proporcional, alternativa acessível, ausência de cortes/rolagem horizontal/sombra no componente e espaço/alinhamento com ações do cabeçalho. Teko e a exceção do mapa permanecem. Links de início, conquistas, voltar e compartilhamento conservam destinos; abertura renderiza a assinatura/selo oficiais e permite pular. Compacto e assinatura final de treino conferidos. O fundo decorativo do AuthShell foi limitado ao eixo horizontal para eliminar transbordamento anterior em 320px.

[Resultado de layout](layout-resultado.json). A regressão existente `tests/workout-run-browser.mjs` também passou, incluindo séries, decimal, descanso/som, substituição, UUIDs, retomada offline, recuperação de exercícios, concorrência, finalização e mapa. [Log](browser.log).

## Cache e preservação de dados

Teste com o build mobile em modo produção, servido localmente, e service worker real:

- A versão anterior fica ativa enquanto a nova espera. O botão real de atualizar recusa reload durante treino ativo, mantendo o rascunho idêntico.
- Com estado finalizado/confirmado de teste, o botão ativa a versão nova e remove somente o cache público anterior `eforge-shell-v4`.
- SVGs oficiais presentes em `eforge-shell-v5-forjado`; sessão, rascunho, configuração local, IndexedDB e cache de outro namespace permanecem intactos.
- Fallback offline apresenta a nova marca do precache; nenhum dado privado/API entra no cache.

[Resultado de cache](cache-resultado.json) e [log](cache.log). O estado finalizado dessa conferência é uma fixture; o fluxo real de finalizar foi coberto pela regressão de treino. Nenhum dado da conta foi usado.

## Verificações executadas

- `npm test`: doze suítes passaram.
- `npm run typecheck`: passou.
- ESLint dos arquivos TypeScript/JavaScript alterados: zero erros; permanecem dois avisos anteriores, sobre constantes exportadas da intro e dependência `user` do efeito em MobileApp.
- `npm run build` e `npm run build:mobile`: passaram, com avisos anteriores de dependências/adaptador/tamanho de chunk.
- `npm run cap:sync -- android`: passou; recursos e web assets sincronizados localmente.

Logs correspondentes nesta pasta. Configuração pública fictícia usada nos builds; arquivos compilados/credenciais não acompanham o pacote de fonte.

## Capturas reais

- [Início, 390px](dashboard-mobile.png).
- [Login, 390px](login-mobile.png) e [login, 320px](login-320.png).
- [Cadastro, 390px](signup-mobile.png).
- [Boas-vindas, 390px](welcome-mobile.png).
- [Relatórios, 390px](reports-mobile.png).
- [Mapa, 390px](muscle-map-mobile.png), [320px](mapa-320.png) e [desktop](mapa-desktop.png).
- [Abertura animada](abertura-mobile.png).
- [Offline](offline-mobile.png) e [offline pelo cache em modo produção](offline-cached-mobile.png).

Os dados visíveis são de teste. Capturas de viewport mobile e conferência da versão compilada no navegador não equivalem a instalação física. Sem SDK Android, APK/AAB não foi compilado; não há projeto nativo iOS no pacote. Nada foi publicado em produção, lojas ou Git. Instalação física e atualização de ícones já instalados dependem do ambiente final.
