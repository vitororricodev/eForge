# Treinos

A rota `/run/$workoutId` mantém rascunho por usuário, UUIDs estáveis, RPC transacional e retomada. A execução prioriza o celular: resumo de tempo/séries feitas/volume, progresso real, descanso aderente no topo e cartões de exercícios com séries editáveis.

O avatar geométrico foi retirado da execução em 03/10/2026. Teko permanece na interface e Forega na marca; a exceção de fonte do mapa continua restrita ao mapa.

Cada série aceita repetições inteiras e carga decimal com ponto/vírgula. Marcação pode ser desfeita. Adição gera novo UUID; remoção exclui a série do rascunho. Tipo, histórico e substituição pelo ExercisePicker continuam existentes. Substituir com séries concluídas exige a confirmação anterior e redefine somente as séries daquele exercício.

Descanso usa horário final, continua após suspensão e tem −15s, +15s e pular. Vibração/som dependem do dispositivo. Controles da execução têm pelo menos 44px; campos e conclusão têm 48px. O conteúdo reserva espaço para rodapé fixo e safe area.

Em 06/10/2026, o som de fim do descanso passa de um bip senoidal de 0,25s a seis bipes alternados de 1.000/1.400Hz, com duração total de aproximadamente 2s. `rest-audio.ts` usa Web Audio nativo, onda quadrada, ganho de 0,95 e rampas curtas de entrada/saída. O objetivo é aumentar a presença do alerta; a aplicação não controla o volume de mídia do aparelho. O contexto é preparado dentro do toque em “Som no descanso” e reutilizado durante a execução. Desligar essa opção, finalizar ou sair cancela os tons agendados; sair também fecha o contexto. Uma retomada de áudio atrasada não pode tocar depois de silenciar/sair. A opção continua desligada inicialmente; vibração, cronômetro e rascunho permanecem existentes. Não há asset de áudio externo, dependência, schema ou mudança no som da abertura. [Validação do alerta](../validation/descanso-som-20261006/README.md).

Finalizar exige uma série concluída e confirmação. Se armazenamento local falhar, a finalização não envia um estado que não pôde ser salvo. Sem conexão, o rascunho permanece para sincronizar depois. O link final abre [[Muscle-Map]]; apenas treinos finalizados contam no mapa semanal.

Em 05/10/2026, a retomada foi corrigida após reprodução de rascunho parcial (dois de cinco exercícios). Novas sessões guardam `plannedExercises` e `plan_item_id`; a recuperação usa a lista inicial, mantendo substituições, UUIDs, séries e descanso. Rascunhos anteriores são reconciliados com o plano cadastrado e continuam utilizáveis offline; reconexão/foco/visibilidade repetem a conferência pendente. Uma consulta atrasada usa o estado atual, sem desfazer edições realizadas durante a espera. Uma sessão ativa de outro treino retorna à rota correta. Conforme preferência do usuário, a recuperação ocorre silenciosamente: sem banner, toast ou aviso de sucesso. Permanecem o status normal de salvamento e os erros que exigem ação.

`saveDraft` retorna o estado realmente salvo, protege a lista contra redução e incrementa a revisão. Atualizações da tela usam referência atual e funções de alteração, com identidade estável do item. Eventos de armazenamento entre abas adotam a versão mais nova sem regravar continuamente. `syncDraft` relê o rascunho após autenticação; não envia rascunho ativo anterior ainda não conferido, inclui pendentes e concluídas e só marca uma versão final como sincronizada se a revisão continua igual. Uma resposta antiga não reabre nem sobrescreve uma sessão finalizada. Não há schema ou RPC nova. Limites de recuperação anterior: [Investigação e aplicação](../CORRECAO-TREINO-EXERCICIOS.md).

Teste local: `tests/workout-run-browser.mjs`. Sessão, catálogo e RPCs são fixtures HTTP isoladas; não chegam ao banco real. Inclui edição, vírgula decimal, concluir/desfazer, descanso, adicionar/remover, tipo/histórico, som, offline/retomada, UUIDs, substituição, finalização e papéis no mapa. Capturas anteriores: [Validação de layout](../validation/treino-mapa/README.md). A regressão atual cobre cinco exercícios, rascunho parcial offline, reconexão sem finalizar, consulta atrasada, aba desatualizada e substituição/recarga; [Validação da recuperação](../validation/treino-recuperacao-20261005/README.md).

Em 03/10/2026, `/workouts` ganhou compartilhamento e organização. `SortableList` usa Pointer Events com captura no elemento estável da lista (o cartão muda de posição sem perder o gesto), rolagem por proximidade das bordas e teclas cima/baixo/Home/End com foco preservado. Somente o puxador bloqueia o gesto de rolagem. As setas continuam disponíveis. O cancelamento restaura o estado anterior ao gesto.

No editor, cada item tem UUID estável. `save_workout_plan` valida propriedade, disponibilidade, duplicatas e parâmetros antes de concluir a transação; atualiza os mesmos itens e remove somente os retirados. Não apaga tudo antes de reinserir. Descanso zero e carga decimal são preservados. Séries executadas, histórico e snapshots continuam no fluxo existente.

`workouts.ordem` é preenchida preservando a ordem anterior por criação. `Organizar treinos` mantém um rascunho com salvar/cancelar; `reorder_workouts` valida o conjunto completo do titular e persiste a ordem. Criação/importação entra ao final. O início utiliza a mesma sequência para o próximo treino. Todas as operações de organização do mesmo usuário passam pelo mesmo lock transacional.

Teste de interação/ordem/cópia/perfil: `tests/workout-sharing-browser.mjs`. [[Compartilhamento]] descreve criação e importação de links. Guia de aplicação: [Fechamento](../FECHAMENTO-EFORGE.md).

Relacionados: [[Arquitetura]], [[Muscle-Map]], [[Banco-e-acesso]], [[Compartilhamento]], [[Perfil]].
