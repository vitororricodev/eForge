# Compartilhamento, organização e perfil — 03/10/2026

Capturas das rotas reais, sem imagem de mockup como interface. Chromium em 390×844, 320×740 e 1440×1050; Teko e Forega existentes. A suíte de compartilhamento usa PostgreSQL local (PGlite), as migrations reais e sessões isoladas de duas contas. Todas as requisições externas são interceptadas no teste; nenhum dado remoto foi lido ou alterado. Nomes, números e GIF de teste não representam a conta de produção.

## Resultado

- `npm test`: onze suítes aprovadas, incluindo RLS, anônimo/dono/destinatário, snapshot, autorização, substituições inválidas, retry idempotente, cópia independente, edição sem perda de itens, UUIDs estáveis, ordem salva e perfil/upsert/sexo.
- SQL manual: mesmo corpo da migration, backfill conserva a ordem anterior, normalização do sexo conserva timestamp, registro único de versão, repetição segura e rejeição de estrutura parcial.
- `npm run typecheck`: aprovado.
- `npm run build` e `npm run build:mobile`: aprovados. Avisos anteriores do adaptador Cloudflare e tamanho do bundle mobile permanecem; não houve publicação.
- ESLint nos arquivos TS/TSX alterados: **zero erros**; quatro avisos anteriores de hooks/Fast Refresh. `eslint .` global continua com **444 erros e 15 avisos**, fora da alteração funcional desta entrega, principalmente formatação/tipagem histórica. Não é apresentado como lint global aprovado.
- `tests/workout-sharing-browser.mjs`: aprovado; resultado em [resultado.json](resultado.json), sem erros de página. Inclui toque real via eventos de navegador, mouse, teclado, foco, rolagem ao arrastar nas bordas da página e do editor, cancelamento do gesto, cancelar/editar/salvar/recarregar, copiar link com clipboard, prévia anônima, preservação do destino ao alternar login/cadastro, login com retorno, seletor do catálogo, troca apenas do indisponível, falha/retry com mesmo pedido, revogação e perfil com vírgula/IMC/erro/save/reload.
- Seleção muscular, trocar vistas, nomes, limpar, lista acessível e links para exercícios passaram novamente em `tests/muscle-map-browser.mjs`. Execução/descanso/séries/substituição/offline/snapshots/finalização passaram em `tests/workout-run-browser.mjs`, com ausência do avatar antigo e alvos de pelo menos 44px.

## Capturas

- [Treinos no celular](treinos-mobile.png)
- [Organizar treinos no celular](organizar-treinos-mobile.png)
- [Organizar treinos no desktop](organizar-treinos-desktop.png)
- [Editor de exercícios no celular](editar-exercicios-mobile.png)
- [Editor em celular de 320px](editar-exercicios-320.png)
- [Arrastar exercícios no desktop](editar-exercicios-desktop.png)
- [Criar e copiar link](compartilhar-mobile.png)
- [Prévia do link sem login](link-publico-mobile.png)
- [Prévia no desktop](link-publico-desktop.png)
- [Cópia com substituição seletiva](copiar-substituicao-mobile.png)
- [Perfil e cálculo durante edição](perfil-imc-mobile.png)
- [Evolução com ícones](evolucao-mobile.png)
- [Link revogado](link-revogado-desktop.png)
- [Mapa com treinados/seleção preservados](regressao-mapa/mobile-treinados.png)
- [Execução mobile preservada](regressao-treino/treino-mobile.png)

O GIF mínimo do fixture confirma que o URL carregou; a captura desse card não demonstra sua biblioteca real de GIFs. O segundo fixture não tem GIF e utiliza o placeholder existente de `ExerciseMedia`. Não foram introduzidos GIFs de outra biblioteca no projeto.

## Reproduzir

Instale Playwright/Chromium no ambiente de validação e rode o servidor local (`npm run dev -- --port 5173 --strictPort`). Com o mesmo `.env` público do aplicativo, execute os três testes separados abaixo. O interceptador recusa chamadas externas e os testes só aceitam servidor em `localhost` ou `127.0.0.1`.

```sh
node tests/workout-sharing-browser.mjs
node tests/muscle-map-browser.mjs
node tests/workout-run-browser.mjs
```

`TEST_BASE_URL` permite outra porta local; `TEST_SCREENSHOTS` permite outro diretório de capturas. `TEST_CHROMIUM_MODULE` é opcional para o binário de Chromium do ambiente de teste; `TEST_TEKO_FONT` permite servir a fonte local no fixture, sem depender da rede. O teste de compartilhamento remove `--single-process` quando utiliza o binário alternativo, para manter os contextos de contas efetivamente isolados.

Pendente no ambiente real: aplicação manual do SQL, verificação com suas contas/GIFs, Google/e-mail, instalação Android/iOS e compartilhamento nativo do dispositivo. As páginas e os controles com sessão/banco local foram exercitados; os testes não configuram fornecedores externos nem publicam o aplicativo.
