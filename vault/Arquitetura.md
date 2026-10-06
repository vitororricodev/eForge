# Arquitetura

React 19, TanStack Start/Router/Query, Vite, Tailwind, componentes Radix existentes, Supabase Auth/PostgreSQL/Storage e builds Capacitor são preservados. Nenhum framework, serviço de tradução ou tabela paralela de exercícios foi criado.

`/exercises`, a montagem de treino, a substituição e as sugestões do mapa utilizam `useExerciseCatalog`, que consulta `search_exercises_v2` com filtros e paginação no banco. Cache e rascunhos continuam separados por usuário. `ExerciseMedia` carrega apenas mídia dos cards renderizados.

`/admin/exercises` verifica sessão/papel e integra `CatalogManager` e `OwnedGifImportPanel`. O parser/validador `owned-gif-manifest.ts` e o motor `owned-gif-import.ts` são reutilizados pelo navegador e pelo CLI, sem dois parsers diferentes. O adaptador Supabase faz inspeção, upload e cadastro via RPC. O ZIP usa leitura parcial e fflate carregado sob demanda.

A dependência operacional do catálogo externo foi removida. Códigos/labels para registros históricos e migrations antigas continuam apenas como compatibilidade de dados. A transição no banco ocorre pela ação explícita validada após a importação, não no carregamento da página.

Em 03/10/2026, a execução `/run/$workoutId` recebeu CSS restrito a `workout-run` e reutiliza Button, Input e ExercisePicker. O avatar antigo não é mais renderizado nem consulta o sexo do perfil nessa rota. Armazenamento/sincronização e schema continuam existentes. O mapa deriva os papéis dos mesmos snapshots por `muscleStateFromSets`, reutilizando normalização/hierarquia/pesos de `muscle-activity.ts`. Nenhuma tabela ou consulta paralela foi criada.

O fechamento de 03/10/2026 acrescenta `/share/$token`, componentes de compartilhar/ordenar e RPCs no Supabase. Nenhuma dependência de drag, serviço externo ou framework novo foi adicionado. `ExercisePicker` e catálogo paginado existentes são reutilizados na cópia; `ExerciseMedia` renderiza mídia da biblioteca. CSS novo está restrito às classes das telas/diálogos de planejamento e compartilhamento. Perfil reutiliza schema/formulário, com correção do banco e IMC durante edição. Emojis escritos na interface foram substituídos por Lucide; dados de usuários não são reescritos.

Em 05/10/2026, o perfil passa a reutilizar `BMIResult` entre formulário e resumo. Cálculo, normalização de altura, classificação por idade e faixa de referência ficam no módulo existente `body-profile.ts`. A RPC continua recebendo centímetros e não existe campo persistido de IMC. Nenhum schema ou dependência nova. A limpeza de arquivos já marcada em `ARQUIVOS-LEGADOS.json` foi reaplicada com backup para corrigir o código legado reintroduzido na main.

A correção de treino em 05/10/2026 mantém os módulos `workout-storage.ts` e `workout-sync.ts`, a chave local por usuário e o contrato da RPC existente. O rascunho recebe campos opcionais de plano inicial, identidade de item e revisão, compatíveis com rascunhos anteriores. Recuperação/invariantes de lista ficam no módulo de armazenamento; o componente aplica alterações sobre o estado atual, e o sincronizador confirma a revisão enviada sem sobrescrever uma mais recente. Nenhuma dependência ou banco paralelo. Suítes de armazenamento/sincronização e teste de navegador verificam os cenários de rascunho incompleto e concorrência.

Em 06/10/2026, o card da tela inicial (`dashboard.tsx`) passa a exibir “Sequência de treinos”. Apenas o texto foi alterado; contador de dias, cálculo da sequência, meta semanal, componentes e estilos foram preservados. A conferência isolada do card com o CSS existente e Teko verificou larguras de 320, 360, 390 e 430px, sem sobreposição ou corte; em 320px, o texto quebra naturalmente em duas linhas.

Em 06/10/2026, `EvolutionNav` passa a integrar o layout autenticado nas seis rotas da Evolução. O menu duplicado de `reports.tsx` foi removido. Estado ativo acompanha o pathname do TanStack Router; CSS fica restrito a `eforge-evolution-*`, com tokens existentes e rolagem horizontal local. A opção ativa é revelada no menu ao navegar ou redimensionar, sem alterar a rolagem vertical da página. Menu inferior, consultas, gráficos, formulários, anatomia e rotas continuam existentes. Não há dependência, schema ou serviço novo. Consulte [[Evolucao]].

Relacionados: [[Evolucao]], [[Treinos]], [[Biblioteca]], [[Banco-e-acesso]], [[Muscle-Map]], [[Compartilhamento]], [[Perfil]].
