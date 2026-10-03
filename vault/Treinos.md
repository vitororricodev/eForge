# Treinos

A rota `/run/$workoutId` mantém rascunho por usuário, UUIDs estáveis, RPC transacional e retomada. A execução prioriza o celular: resumo de tempo/séries feitas/volume, progresso real, descanso aderente no topo e cartões de exercícios com séries editáveis.

O avatar geométrico foi retirado da execução em 03/10/2026. Teko permanece na interface e Forega na marca; a exceção de fonte do mapa continua restrita ao mapa.

Cada série aceita repetições inteiras e carga decimal com ponto/vírgula. Marcação pode ser desfeita. Adição gera novo UUID; remoção exclui a série do rascunho. Tipo, histórico e substituição pelo ExercisePicker continuam existentes. Substituir com séries concluídas exige a confirmação anterior e redefine somente as séries daquele exercício.

Descanso usa horário final, continua após suspensão e tem −15s, +15s e pular. Vibração/som dependem do dispositivo. Controles da execução têm pelo menos 44px; campos e conclusão têm 48px. O conteúdo reserva espaço para rodapé fixo e safe area.

Finalizar exige uma série concluída e confirmação. Se armazenamento local falhar, a finalização não envia um estado que não pôde ser salvo. Sem conexão, o rascunho permanece para sincronizar depois. O link final abre [[Muscle-Map]]; apenas treinos finalizados contam no mapa semanal.

Teste local: `tests/workout-run-browser.mjs`. Sessão, catálogo e RPCs são fixtures HTTP isoladas; não chegam ao banco real. Inclui edição, vírgula decimal, concluir/desfazer, descanso, adicionar/remover, tipo/histórico, som, offline/retomada, UUIDs, substituição, finalização e papéis no mapa. Capturas: [Validação](../validation/treino-mapa/README.md).

Relacionados: [[Arquitetura]], [[Muscle-Map]], [[Banco-e-acesso]].
