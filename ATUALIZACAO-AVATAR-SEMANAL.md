# eForge — Avatar muscular semanal

Atualização aplicada em 16/09/2026.

## O que mudou

- Avatar muscular passa a usar base cinza/translúcida quando não há ativação.
- Músculos recebem cor somente quando entram como principal, secundário ou terciário em séries concluídas.
- Gradientes, volume, contornos e sombras foram ajustados para dar mais profundidade ao mapa anatômico.
- Geometria dos principais grupos musculares foi refinada para reduzir o aspecto de boneco flat.
- O mapa de evolução agora considera somente a semana de treino atual (segunda a domingo).
- Ao iniciar uma nova segunda-feira, os dados visuais da semana anterior deixam de ser exibidos e o avatar volta ao estado cinza.
- O mapa é reconsultado periodicamente para também respeitar a troca de semana com o app aberto.
- O mapa ao vivo durante o treino continua atualizando a cada série concluída.

## Regra semanal

A janela semanal é calculada no fuso local do dispositivo:

- início: segunda-feira 00:00;
- fim: segunda-feira seguinte 00:00 (exclusivo).

Não há exclusão do histórico: o reset é apenas visual/analítico da semana atual. Os treinos anteriores permanecem registrados.

## Validação executada

- teste da normalização e hierarquia principal/secundário/terciário;
- teste da janela semanal e virada segunda-feira;
- validação sintática dos arquivos TypeScript/TSX modificados.
