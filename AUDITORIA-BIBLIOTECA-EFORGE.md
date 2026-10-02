# Auditoria e entrega — biblioteca própria eForge

Data: 02/10/2026. Base do projeto: `origin/main`, commit `c0d7b8b`, com as melhorias locais anteriores de gestão reaproveitadas. O código está no branch local `feat/owned-gif-library`. Não houve commit, push, deploy, execução de SQL remoto ou acesso administrativo ao Supabase nesta entrega.

## Resultado e alcance da validação

A nova biblioteca funciona no código com importador próprio, Storage, registros `source='eforge'`, consultas paginadas e administração. A API de exercícios e o tradutor externo foram retirados do fluxo operacional. Arte/semana/pesos do mapa e fluxos de treino existentes permanecem intactos. A troca no banco é explícita e só ocorre depois da importação validada do manifesto completo.

| Medida                                                              | Resultado desta entrega                                                                |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Arquivos reais fornecidos e validados localmente                    | 611 GIFs, caminhos/tamanhos/assinaturas/SHA-256 corretos                               |
| Duplicatas do manifesto                                             | 14 aliases, sem segundo registro do mesmo conteúdo                                     |
| Importação de metadados pela RPC em PostgreSQL local                | 611 criados; repetição preserva identidade/edições/exclusões                           |
| Objetos de Storage na suíte PostgreSQL                              | 611 linhas de metadados simuladas, com políticas/RLS testadas                          |
| Teste de navegador do importador                                    | 3 GIFs reais em ZIP de teste; upload/RPC interceptados, categoria e repetição testadas |
| Exercício antigo sem referências no teste crítico                   | 1 removido fisicamente                                                                 |
| Exercício antigo utilizado em treino/sessão/séries no teste crítico | 1 arquivado; IDs, snapshot e histórico preservados                                     |
| Imports/uploads/limpezas executados no seu Supabase nesta entrega   | 0 ações remotas                                                                        |
| Quantidades reais já existentes no seu Supabase                     | Não consultadas; obtenha pelo relatório do painel após aplicar/importar/ativar         |

Não são 611 uploads reais no seu Storage. A validação local com PGlite não reproduz rede, limites do plano ou a API física de Storage do seu projeto. O teste de navegador também não altera sua conta. Isso é identificado nos relatórios e nas capturas; não se apresenta uma fixture como dado de produção.

## Auditoria antes da alteração

Foram lidos os documentos `.md` do projeto, README, documentos fornecidos de arquitetura/frontend/design/UX/validação, migrations, schema, componentes, hooks, políticas e snapshots. Não havia Vault técnico nem `AGENTS.md` no projeto: foi criado o Vault da nova biblioteca. A solicitação nova substitui as antigas instruções de configuração externa; os documentos de instalação anteriores foram movidos para `docs/LEGADO/`.

Diretrizes aplicadas: manter React/TanStack/Supabase/Capacitor, reutilizar componentes e campos, cache por usuário, RLS no servidor, cores existentes e áreas de toque, preservar fontes da aplicação e a exceção de fonte do mapa aprovada anteriormente. A biblioteca não foi recriada em outro framework. Os números da interface vêm de consultas/manifesto, não de constantes ilustrativas.

## Onde a integração antiga estava conectada

| Ponto                                                                                | Ligação anterior                                              | Tratamento                                                                                                   |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `supabase/functions/sync-exercisedb/index.ts`                                        | Endpoint de sincronização administrativa                      | Removido do código                                                                                           |
| `supabase/functions/_shared/sync-handler.ts`                                         | Orquestração de páginas/leases/resultados                     | Removido                                                                                                     |
| `supabase/functions/_shared/exercisedb.ts`                                           | Cliente HTTP, parsing, nomes/músculos e normalização da fonte | Removido; sem chamada a catálogo externo no runtime                                                          |
| `supabase/functions/translate-exercises/index.ts` e `_shared/catalog-translation.ts` | Tradução por Google Cloud na melhoria anterior                | Retirados desta versão; limpeza enumerada para cópias antigas                                                |
| `_shared/catalog-labels.ts`                                                          | Dicionário de rótulos usado por UI/integração                 | Dicionário genérico local passou a `src/lib/catalog-vocabulary.ts`; dependência da pasta de funções removida |
| `scripts/sync-exercisedb.mjs` / script npm                                           | Acionar sincronização                                         | Removidos; novos scripts `catalog:import` e `catalog:prepare`                                                |
| `ExerciseSyncPanel`, `ExerciseTranslationPanel`, `MuscleMappingPanel`                | Importação/tradução/mapeamentos da fonte                      | Retirados; painel próprio e gestão da biblioteca                                                             |
| `/admin/exercises`                                                                   | Painéis antigos e instruções de licença                       | Agora `OwnedGifImportPanel` e `CatalogManager`                                                               |
| `use-exercise-catalog.ts` / `/exercises`                                             | Catálogo paginado no Supabase com registros externos          | RPC nova preserva consumidores; após ativação, origem externa sai de buscas/facetas                          |
| Montagem/substituição e sugestões do mapa                                            | Mesmo hook de catálogo                                        | Preservados; consomem biblioteca própria sem mudança de framework ou rota                                    |
| Formulário/detalhes                                                                  | Classificação original, traduções, atribuição                 | Edição própria com anatomia/confiança; compatibilidade somente para registros históricos                     |
| Migrations `20261002120000`/`20261002121000`/`20261002180000`                        | Source, jobs, índices, RLS e snapshots anteriores             | Histórico preservado; funções operacionais revogadas na troca                                                |
| `exercise_sync_runs`, `exercise_translation_runs`, mapeamentos antigos               | Estado da integração                                          | Mantidos como dados históricos, jobs em execução cancelados na troca; não são usados pelo importador próprio |
| Configuração Supabase                                                                | Declaração de Edge Function de catálogo                       | Removida; importação própria usa RPC/Storage autenticados                                                    |
| `.env.example`                                                                       | Configuração pública do projeto                               | Somente URL/chave pública Supabase; nenhuma variável externa é necessária                                    |
| Testes e documentação de integração                                                  | Casos específicos de API/sync/tradução                        | Testes substituídos; documentos históricos em LEGADO                                                         |

A busca global foi feita nos fontes, scripts, configuração, testes, migrations e documentos. Restam referências ao nome da origem antiga somente em tipos/labels históricos, regras de transição, migrations, testes de preservação, lista de limpeza e documentação histórica. Não há cliente HTTP do catálogo, invocação operacional de `sync-exercisedb`/`translate-exercises` ou Secrets dessas integrações no frontend.

As funções/Secrets/jobs que possam existir remotamente não foram consultados nem excluídos. A ativação revoga as RPCs antigas; o guia inclui a remoção dos deployments e uma verificação de jobs remotos depois da troca. Não se declara que a instalação remota já foi desvinculada.

## Dados e campos

| Campo/estrutura                                                                          | Decisão          | Uso final                                                                                                |
| ---------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------- |
| `exercises`                                                                              | REUTILIZAR       | Uma tabela para oficial/próprio/histórico                                                                |
| `source`, `user_id`, `visibility`                                                        | REUTILIZAR       | `eforge` oficial, `user` personalizado; valor legado preservado nos arquivados                           |
| `nome`, `name_original`, `name_pt_br`, `slug`                                            | REUTILIZAR       | Nomes do CSV, revisão manual, identidade única; não se afirma tradução de nomes que já estavam em inglês |
| `gif_url`                                                                                | REUTILIZAR       | URL pública do objeto oficial, mídia pessoal existente                                                   |
| `gif_path`, `gif_sha256`                                                                 | ADICIONAR        | Identidade física/deduplicação/validação/imutabilidade                                                   |
| `musculo_principal`, `musculos_primarios`, `musculos_secundarios`, `musculos_terciarios` | REUTILIZAR       | Chaves do manifesto; terciários inicialmente vazios                                                      |
| `unmapped_muscles`                                                                       | REUTILIZAR       | Anatomia sem região específica do avatar                                                                 |
| `musculo_principal_anatomico`, `classification_confidence`                               | ADICIONAR        | Separar anatomia real, região visual e confiança fornecida                                               |
| `classification_reviewed`, `review_status`, `active`                                     | REUTILIZAR       | Revisão humana, disponibilidade e inativação                                                             |
| `partes_corpo`, `partes_corpo_pt_br`                                                     | REUTILIZAR       | Categoria de pasta e rótulo português                                                                    |
| `categoria`, `tipo_controle`                                                             | REUTILIZAR       | Modalidade e registro de séries; defaults técnicos até conferência, pois não constam do CSV              |
| `equipamentos`, `instrucoes`, `instrucoes_pt_br`, `descricao`, `observacoes`             | REUTILIZAR       | Campos existentes; vazios quando ausentes; notas do manifesto preservadas                                |
| `external_data`                                                                          | REUTILIZAR       | Proveniência própria: entrada original estruturada, aliases, notas e bytes                               |
| `external_id`, `external_snapshot`, `last_synced_at`                                     | PRESERVAR LEGADO | Novos registros não dependem desses campos; não é seguro removê-los de dados históricos nesta troca      |
| `catalog_overrides`                                                                      | PRESERVAR LEGADO | Compatibilidade com edições anteriores; reimportação própria já preserva todas as edições                |
| `catalog_deleted_at`                                                                     | REUTILIZAR       | Exclusão reversível/arquivamento sem destruir FKs                                                        |
| `created_at`, `updated_at`                                                               | REUTILIZAR       | Timestamps e trigger existentes                                                                          |
| `owned_catalog_state`                                                                    | ADICIONAR        | Uma linha de estado/auditoria da troca, sem tabela paralela de exercícios                                |
| Índices/constraints de origem anteriores                                                 | PRESERVAR        | Ainda válidos para registros históricos e exercícios pessoais                                            |

O bucket `exercise-media` foi reutilizado por compatibilidade. A estrutura de categorias/subcategorias foi preservada sob o prefixo `official/`; o hash completo é acrescentado ao nome para imutabilidade. Nenhum GIF vira blob/base64 no PostgreSQL.

## Categorias

| Chave       | Nome               |    GIFs |
| ----------- | ------------------ | ------: |
| abdomen     | Abdômen            |      66 |
| biceps      | Bíceps             |      73 |
| costas      | Costas             |      76 |
| deltoides   | Deltoides          |      43 |
| inferiores  | Membros inferiores |     187 |
| panturrilha | Panturrilha        |      20 |
| peitoral    | Peitoral           |     100 |
| triceps     | Tríceps            |      46 |
| **Total**   |                    | **611** |

## Classificação por primário do avatar

| Chave               | Registros |
| ------------------- | --------: |
| abs                 |        51 |
| biceps              |        58 |
| calves              |        23 |
| chest               |        90 |
| forearms            |        16 |
| glutes              |        51 |
| hamstrings          |        38 |
| lats                |        59 |
| lower_back          |         3 |
| obliques            |        15 |
| quads               |        85 |
| rear_delts          |        15 |
| shoulders           |        41 |
| traps               |        11 |
| triceps             |        46 |
| Sem região primária |         9 |
| **Total**           |   **611** |

O relatório fornecido em `catalog/relatorio_classificacao_muscular.md` lista também a distribuição anatômica real: 45 glúteos e seis glúteo médio/mínimo; 39 deltoides e dois manguito rotador, por exemplo. A tabela acima mantém as aproximações **já fornecidas**, sem inventar novas chaves.

## Revisões

Confiança: 578 alta, 33 média, zero baixa no pacote original. Existem 57 exercícios com informação de músculos sem região no avatar; nove não possuem chave primária representável. O manifesto contém nomes/aliases ambíguos, preservados como proveniência; um arquivo igual não prova que seus nomes descrevem o mesmo movimento.

Os 33 itens de confiança média estão listados nominalmente no [relatório original](catalog/relatorio_classificacao_muscular.md). Incluem as flexões de quadril/abs, remadas altas, rotações do manguito, Clean, pullovers e nomes pouco específicos. Esse relatório acompanha o pacote sem alteração de classificação.

Todos os importados começam com `classification_reviewed=false`: a classificação fornecida não foi validada por uma pessoa nesta entrega, e modalidade/tipo de controle ainda precisam ser conferidos. Não são automaticamente bloqueados do catálogo, porque o usuário solicitou oficial/público/ativo por padrão. O formulário permite confirmar a revisão; o relatório do banco traz a lista atualizada de itens ainda pendentes. Não foram inventados equipamentos, instruções, terciários nem recuperação fisiológica.

## Segurança, histórico e limpeza

Usuário comum não chama administração/importação/ativação. As RPCs verificam `is_catalog_admin()`; consultas do catálogo respeitam RLS como invoker. O admin não vê exercícios privados de terceiros. Prefixos pessoais do Storage preservam as regras existentes; prefixo oficial é administrável, imutável e protegido contra exclusão se referenciado. O bucket já público continua público.

A migration de retirada define a operação; **aplicar schema não apaga o catálogo**. A ação explícita recebe todos os hashes do manifesto e valida registros/Storage antes de limpar. Remove apenas oficiais antigos sem FK em `workout_exercises`/`set_logs`; os utilizados ficam inativos/arquivados, conservando IDs, nomes, mídia e músculos. Logs/sessões/snapshots não são apagados ou refeitos. Jobs antigos são cancelados e RPCs de sync/tradução revogadas, inclusive para service role. Um trigger bloqueia sua reintrodução.

Não houve remoção de pacotes npm exclusivos do catálogo antigo: ele usava HTTP/SDK já compartilhados. A única dependência de produção acrescentada nesta troca é `fflate@0.8.3`, carregada sob demanda para ZIP. Supabase/React/TanStack continuam existentes. Tipos e histórico do schema não foram apagados indiscriminadamente.

Arquivos antigos retirados ou enumerados para limpeza de instalações anteriores estão em `ARQUIVOS-LEGADOS.json`; o helper PowerShell faz backup fora do projeto, não altera banco, Secrets, Git ou produção. PowerShell não estava instalado no ambiente Linux de validação; esse helper não foi executado no Windows. A extração completa em pasta nova já elimina os arquivos antigos do pacote.

## Banco e migrations

No teste local, as migrations existentes foram aplicadas em ordem e as novas verificadas em PostgreSQL/PGlite. No seu banco remoto, **nenhuma migration foi executada** nesta entrega.

| Versão         | Papel                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| 20261002180000 | Gestão anterior reutilizada, necessária apenas se ainda pendente; histórico do schema preservado     |
| 20261002200000 | Campos de GIF/anatomia/confiança, índices, políticas, estado, importação, consultas e gestão própria |
| 20261002201000 | Relatório e substituição explícita do catálogo antigo com preservação de referências                 |

`maintenance/20261002200000_owned_gif_library_manual.sql` contém os mesmos corpos das três migrations, com transação, pré-requisitos e guards de aplicação/histórico. O teste compara esses corpos e verifica instalação pendente, repetição, aplicação manual completa sem registro e recusa de schema parcial. Não se mascara o problema antigo de `source already exists` com um `ALTER` cego.

## Testes e capturas

Os resultados finais dos comandos e as capturas estão registrados abaixo. A interface usa componentes reais; não é uma imagem de prévia como página. Capturas são da rota real com sessão/HTTP de teste. No navegador foram verificadas seleção/troca de vistas/nomes/lista/limpeza/links do mapa; biblioteca/paginação/filtros/criação própria/montagem/substituição/série concluída/admin/ZIP/importação/ativação/edição/inativação/exclusões/restauração/erros. Viewports da biblioteca: 360, 375, 390, 412, 430, 768 e 1440 px; do mapa: 320, 390, 430, 768 e 1440 px.

| Verificação                                  | Resultado real                                                                                                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm test                                     | PASSOU — oito suítes; 611 imports de metadados, RLS, snapshots, semana, importador/ZIP e SQL manual                                                                    |
| npm run typecheck                            | PASSOU                                                                                                                                                                 |
| npm run build                                | PASSOU — build web TanStack/Nitro                                                                                                                                      |
| npm run build:mobile                         | PASSOU — bundle Capacitor; não é APK/IPA nem teste em celular físico                                                                                                   |
| ESLint direcionado                           | PASSOU — 25 fontes/scripts novos ou alterados; dois testes antigos também passaram com a regra de formatação preexistente desabilitada                                 |
| npm run lint global                          | NÃO PASSOU — 1.084 erros e 25 avisos preexistentes; principalmente formatação, mesma contagem da verificação anterior. Não foi feita reformatação geral fora do escopo |
| Teste do navegador da biblioteca             | PASSOU — importação ZIP/categoria/idempotência, gestão, filtros, treinos, admin negado, recuperação e sem overflow                                                     |
| Teste do navegador do mapa                   | PASSOU — clique/teclado/vistas/nomes/lista/limpeza/links/vazio/erro/sem overflow                                                                                       |
| Leitor ZIP com o arquivo real completo       | PASSOU — 611 extraídos sequencialmente e SHA-256 conferidos, zero erros                                                                                                |
| catalog:import --dry-run, manifesto completo | PASSOU — 611/611 arquivos locais, zero erros                                                                                                                           |
| catalog:prepare + dry-run de um GIF novo     | PASSOU — manifesto sem músculos inventados e hash validado                                                                                                             |
| Decodificação dos arquivos GIF fornecidos    | PASSOU — 611 abertos; prancha.gif tem um único frame, preservado                                                                                                       |
| git diff --check                             | PASSOU                                                                                                                                                                 |

Avisos dos builds: chunk mobile acima de 500 kB e advertência do adaptador existente sobre configuração Wrangler sobrescrita. Não impediram o build. Não houve erro novo de tipo, lint direcionado, teste ou build.

Capturas e arquivos de verificação: [validation/README.md](validation/README.md). As telas mobile e desktop foram inspecionadas: arquivo/categoria/ações legíveis, seleção funcional, avatar inteiro, destaque preservando a textura e sem rolagem horizontal. A navegação fixa tem espaço reservado ao final do conteúdo; a lista permite rolar até todos os controles. Capturas não equivalem a validação em aparelho físico.

## Arquivos alterados e removidos

A lista abaixo compara o código entregue com a base Git indicada, incluindo arquivos novos; código retirado de uma melhoria local anterior também consta do manifesto de limpeza. Arquivos de build, dependências instaladas, configuração privada e ZIP original de GIFs não compõem o código-fonte entregue.

| Arquivo                                                          | Situação | Mudança / motivo                                                                                |
| ---------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `.gitignore`                                                     | Alterado | Ignorar relatórios administrativos locais e manifesto novo de trabalho.                         |
| `ARQUIVOS-LEGADOS.json`                                          | Novo     | Lista exata para limpeza de arquivos de versões anteriores ao aplicar por cópia.                |
| `ATUALIZACAO-AVATAR-SEMANAL.md`                                  | Alterado | Relacionar a biblioteca própria e registrar preservação da semana e pesos.                      |
| `ATUALIZACAO-MAPA-MOBILE.md`                                     | Alterado | Documentar novo endpoint compartilhado sem alterar a arte/interação.                            |
| `AUDITORIA-BIBLIOTECA-EFORGE.md`                                 | Novo     | Auditoria, resultados reais, limitações e lista de alterações.                                  |
| `BIBLIOTECA-EFORGE.md`                                           | Novo     | Instalação incremental, importação, dados, segurança, manutenção e limpeza remota.              |
| `INTEGRACAO-EXERCISEDB.md`                                       | Removido | Retirar código/teste/documento da integração antiga; compatibilidade de dados preservada.       |
| `README-eForge.md`                                               | Alterado | Instalação atual e biblioteca própria; retirar instruções operacionais antigas.                 |
| `catalog/manifest.json`                                          | Novo     | Representação JSON equivalente das 611 entradas e aliases.                                      |
| `catalog/manifest_gifs_categorizados.csv`                        | Novo     | Manifesto original classificado recebido, 625 linhas/611 únicos.                                |
| `catalog/relatorio_classificacao_muscular.md`                    | Novo     | Relatório fornecido, distribuição anatômica e lista dos 33 casos médios.                        |
| `docs/LEGADO/20261002180000_catalog_management_manual.sql`       | Novo     | Documento histórico movido para LEGADO, sem orientar a configuração atual.                      |
| `docs/LEGADO/ATUALIZACAO-CATALOGO-PT-BR.md`                      | Novo     | Documento histórico movido para LEGADO, sem orientar a configuração atual.                      |
| `docs/LEGADO/INTEGRACAO-EXERCISEDB.md`                           | Novo     | Documento histórico movido para LEGADO, sem orientar a configuração atual.                      |
| `maintenance/20261002200000_owned_gif_library_manual.sql`        | Novo     | Aplicar somente etapas pendentes com pré-requisitos e histórico.                                |
| `package-lock.json`                                              | Alterado | Fixar fflate 0.8.3 no lockfile.                                                                 |
| `package.json`                                                   | Alterado | Comandos/testes próprios e dependência ZIP; retirar sincronização externa.                      |
| `scripts/import-owned-gifs.mjs`                                  | Novo     | CLI idempotente com sessão admin, categorias, dry-run e relatório.                              |
| `scripts/lib/owned-modules.mjs`                                  | Novo     | Reutilizar a mesma implementação TypeScript no CLI/testes.                                      |
| `scripts/prepare-owned-gifs.mjs`                                 | Novo     | Gerar manifesto para novos GIFs sem inferir músculos.                                           |
| `scripts/remove-legacy-catalog.ps1`                              | Novo     | Backup e retirada local de caminhos enumerados de instalações antigas.                          |
| `scripts/sync-exercisedb.mjs`                                    | Removido | Retirar código/teste/documento da integração antiga; compatibilidade de dados preservada.       |
| `src/components/exercises/CatalogControls.tsx`                   | Alterado | Filtros de categoria própria, primário/secundário, origem e visibilidade.                       |
| `src/components/exercises/CatalogManager.tsx`                    | Novo     | Busca/página/seleção/lote/exclusão/restauração/ativar/inativar/revisão.                         |
| `src/components/exercises/ExerciseDetails.tsx`                   | Alterado | Mostrar classificação anatômica/confiança/informação sem região e preservar detalhes.           |
| `src/components/exercises/ExerciseFormDialog.tsx`                | Alterado | Edição própria com categoria/anatomia/confiança; permitir primário sem região e proteger mídia. |
| `src/components/exercises/ExerciseMedia.tsx`                     | Alterado | Fallback honesto sem grupo fictício quando não há região primária.                              |
| `src/components/exercises/ExerciseSyncPanel.tsx`                 | Removido | Retirar código/teste/documento da integração antiga; compatibilidade de dados preservada.       |
| `src/components/exercises/MuscleMappingPanel.tsx`                | Removido | Retirar código/teste/documento da integração antiga; compatibilidade de dados preservada.       |
| `src/components/exercises/OwnedGifImportPanel.tsx`               | Novo     | Importação CSV/JSON e ZIP/pasta, categorias, progresso, relatórios e troca explícita.           |
| `src/components/exercises/catalog.css`                           | Alterado | Layout responsivo, controles, foco, nomes de arquivo em português e safe scroll.                |
| `src/hooks/use-exercise-catalog.ts`                              | Alterado | RPC nova e filtros adicionais, mesmo hook/cache para todos os consumidores.                     |
| `src/integrations/supabase/types.ts`                             | Alterado | Tipos de campos, estado e RPCs próprias; compatibilidade de schema histórico.                   |
| `src/lib/catalog-vocabulary.ts`                                  | Novo     | Rótulos locais compartilhados sem importar código de Edge Function antiga.                      |
| `src/lib/exercise-labels.ts`                                     | Alterado | Rótulos de categorias próprias e vocabulário local.                                             |
| `src/lib/exercise-types.ts`                                      | Alterado | Schema de leitura dos campos próprios e filtros adicionais.                                     |
| `src/lib/owned-gif-import.ts`                                    | Novo     | Motor de inspeção/upload/cadastro, continuação por arquivo e retomada.                          |
| `src/lib/owned-gif-manifest.ts`                                  | Novo     | CSV/JSON, classificação fornecida, aliases, validação, identidade e hash.                       |
| `src/lib/owned-gif-supabase.ts`                                  | Novo     | Adaptador autenticado para RPC/Storage sem service role.                                        |
| `src/lib/owned-gif-zip.ts`                                       | Novo     | Diretório central e descompressão de apenas um GIF selecionado por vez.                         |
| `src/routes/_authenticated/admin.exercises.tsx`                  | Alterado | Integrar painéis próprios e retirar sincronização/tradução/mapeamentos antigos.                 |
| `src/routes/_authenticated/exercises.tsx`                        | Alterado | Gestão própria e labels oficiais; preservar criação/adição/rota.                                |
| `supabase/config.toml`                                           | Alterado | Projeto correto e retirada da declaração de função antiga.                                      |
| `supabase/functions/_shared/exercisedb.ts`                       | Removido | Retirar código/teste/documento da integração antiga; compatibilidade de dados preservada.       |
| `supabase/functions/_shared/sync-handler.ts`                     | Removido | Retirar código/teste/documento da integração antiga; compatibilidade de dados preservada.       |
| `supabase/functions/sync-exercisedb/index.ts`                    | Removido | Retirar código/teste/documento da integração antiga; compatibilidade de dados preservada.       |
| `supabase/migrations/20261002180000_catalog_management.sql`      | Novo     | Migration da melhoria anterior reutilizada como histórico/passo de schema pendente.             |
| `supabase/migrations/20261002200000_owned_gif_library.sql`       | Novo     | Identidade, RPCs paginadas/importação/gestão, índices, estado e políticas.                      |
| `supabase/migrations/20261002201000_retire_external_catalog.sql` | Novo     | Relatório, validação, troca com referências preservadas e revogação do sync/tradutor.           |
| `tests/database.mjs`                                             | Alterado | Ajuste mínimo do mock de Storage (metadata), mantendo testes existentes.                        |
| `tests/exercisedb-browser.mjs`                                   | Removido | Retirar código/teste/documento da integração antiga; compatibilidade de dados preservada.       |
| `tests/exercisedb-database.mjs`                                  | Removido | Retirar código/teste/documento da integração antiga; compatibilidade de dados preservada.       |
| `tests/exercisedb.mjs`                                           | Removido | Retirar código/teste/documento da integração antiga; compatibilidade de dados preservada.       |
| `tests/helpers/exercisedb.mjs`                                   | Removido | Retirar código/teste/documento da integração antiga; compatibilidade de dados preservada.       |
| `tests/helpers/owned-database.mjs`                               | Novo     | Cobertura da biblioteca própria, permissões, erro/repetição, histórico e/ou UI.                 |
| `tests/muscle-map-browser.mjs`                                   | Alterado | Atualizar somente endpoint de busca no teste existente do mapa.                                 |
| `tests/owned-gif-browser.mjs`                                    | Novo     | Cobertura da biblioteca própria, permissões, erro/repetição, histórico e/ou UI.                 |
| `tests/owned-gif-database.mjs`                                   | Novo     | Cobertura da biblioteca própria, permissões, erro/repetição, histórico e/ou UI.                 |
| `tests/owned-gif-library.mjs`                                    | Novo     | Cobertura da biblioteca própria, permissões, erro/repetição, histórico e/ou UI.                 |
| `tests/owned-gif-manual.mjs`                                     | Novo     | Cobertura da biblioteca própria, permissões, erro/repetição, histórico e/ou UI.                 |
| `validation/README.md`                                           | Novo     | Evidência local e instruções dos dados de teste; não altera o runtime.                          |
| `validation/biblioteca-desktop.png`                              | Novo     | Evidência local e instruções dos dados de teste; não altera o runtime.                          |
| `validation/biblioteca-mobile.png`                               | Novo     | Evidência local e instruções dos dados de teste; não altera o runtime.                          |
| `validation/gerenciar-desktop.png`                               | Novo     | Evidência local e instruções dos dados de teste; não altera o runtime.                          |
| `validation/gerenciar-mobile.png`                                | Novo     | Evidência local e instruções dos dados de teste; não altera o runtime.                          |
| `validation/importar-mobile.png`                                 | Novo     | Evidência local e instruções dos dados de teste; não altera o runtime.                          |
| `validation/mapa-desktop.png`                                    | Novo     | Evidência local e instruções dos dados de teste; não altera o runtime.                          |
| `validation/mapa-mobile.png`                                     | Novo     | Evidência local e instruções dos dados de teste; não altera o runtime.                          |
| `validation/verificacao-arquivos.json`                           | Novo     | Evidência local e instruções dos dados de teste; não altera o runtime.                          |
| `validation/verificacao-imagens.json`                            | Novo     | Evidência local e instruções dos dados de teste; não altera o runtime.                          |
| `validation/verificacao-zip.json`                                | Novo     | Evidência local e instruções dos dados de teste; não altera o runtime.                          |
| `vault/Arquitetura.md`                                           | Novo     | Documentação navegável de arquitetura/dados/operação/mapa, criada para esta atualização.        |
| `vault/Banco-e-acesso.md`                                        | Novo     | Documentação navegável de arquitetura/dados/operação/mapa, criada para esta atualização.        |
| `vault/Biblioteca.md`                                            | Novo     | Documentação navegável de arquitetura/dados/operação/mapa, criada para esta atualização.        |
| `vault/Manutencao.md`                                            | Novo     | Documentação navegável de arquitetura/dados/operação/mapa, criada para esta atualização.        |
| `vault/Muscle-Map.md`                                            | Novo     | Documentação navegável de arquitetura/dados/operação/mapa, criada para esta atualização.        |
| `vault/README.md`                                                | Novo     | Documentação navegável de arquitetura/dados/operação/mapa, criada para esta atualização.        |
