# Arquitetura

React 19, TanStack Start/Router/Query, Vite, Tailwind, componentes Radix existentes, Supabase Auth/PostgreSQL/Storage e builds Capacitor são preservados. Nenhum framework, serviço de tradução ou tabela paralela de exercícios foi criado.

`/exercises`, a montagem de treino, a substituição e as sugestões do mapa utilizam `useExerciseCatalog`, que consulta `search_exercises_v2` com filtros e paginação no banco. Cache e rascunhos continuam separados por usuário. `ExerciseMedia` carrega apenas mídia dos cards renderizados.

`/admin/exercises` verifica sessão/papel e integra `CatalogManager` e `OwnedGifImportPanel`. O parser/validador `owned-gif-manifest.ts` e o motor `owned-gif-import.ts` são reutilizados pelo navegador e pelo CLI, sem dois parsers diferentes. O adaptador Supabase faz inspeção, upload e cadastro via RPC. O ZIP usa leitura parcial e fflate carregado sob demanda.

A dependência operacional do catálogo externo foi removida. Códigos/labels para registros históricos e migrations antigas continuam apenas como compatibilidade de dados. A transição no banco ocorre pela ação explícita validada após a importação, não no carregamento da página.

Em 03/10/2026, a execução `/run/$workoutId` recebeu CSS restrito a `workout-run` e reutiliza Button, Input e ExercisePicker. O avatar antigo não é mais renderizado nem consulta o sexo do perfil nessa rota. Armazenamento/sincronização e schema continuam existentes. O mapa deriva os papéis dos mesmos snapshots por `muscleStateFromSets`, reutilizando normalização/hierarquia/pesos de `muscle-activity.ts`. Nenhuma tabela ou consulta paralela foi criada.

O fechamento de 03/10/2026 acrescenta `/share/$token`, componentes de compartilhar/ordenar e RPCs no Supabase. Nenhuma dependência de drag, serviço externo ou framework novo foi adicionado. `ExercisePicker` e catálogo paginado existentes são reutilizados na cópia; `ExerciseMedia` renderiza mídia da biblioteca. CSS novo está restrito às classes das telas/diálogos de planejamento e compartilhamento. Perfil reutiliza schema/formulário, com correção do banco e IMC durante edição. Emojis escritos na interface foram substituídos por Lucide; dados de usuários não são reescritos.

Relacionados: [[Treinos]], [[Biblioteca]], [[Banco-e-acesso]], [[Muscle-Map]], [[Compartilhamento]], [[Perfil]].
