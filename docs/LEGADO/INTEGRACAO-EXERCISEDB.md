# LEGADO — documento histórico

Esta integração foi substituída pela biblioteca própria eForge. Não use estes passos para uma instalação ou atualização atual. Consulte [Biblioteca oficial eForge](../../BIBLIOTECA-EFORGE.md). Este conteúdo permanece apenas para entender versões anteriores do banco.

---

# eForge — integração ExerciseDB

Implementação de 02/10/2026 sobre o commit `c2ea499` do eForge. Código e validação locais; sem alteração do Supabase remoto, importação de produção ou publicação do site.

## Diagnóstico e decisões

O projeto usa React 19, TanStack Start/Router, TanStack Query, Vite, Tailwind, Radix/shadcn, Zod, Supabase Auth/PostgreSQL/Storage e Capacitor. A biblioteca já existe em `/exercises`; não foi criado um catálogo paralelo. `exercises`, `workout_exercises`, `workout_sessions` e `set_logs` continuam usando os mesmos IDs e relações.

Os exercícios existentes têm nome, mídia, categoria, controle, músculo principal, secundários e terciários, proprietário e visibilidade. Antes desta mudança, biblioteca, montagem, substituição e sugestões do mapa carregavam o catálogo inteiro. Agora usam consulta paginada no banco. Relatórios consultam somente a contagem.

A execução marca séries no rascunho local isolado por usuário. O mapa ao vivo reage a cada marcação. `save_workout_snapshot` salva a sessão e as séries em uma transação com UUIDs estáveis. O mapa semanal considera séries concluídas de sessões concluídas e exclui aquecimento. O reset visual continua na segunda-feira às 00:00 no fuso do dispositivo; o histórico não é apagado. Os pesos permanecem principal 1, secundário 0,55 e terciário 0,25.

`user_roles` já possui `admin` e `user`. Foi reutilizado para proteger a administração. A função existente `has_role` está revogada para clientes; a nova `is_catalog_admin` verifica somente a identidade autenticada, sem aceitar IDs arbitrários.

A importação usa uma Supabase Edge Function, acessível também pelo aplicativo Capacitor. Assim, não depende de um servidor TanStack acessível pelo navegador nativo. Nenhuma dependência de UI ou tradução foi adicionada. O SDK da função é fixado em 2.116.0, a mesma versão resolvida no lockfile atual.

## Fonte e contrato oficial

Documentação: <https://oss.exercisedb.dev/docs#tag/exercises>. Contrato OpenAPI: <https://oss.exercisedb.dev/swagger>, versão 1.0.0, consultado em 02/10/2026.

`GET https://oss.exercisedb.dev/api/v1/exercises?limit=25&after=CURSOR` retorna `success`, `data` e `meta`, com `hasNextPage`, `total` e `nextCursor`. Paginação por cursor, limite máximo 25. O importador segue esse contrato; não usa exemplos antigos de paginação por offset.

Cada exercício fornece `exerciseId`, `name`, `gifUrl`, `bodyParts`, `equipments`, `targetMuscles`, `secondaryMuscles` e `instructions`.

**Regra confirmada pelo usuário:** `targetMuscles` são principais; `secondaryMuscles` são secundários. Os importados não recebem músculos terciários. Terciários já definidos em exercícios personalizados ou em revisões internas permanecem preservados.

A API não fornece dificuldade, descrição, categoria operacional, tipo de controle nem tradução brasileira. Dificuldade/descrição/tradução ficam ausentes. Novos importados usam `funcional` e `repeticoes` somente como padrões técnicos exigidos pelos enums legados, com `classification_reviewed=false` e indicação “Categoria a revisar”. Isso não é informação atribuída à ExerciseDB. Um administrador pode conferir categoria e controle. Séries/repetições iniciais ao adicionar ao treino seguem os padrões já usados no app, editáveis na montagem.

**Condição de uso:** a documentação da API gratuita restringe o catálogo e a mídia a projetos não comerciais e exige atribuição à AscendAPI. Um produto monetizado precisa de acesso contratado e adaptação ao contrato permitido. Não basta alterar a variável de ambiente para autorizar uso comercial. O importador permanece desabilitado até `EXERCISEDB_USAGE_MODE=non-commercial` ser configurado para um projeto que cumpra os termos. A biblioteca e os detalhes mostram atribuição. Nenhum catálogo ou GIF foi baixado em massa para o Storage.

## Fluxo

1. Administrador inicia em `/admin/exercises` ou pelo CLI.
2. A Edge Function verifica o Bearer token via `auth.getUser` e consulta a permissão `admin` no banco.
3. `begin_exercise_sync` cria ou retoma uma execução única; não gera várias importações simultâneas.
4. Cada chamada `step` obtém uma reserva de página por até dois minutos, busca até 25 registros e valida a resposta.
5. A normalização preserva IDs/nomes originais, traduz apenas identificadores musculares para as chaves do eForge e deixa ausências explícitas.
6. `apply_exercise_sync_page` importa o lote e atualiza cursor, contadores e histórico na mesma transação.
7. O navegador/CLI espera dois segundos entre páginas. A tela pode pausar e retomar; fechar a tela interrompe novos pedidos, mantendo o checkpoint.
8. Exercícios publicados são consultados exclusivamente no Supabase. Não há chamada à API nem tradução durante consultas normais.

Timeout de 12 segundos por tentativa; até três tentativas para falhas de rede, 429 e 5xx transitórios. `Retry-After` é respeitado até 30 segundos; limites maiores interrompem a página para retomada posterior. 401/403/404 e outras falhas permanentes não são repetidas automaticamente. Respostas inválidas não são aplicadas. Itens inválidos em uma página válida são contabilizados como erros; os demais são importados. O histórico guarda até 100 mensagens resumidas, com contagem total de erros.

Reservas vencidas podem ser recuperadas após queda da função. Repetir uma página já confirmada não incrementa os contadores. Cursores repetidos/cíclicos e importações acima de 1.000 páginas são interrompidos como proteção. “Encerrar importação” libera a execução quando não há página em processamento; registros já importados permanecem.

## Banco e migrations

Aplicar em ordem, após todas as migrations existentes:

- `supabase/migrations/20261002120000_exercisedb_catalog.sql`
- `supabase/migrations/20261002121000_catalog_training_snapshot.sql`

As alterações são aditivas, com backfill dos músculos principais existentes. Não removem tabelas, exercícios, sessões ou séries. O proprietário aceita `NULL` somente para registros oficiais, conforme constraint de origem; exercícios de usuários continuam exigindo proprietário.

| Área                       | Alterações                                                                                                                                                                                                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exercises`                | `source`, `external_id`, `name_original`, `name_pt_br`, `slug`, `descricao`, `equipamentos`, `partes_corpo`, `instrucoes`, `instrucoes_pt_br`, `dificuldade`, `musculos_primarios`, `active`, `review_status`, `classification_reviewed`, `unmapped_muscles`, `external_data`, `external_snapshot`, `catalog_overrides`, `last_synced_at` |
| Busca                      | `muscle_keys` e `search_vector` gerados no banco; índices GIN para busca, músculos, equipamento e parte do corpo; índice para ordenação/paginação                                                                                                                                                                                         |
| Identidade                 | Unique `(source, external_id)`; constraint mantém exercícios de usuários independentes dos oficiais                                                                                                                                                                                                                                       |
| `set_logs`                 | `musculos_primarios` preserva todos os alvos principais em snapshots concluídos                                                                                                                                                                                                                                                           |
| `exercise_muscle_mappings` | Nome externo, chaves do avatar, status, justificativa e timestamp; leitura/escrita administrativa                                                                                                                                                                                                                                         |
| `exercise_sync_runs`       | Iniciador, estado, cursor/checkpoints, reserva de página, totais, novos/atualizados/ignorados/erros, datas e mensagens; clientes administrativos podem ler, não forjar resultados                                                                                                                                                         |

Os tipos em `src/integrations/supabase/types.ts` foram atualizados para o schema. Após aplicar no projeto real, pode regenerar com `supabase gen types typescript --linked` e conferir os mesmos campos/RPCs antes de substituir o arquivo.

## Segurança e personalizações

- Usuários comuns podem ver exercícios oficiais aprovados, os próprios privados e os públicos da comunidade. Exercícios privados de outro usuário não são expostos nem pelo painel administrativo.
- Usuários comuns não podem inserir uma origem oficial, mudar a origem de um registro próprio para oficial, nem editar/excluir um oficial. A proteção está em RLS e constraints, além da UI.
- Administradores podem revisar exercícios oficiais e mapeamentos. Não há ação de exclusão de oficiais; inativar preserva referências e histórico.
- Um oficial inativo aprovado continua legível para referências existentes, permitindo finalizar/sincronizar um treino já montado. Novas consultas do catálogo e a ação de adicionar exigem ativo/aprovado.
- `verify_jwt=false` na configuração da Edge Function permite validação manual consistente; não significa endpoint sem autenticação. O handler exige Bearer válido e consulta a permissão administrativa antes de qualquer operação privilegiada.
- A service role existe somente na Edge Function. O CLI usa uma sessão de administrador, nunca service role. Não criar variáveis `VITE_` com segredos.
- Os RPCs de sincronização só têm execução concedida à service role. Consultas e montagem usam segurança do usuário e RLS.
- Sincronização compara exclusivamente `(source='exercisedb', external_id)`. Não identifica por nome nem modifica exercícios `user`/`eforge`.
- Edições administrativas de campos externos são registradas em `catalog_overrides` pelo banco. Sincronizações posteriores respeitam essas escolhas. Tradução, descrição, notas, categoria, controle, dificuldade, mídia interna e terciários não são substituídos cegamente.
- A desativação explícita e a seleção muscular revisada são preservadas. `external_data`/`external_snapshot` continuam registrando o contrato externo mais recente para manutenção.

## Mapeamento muscular

Chaves reais do eForge: `chest`, `abs`, `obliques`, `shoulders`, `biceps`, `forearms`, `quads`, `calves`, `traps`, `lats`, `lower_back`, `glutes`, `hamstrings`, `triceps`, `rear_delts`.

Correspondências iniciais: `pectorals→chest`, `abdominals→abs`, `deltoids→shoulders`, `rear deltoids→rear_delts`, `quadriceps/quads→quads`, `latissimus dorsi/lats→lats`, `trapezius/traps→traps`, `soleus/calves→calves`; os demais nomes exatos compatíveis seguem a mesma chave.

Termos como `hip flexors`, `erector spinae`, `upper back`, `rhomboids`, `core`, `adductors`, `cardiovascular system` e regiões não presentes no avatar não são associados por suposição. O registro fica pendente e inativo, e o termo aparece na administração. Um administrador pode documentar uma correspondência correta ou marcar “Sem região correspondente no avatar”. Uma marcação sem região conserva o dado original e omite o grupo do mapa; se todos os principais ficarem sem representação, o exercício ainda exige aprovação manual. Não se fabrica anatomia para preencher o avatar.

Todos os músculos-alvo conhecidos permanecem em `musculos_primarios`; o primeiro também ocupa `musculo_principal` para compatibilidade. Principais não são reclassificados como secundários. Repetições e interseções são removidas, dando prioridade ao papel principal. Os importados recebem terciários vazios. A mesma informação acompanha biblioteca, seleção no treino, rascunho, snapshot e mapa.

Se uma atualização externa introduzir músculos desconhecidos em um exercício já publicado, a versão publicada é preservada para não impedir a conclusão de treinos existentes. Os termos novos e o payload mais recente ficam na revisão administrativa. Depois de resolver o mapeamento e sincronizar, os campos externos válidos são aplicados, respeitando overrides. A revisão mostra os dados atuais da fonte diretamente do Supabase.

Mudar um mapeamento não altera silenciosamente sessões passadas. Uma nova sincronização aplica a correspondência ao catálogo; logs históricos preservam o snapshot muscular do treino. Revisões internas explícitas não são sobrescritas.

## Interface e componentes

- `/exercises`: pesquisa por nome original/localizado, paginação de 20, filtros por músculo, grupo, equipamento, parte do corpo, origem, categoria e controle; cards com mídia/fallback, detalhes e adicionar a um treino.
- A pesquisa do banco usa tokens com prefixos e normalização de acentos; não é busca fuzzy/por erro de digitação.
- `/admin/exercises`: importação, pausa/retomada, resumo real e últimas execuções, mapeamento e lista paginada de revisões.
- `ExercisePicker`: consulta paginada reutilizada na montagem e substituição, sem carregar a biblioteca inteira.
- `ExerciseFormDialog`: preserva cadastro privado/público e mídia; inclui descrição, equipamento e instruções. Revisão oficial só para administrador, com tradução preparada e seleção dos principais adicionais.
- `ExerciseDetails`/`AddToWorkoutDialog`: dados musculares, etapas, autoria e adição transacional ao treino. Repetir adicionar não duplica o exercício naquele treino.
- `ExerciseMedia`: lazy loading, URL HTTPS e fallback quando GIF não existe/falha; miniatura muscular é ilustrativa, não demonstração da execução.
- `CatalogControls`/`CatalogPagination`: filtros compactos, controles de toque, estados claros e páginas.
- `useExerciseCatalog`, `useCatalogFacets`, `useCatalogAdmin`: TanStack Query com cache isolado por usuário.
- `MuscleMapScreen`: notifica a seleção para consultar apenas três sugestões do músculo escolhido. Arte anatômica, controles, cores e semana permanecem.
- CSS restrito à biblioteca corrige a regra global que limitava toda `main` a 480px no desktop e o padding global que fazia a lupa sobrepor o texto da busca. Fonte Teko Bold permanece; Forega fica na marca.

## Endpoints e RPCs

| Operação                                                | Acesso / uso                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `POST /functions/v1/sync-exercisedb` `{action:"start"}` | Sessão administrativa; cria/retoma execução                                                    |
| Mesmo endpoint `{action:"step",runId}`                  | Sessão administrativa; processa uma página com checkpoint                                      |
| Mesmo endpoint `{action:"cancel",runId}`                | Sessão administrativa; encerra execução sem apagar catálogo                                    |
| `search_exercises`                                      | Autenticado/RLS; busca/filtros/página; modo revisão exige admin                                |
| `exercise_catalog_facets`                               | Autenticado/RLS; equipamentos/partes existentes e acessíveis                                   |
| `add_exercise_to_workout`                               | Autenticado; dono do treino, exercício acessível/ativo/aprovado, evita duplicação              |
| `begin/claim/apply/release/cancel_exercise_sync`        | Exclusivamente service role, utilizados pela Edge Function                                     |
| `save_workout_snapshot`                                 | Existente, atualizado para transportar todos os principais; transacional e isolado por usuário |

## Instalação no seu ambiente

1. Extraia o pacote; preserve sua configuração pública `.env` atual do mesmo projeto Supabase. O pacote não contém segredos, dependências instaladas nem metadados Git.
2. Rode `npm ci`.
3. Teste com `npm test`, `npm run typecheck`, `npm run build` e `npm run build:mobile`.
4. Em um projeto de desenvolvimento Supabase, revise e aplique as migrations. Com CLI instalado/autenticado:

```bash
supabase link --project-ref SEU_PROJECT_REF
supabase db push --dry-run
supabase db push
supabase functions deploy sync-exercisedb
```

Esses comandos são instruções para a instalação, não foram executados no projeto remoto nesta entrega. Revise o `project_id` de `supabase/config.toml` ao vincular; não crie outro banco para o frontend.

5. Se o projeto cumprir os termos não comerciais da API gratuita:

```bash
supabase secrets set EXERCISEDB_USAGE_MODE=non-commercial
```

Supabase injeta `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` na função. Essas chaves não precisam ser colocadas no frontend. Para desenvolvimento da função: `supabase functions serve sync-exercisedb --env-file ARQUIVO_LOCAL_DE_SEGREDOS`; não versionar o arquivo.

6. Atribua `admin` a uma conta existente, por uma operação confiável no SQL Editor. Nunca oferecer autoatribuição no app:

```sql
INSERT INTO public.user_roles(user_id, role)
VALUES ('UUID_DA_CONTA_ADMIN'::uuid, 'admin')
ON CONFLICT(user_id, role) DO NOTHING;
```

7. Entre nessa conta; na biblioteca abra “Gerenciar biblioteca oficial”, sincronize e revise pendências. Para uso normal, somente a URL e a chave pública do Supabase são necessárias.

Variáveis opcionais do CLI: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `EFORGE_ADMIN_ACCESS_TOKEN` (sessão administrativa ainda válida) e `EFORGE_SYNC_MAX_PAGES` (1–1000, padrão 1000). Com elas definidas no ambiente seguro, rode `npm run exercisedb:sync`. Se houver falha ou pausa, executar novamente retoma o checkpoint. Não cole tokens na documentação ou em commits. Não há agendamento automático nesta versão.

## Verificação e evidência

- `npm test`: testes existentes e novas suites de contrato/normalização/endpoint e PostgreSQL local PGlite.
- Novos testes exercitam payloads inválidos, timeouts, backoff/429, vários principais, ausência de terciários/dificuldade/tradução, desconhecidos, autenticação administrativa e condição de uso.
- Banco local executa todas as migrations e confirma privacidade com duas contas e administrador, público, rejeição de origem forjada, RPC restrito, exclusão/edição oficial negadas, importação idempotente, checkpoints/reservas, preservação de overrides/tradução/terciários/inativação, pesquisa/paginação e conclusão do exercício oficial sem duplicação de séries.
- Testes do mapa conferem pesos, vários principais, exclusão de aquecimento, contagens, isolamento e virada semanal.
- Playwright: biblioteca real, busca/filtros/páginas/detalhes, criação manual, adicionar ao treino, seleção e substituição paginadas, conclusão/snapshot/mapa, acesso negado ao admin, importação/mapeamento/revisão, mídia indisponível e recuperação de erro. Larguras 320/390/430/768/1440px.
- O teste existente do mapa foi adaptado para as novas consultas de catálogo e repetido: vistas, nomes, seleção/lista/teclado, limpar, links, vazio/erro, responsividade.
- Capturas em `validation/exercisedb/` são do navegador com dados HTTP de teste. Nenhuma fixture está no código de produção e não foi acessado o banco real. O teste pode receber um único GIF oficial via `TEST_EXERCISE_GIF`; não é importação de mídia para o aplicativo. Teko pode ser fornecida via `TEST_TEKO_FONT` para verificação offline.

Para repetir os testes visuais, instale Playwright/Chromium no ambiente de teste, inicie `npm run dev -- --host 127.0.0.1 --port 5173` e execute `node tests/exercisedb-browser.mjs` e `node tests/muscle-map-browser.mjs`. `TEST_BASE_URL` e `TEST_SCREENSHOTS` configuram URL local e destino.

## Diretrizes aplicadas

Lidos os cinco `.md` do projeto: `README-eForge.md`, `MUDANCAS-2026-09-16.md`, `ATUALIZACAO-AVATAR-SEMANAL.md`, `ATUALIZACAO-MAPA-MOBILE.md`, `HOTFIX-VERCEL-FONTE.md`, além das diretrizes fornecidas `architect-review`, `backend-architect`, `frontend-developer`, `design-system-architect`, `ui-designer`, `ui-ux-designer` e `ui-visual-validator`.

- Arquitetura: preservar stack/pastas, reutilizar auth/roles/tabelas/rotas e isolar serviço externo; nenhuma troca de framework, ORM, estado ou sistema de treino.
- Backend: contratos tipados, validação, timeout/retry, idempotência, checkpoints, transações, RLS e segredo somente no servidor.
- Frontend/design: mobile primeiro, tema grafite/roxo, Teko Bold e Forega na marca, componentes Radix existentes, consultas/cache TanStack Query e mídia lazy.
- UI/acessibilidade: nomes e labels, foco, controles de pelo menos 44px, diálogos com gutter/rolagem, erros/estados vazios, largura limitada por tela e filtros agrupados.
- Validação visual: conferir capturas e corrigir problemas encontrados, além de compilar. As capturas iniciais revelaram compressão do desktop pela regra global de `main`; foi corrigida com CSS local e o teste passou a exigir largura útil dos cards.
- Tipografia/hotfix: não reintroduzir importação remota de fonte no CSS; carregamento existente no head é mantido.
- Regra semanal: janela local segunda–segunda; histórico e cores/pesos preservados. Ausências externas não são inventadas.

Não há Vault/Obsidian no repositório enviado; a documentação foi atualizada no README e neste arquivo. A condição de licença da fonte foi informada antes da implementação. Nenhuma outra regra conflitante exigiu mudança de arquitetura.

## Limitações e manutenção

Ainda requer aplicar migrations, instalar a função/configuração e realizar a importação no Supabase de desenvolvimento antes de usar o catálogo novo. Não foi validado com credenciais reais, em telefone físico ou importando todas as páginas da API real. A função não foi publicada nesta entrega.

GIFs externos são de baixa resolução e podem falhar/mudar; o fallback evita quebra de interface. `gif_url` pode apontar depois para Storage licenciado; uma substituição administrativa é preservada pelo sync. Confirmar licença/necessidade antes de migrar mídia em massa.

A entrega original não incluía tradução automática. A atualização [ATUALIZACAO-CATALOGO-PT-BR.md](ATUALIZACAO-CATALOGO-PT-BR.md) adiciona tradução em lote, exclusão reversível e importação por parte do corpo; `name_pt_br` e `instrucoes_pt_br` continuam permitindo revisão humana preservada durante sync. Músculos fora dos 15 grupos exigem revisão; não expandimos o avatar sem assets/máscaras adequados. Sincronização não exclui/inativa exercícios simplesmente ausentes de uma resposta parcial; arquivamento continua explícito.

A busca usa prefixos de tokens; ranking fuzzy, jobs agendados e um adaptador contratado para uso comercial são futuras melhorias. A sincronização por página é retomável, mas precisa de uma aba ou CLI ativo para continuar enviando páginas. Não há worker permanente introduzido.

## Resultado da entrega

- `npm test`: passou, com as sete suites.
- `npm run typecheck`: passou.
- `npm run build`: passou.
- `npm run build:mobile`: passou (aviso de tamanho do bundle já existente no build estático).
- `deno check --no-config --node-modules-dir=manual supabase/functions/sync-exercisedb/index.ts`: passou com o SDK instalado.
- ESLint dos novos componentes, hooks, modelos, função e tipos Supabase: passou sem erros ou avisos.
- `npm run lint` geral: ainda falha por dívida anterior de formatação/`any`/regras em outros arquivos; a base tinha 1.637 erros e a entrega tem 1.090. Não foi feita refatoração geral para eliminar essa dívida.
- Playwright da biblioteca e do mapa: passou; capturas revisadas em celular e desktop.

### Arquivos alterados/adicionados

- `.env.example`
- `INTEGRACAO-EXERCISEDB.md`
- `README-eForge.md`
- `package.json`
- `scripts/sync-exercisedb.mjs`
- `src/components/exercises/CatalogControls.tsx`
- `src/components/exercises/ExerciseDetails.tsx`
- `src/components/exercises/ExerciseFormDialog.tsx`
- `src/components/exercises/ExerciseMedia.tsx`
- `src/components/exercises/ExercisePicker.tsx`
- `src/components/exercises/ExerciseSyncPanel.tsx`
- `src/components/exercises/MuscleMappingPanel.tsx`
- `src/components/exercises/catalog.css`
- `src/components/muscle-map/MuscleMapScreen.tsx`
- `src/components/ui/dialog.tsx`
- `src/hooks/use-exercise-catalog.ts`
- `src/integrations/supabase/types.ts`
- `src/lib/exercise-labels.ts`
- `src/lib/exercise-types.ts`
- `src/lib/muscle-activity.ts`
- `src/lib/muscle-map-data.ts`
- `src/lib/workout-storage.ts`
- `src/lib/workout-sync.ts`
- `src/routeTree.gen.ts`
- `src/routes/_authenticated/admin.exercises.tsx`
- `src/routes/_authenticated/exercises.tsx`
- `src/routes/_authenticated/muscle-map.tsx`
- `src/routes/_authenticated/reports.tsx`
- `src/routes/_authenticated/run.$workoutId.tsx`
- `src/routes/_authenticated/workouts.tsx`
- `supabase/config.toml`
- `supabase/functions/_shared/exercisedb.ts`
- `supabase/functions/_shared/sync-handler.ts`
- `supabase/functions/sync-exercisedb/index.ts`
- `supabase/migrations/20261002120000_exercisedb_catalog.sql`
- `supabase/migrations/20261002121000_catalog_training_snapshot.sql`
- `tests/exercisedb-browser.mjs`
- `tests/exercisedb-database.mjs`
- `tests/exercisedb.mjs`
- `tests/helpers/exercisedb.mjs`
- `tests/muscle-activity.mjs`
- `tests/muscle-map-browser.mjs`
- `tests/muscle-map-data.mjs`

Capturas novas: `validation/exercisedb/biblioteca-mobile.png`, `detalhes-mobile.png`, `montar-treino-mobile.png`, `admin-mobile.png`, `biblioteca-desktop.png` e estados do mapa em `validation/exercisedb/map/`.
