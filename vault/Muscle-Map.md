# Muscle Map

Arte anatômica, máscaras, interface mobile e lista acessível permanecem intactas. A nova biblioteca utiliza as 15 chaves existentes: chest, abs, obliques, shoulders, biceps, forearms, quads, calves, traps, lats, lower_back, glutes, hamstrings, triceps e rear_delts.

Séries concluídas usam os snapshots musculares do exercício. Pesos preservados: primário 1, secundário 0,55 e terciário 0,25. Aquecimento é excluído. A janela semanal vai de segunda-feira 00:00 até a segunda seguinte, exclusiva, no fuso local. A virada semanal muda a consulta e a representação visual; não exclui logs.

`muscleStateFromSets` conserva o papel dos snapshots concluídos; deduplica IDs e aliases por série, respeita todos os primários informados e usa o papel principal quando um músculo teve papéis diferentes na semana. A intensidade da cor indica o papel do exercício, não volume acumulado ou uma medição de ativação.

Primário treinado: roxo forte `#ad45ff`, opacidade 0,9. Secundário: roxo suave `#ba91e4`, opacidade 0,5. Terciário legado: opacidade 0,25, com legenda apenas quando existir; novos GIFs continuam sem terciários. O blend de cor preserva luz e fibras da arte. Seleção: contorno ciano `#4ee4f3` em path separado não interativo, sem sobrescrever o preenchimento treinado. Músculo sem registro selecionado recebe tonalidade ciano. Foco de teclado permanece branco.

A lista acessível também informa o papel semanal por descrição e ponto colorido. Detalhes exibem o papel e as contagens reais. Frente/costas, nomes, limpeza e links para exercícios permanecem funcionais.

O avatar geométrico ao vivo foi retirado da execução em 03/10/2026. Marcar/desmarcar continua alterando as séries e snapshots; o mapa semanal considera somente treinos finalizados. Anatomia sem região permanece em `unmapped_muscles`; aproximações fornecidas são documentadas separadamente. Não se infere recuperação, ativação fisiológica ou diagnóstico a partir de volume.

`Ver exercícios` preserva a rota e o filtro `muscle`; as sugestões usam a mesma consulta paginada da biblioteca. Um exercício antigo arquivado conserva seus músculos no histórico.

Relacionados: [[Treinos]], [[Biblioteca]], [[Banco-e-acesso]]. Ajustes atuais: [Treino e mapa](../ATUALIZACAO-TREINO-MAPA.md). Detalhes anteriores: [Mapa mobile](../ATUALIZACAO-MAPA-MOBILE.md) e [janela semanal](../ATUALIZACAO-AVATAR-SEMANAL.md).
