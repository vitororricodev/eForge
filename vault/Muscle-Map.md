# Muscle Map

Arte anatômica, máscaras, interface mobile e lista acessível permanecem intactas. A nova biblioteca utiliza as 15 chaves existentes: chest, abs, obliques, shoulders, biceps, forearms, quads, calves, traps, lats, lower_back, glutes, hamstrings, triceps e rear_delts.

Séries concluídas usam os snapshots musculares do exercício. Pesos preservados: primário 1, secundário 0,55 e terciário 0,25. Aquecimento é excluído. A janela semanal vai de segunda-feira 00:00 até a segunda seguinte, exclusiva, no fuso local. A virada semanal muda a consulta e a representação visual; não exclui logs.

O mapa ao vivo reage ao marcar/desmarcar uma série. A seleção visual é independente dos músculos treinados. Anatomia sem região permanece em `unmapped_muscles`; aproximações explicitamente fornecidas são documentadas separadamente. Não se infere recuperação, ativação fisiológica ou diagnóstico a partir de volume de treino.

`Ver exercícios` preserva a rota e o filtro `muscle`; as sugestões usam a mesma consulta paginada da biblioteca. Um exercício antigo arquivado conserva seus músculos no histórico.

Relacionados: [[Biblioteca]], [[Banco-e-acesso]]. Detalhes visuais anteriores: [Mapa mobile](../ATUALIZACAO-MAPA-MOBILE.md) e [janela semanal](../ATUALIZACAO-AVATAR-SEMANAL.md).
