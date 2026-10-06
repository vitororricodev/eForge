# Evolução

O menu superior permite circular entre as telas da Evolução e retornar à tela principal por **Relatórios**, sempre como primeiro item. Não depende do histórico do navegador.

| Opção | Rota existente | Tela |
| --- | --- | --- |
| Relatórios | `/reports` | Visão principal com gráficos e indicadores |
| Cardio | `/cardio` | Atividades e registros de cardio |
| Medidas | `/body-profile` | Perfil corporal e medidas |
| Metas | `/goals` | Metas e acompanhamento |
| Medalhas | `/achievements` | Conquistas |
| Mapa muscular | `/muscle-map` | Mapa anatômico semanal |

## Implementação

- `src/components/EvolutionNav.tsx`: links do TanStack Router, opção ativa por pathname e `aria-current="page"`.
- `src/components/evolution-nav.css`: estilos restritos ao menu, tokens existentes, Teko, áreas de toque de pelo menos 44px e intervalo de 8px.
- `src/routes/_authenticated.tsx`: renderiza o componente após o cabeçalho, antes do conteúdo. O menu aparece somente nas seis rotas acima. Execução de treino, início, biblioteca e perfil não recebem esse menu.
- `src/routes/_authenticated/reports.tsx`: mantém gráficos e controles internos; a antiga lista isolada de links foi removida para evitar duplicação.

O menu mantém uma linha, com rolagem horizontal nativa quando as opções não cabem. Não produz rolagem horizontal na página inteira. A opção ativa tem fundo roxo e nome completo; as demais preservam o destaque roxo existente. Foco visível e navegação por Tab/Enter reutilizam os padrões atuais.

A mudança de rota e o redimensionamento revelam a opção ativa ajustando somente `scrollLeft` do menu. `ResizeObserver` é desconectado ao sair. Voltar/avançar no navegador e entrada direta nas rotas também atualizam a seleção.

As consultas, dados privados, sessões, formulários, cálculo de IMC, meta semanal, gráficos, seleção muscular e menu inferior permanecem existentes. Nenhuma migration, importação ou configuração nova no Supabase é necessária.

## Validação

Validação local com as rotas reais em Chromium e chamadas externas interceptadas: 77 conferências de rota/layout, incluindo todas as opções e retorno por Relatórios, entrada direta, recarga, histórico, toque e teclado. Larguras: 320, 360, 390, 430 e 1440px. Tipos, doze suítes existentes e builds web/Capacitor passaram.

[Resultado, capturas e limites](../validation/evolucao-20261006/README.md).

Relacionados: [[Arquitetura]], [[Perfil]], [[Muscle-Map]], [[Treinos]].
