# eForge — treino mobile e destaque muscular

Atualização de 03/10/2026, sobre `origin/main` no commit `17d71b8`, em cópia de trabalho isolada. Código aplicado ao projeto; nenhuma publicação, push ou alteração no Supabase remoto foi executada.

## Alterações

- Avatar geométrico antigo removido da execução `/run/$workoutId`, incluindo sua consulta desnecessária ao sexo do perfil.
- Resumo com tempo, séries feitas/total, volume e progresso calculados do rascunho; sem números ilustrativos fixados no aplicativo.
- Cartões de exercícios com carga/repetições e conclusão de série em primeiro plano. Tipo, remoção, adição, substituição e histórico continuam disponíveis; histórico recolhido fica depois das séries.
- Descanso em minutos/segundos, com botões separados de −15s, +15s e pular. Continua usando o horário final e mantém vibração/som quando suportados.
- Campos/conclusão de 48px e demais ações com pelo menos 44px, foco visível, descrições acessíveis, títulos legíveis e espaço reservado para rodapé/safe area.
- Mapa anatômico: primários treinados em roxo forte, secundários em roxo suave; seleção em ciano, preservando o preenchimento treinado. O contorno selecionado é um path SVG separado que não intercepta os toques.
- Lista alternativa e detalhes informam o papel semanal. Se um músculo participou como primário e secundário, aparece com o papel primário. Aliases e IDs de séries não duplicam a contribuição. Todos os primários fornecidos são respeitados.
- Arte WebP, máscaras, texturas, frente/costas, ambos no desktop, nomes, limpeza, links e integração com a biblioteca própria permanecem.

Os papéis vêm de `musculos_primarios`, `musculo_principal` como fallback e `musculos_secundarios` nos snapshots reais. Terciários novos continuam vazios; registros legados ainda são preservados e aparecem discretamente apenas quando presentes. Os pesos 1/0,55/0,25 não foram alterados. A intensidade visual indica o papel do exercício, não ativação fisiológica, recuperação ou volume.

Semana local: segunda-feira 00:00 até a próxima segunda, exclusiva. Aquecimentos não contam no mapa; rascunhos finalizados e ainda pendentes só complementam dados do mesmo usuário/semana. Histórico e IDs são mantidos.

## Diretrizes e arquitetura

Foram consultados os documentos README/Vault/mapa/semana/biblioteca/hotfixes e os documentos fornecidos architect-review, frontend-developer, design-system-architect, ui-designer, ui-ux-designer e ui-visual-validator. Nenhum AGENTS.md foi encontrado. A nova instrução de seleção em outra cor substitui a convenção roxa anterior.

React 19, TanStack Start/Router/Query, Supabase, Vite, Capacitor, Button, Input e ExercisePicker foram reutilizados. O CSS da execução é restrito a `workout-run`; Teko/Forega e a exceção de fonte de sistema do mapa são preservados. Os detalhes do fluxo e das cores estão em `vault/Treinos.md` e `vault/Muscle-Map.md`.

O commit recebido continha 11 arquivos obsoletos da sincronização ExerciseDB enumerados em `ARQUIVOS-LEGADOS.json`. Eles causavam falha nos testes e erros de tipo em ExerciseSyncPanel. Foi aplicada somente a lista de remoção já prevista na entrega da biblioteca, com backup fora da cópia de trabalho. Migrations e dados históricos não foram removidos. O novo importador próprio não foi alterado.

## Aplicar ao seu projeto

**Estes ajustes não exigem SQL, migration, reimportação de GIFs nem deploy de Edge Function.** Continue usando o banco e a biblioteca já instalados. O código usa seus campos existentes.

1. Extraia o projeto completo e aplique os arquivos preservando seu Git e .env local. Não copie node_modules, dist ou arquivos de build antigos.
2. Se copiar sobre uma versão anterior, execute `scripts/remove-legacy-catalog.ps1` para mover apenas os caminhos obsoletos listados para um backup fora do projeto. Extração em pasta nova já vem sem eles.
3. Execute `npm ci`, `npm test`, `npm run typecheck` e `npm run build`. Para Capacitor, execute também `npm run build:mobile`.
4. Abra seu ambiente de desenvolvimento e confira a execução de treino e `/muscle-map` na sua conta.

Os documentos de banco no pacote completo são da biblioteca anterior. Não rode SQL novamente para atualizar somente este layout.

## Validação

Os builds `npm run build` (web) e `npm run build:mobile` (Capacitor) passaram. Permanecem os avisos do adaptador Cloudflare e do tamanho de bundle mobile; nenhum impede o build. Não foi compilado/publicado APK ou IPA.

| Verificação                                        | Resultado                                                                                                                                                            |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                         | Oito suítes passaram, incluindo isolamento, snapshots, semana, papéis, biblioteca própria e PostgreSQL local                                                         |
| `npm run typecheck`                                | Passou após retirar os arquivos obsoletos previstos                                                                                                                  |
| ESLint dos cinco arquivos TypeScript/TSX alterados | Passou, sem avisos                                                                                                                                                   |
| Navegador: execução de treino                      | Passou edição/decimal, concluir/desfazer, descanso, adicionar/remover, tipo/histórico, som, offline/retomada, UUIDs, substituição, finalização e navegação para mapa |
| Navegador: mapa                                    | Passou papéis/intensidades, preservação da cor treinada ao selecionar, teclado, nomes, vistas, ambos, lista, limpeza, links/filtro, vazio, erro e retry              |
| Layout                                             | 320, 360, 390, 430, 768 e 1440px na execução; 320, 390, 430, 768 e 1440px no mapa; sem rolagem horizontal                                                            |
| Toque/rodapé                                       | Ações verificadas com pelo menos 44px; último controle pode ser rolado acima do rodapé                                                                               |
| Lint global                                        | Continua com dívida anterior: 930 erros e 21 avisos fora dos arquivos alterados; não foi declarado como aprovado                                                     |

Os testes de navegador usam rotas/componentes reais no Chromium, com autenticação e HTTP fictícios isolados no teste. Nenhuma requisição chegou à sua conta Supabase. Capturas são evidência do layout com fixtures, não dos números do seu banco. [Capturas atuais](validation/treino-mapa/README.md).

Para repetir os testes de navegador, instale Playwright e Chromium no ambiente de desenvolvimento, inicie o servidor local na porta 5173 e execute `node tests/muscle-map-browser.mjs` e `node tests/workout-run-browser.mjs`. `TEST_BASE_URL` aceita somente URL local; `TEST_SCREENSHOTS` muda a pasta de saída.

## Limites

Não houve validação em aparelho físico ou com dados da sua sessão real. Vibração, som, teclado e suspensão dependem do navegador/dispositivo. A arte anatômica continua ilustrativa, com os mesmos 15 grupos do app. As alterações precisam ser aplicadas ao seu checkout para aparecer no aplicativo publicado. Nenhuma produção foi publicada nesta entrega.
