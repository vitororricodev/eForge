# Compartilhamento

`/share/$token` é uma rota pública fora do layout autenticado. TanStack Query consulta `get_shared_workout`; a chave inclui token e conta. O snapshot é validado por Zod, renderizado com componentes reais e `ExerciseMedia`. Campos de texto são conteúdo React, sem HTML injetado. A página usa `noindex/nofollow` e `no-referrer`.

`WorkoutShareDialog` cria, conserva, copia, abre, renova ou revoga um link. `VITE_PUBLIC_SITE_URL` define a origem pública para o Capacitor; web/PWA usa a origem atual quando a configuração está vazia. Links rejeitam protocolos não HTTP seguro e credenciais na URL.

`workout_shares` guarda uma cópia de campos autorizados do planejamento. A função de criação confere o dono do treino e limita o que pode ler dos exercícios. Clientes não gravam snapshots diretamente. Só o titular consulta os metadados dos links; público lê a cópia apenas pela RPC com token de 64 caracteres hexadecimais, gerado de dois UUIDs aleatórios. Renovar revoga o anterior. Alterar o treino original não muda o snapshot já compartilhado.

Importar exige sessão. O banco calcula disponibilidade pelos mesmos requisitos do catálogo, incluindo exercícios privados apenas do destinatário. O cliente oferece `ExercisePicker` somente para os indisponíveis e exclui escolhas já utilizadas. `import_shared_workout` verifica substituições, duplicatas, link ainda ativo e valores, então chama o mesmo validador transacional do editor. Mantém planejamento/posição e cria IDs independentes. `workout_share_imports` evita duplicação por retry do pedido. Revogação não remove a cópia importada.

Login/cadastro conservam o retorno interno validado para `/share/<token>`. Não aceitam redirects externos. O provedor Google existente é preservado; retorno pendente em sessionStorage tem prazo de 30 minutos e é consumido quando a sessão chega. Login/cadastro por senha usa retorno explícito e não reaproveita intenções antigas. Confirmação de e-mail mantém a instrução de entrar depois.

Teste: `tests/workout-sharing-database.mjs`, `tests/workout-sharing-manual.mjs`, `tests/closure-utils.mjs` e `tests/workout-sharing-browser.mjs`. A suíte de navegador usa SQL real local, HTTP interceptado e sessões isoladas; não toca serviços remotos.

Relacionados: [[Treinos]], [[Banco-e-acesso]], [[Arquitetura]], [[Perfil]].
