# Validação: recuperação do treino — 05/10/2026

## Evidência

O teste com cinco exercícios foi executado antes da correção. Ao simular rascunho anterior contendo dois exercícios, a versão antiga retornou os dois e deixou os outros três ausentes. Após a correção, os cinco foram recuperados na mesma sessão ao reconectar, sem finalizar ou reiniciar; as séries registradas e edições feitas durante a consulta foram preservadas.

O gatilho original no aparelho do usuário não é comprovado por este teste. A falha de retomada é reproduzida localmente; detalhes da investigação e limites estão em [Correção do treino](../../CORRECAO-TREINO-EXERCICIOS.md).

## Verificações concluídas

- `npm test`: 12 suítes passaram, incluindo novos testes de integridade do rascunho e corridas na sincronização, além dos testes existentes com PostgreSQL local/RLS.
- `npm run typecheck`: passou.
- `npm run build` e `npm run build:mobile`: passaram. Avisos preexistentes do adaptador Cloudflare, diretivas de dependências e tamanho de chunk mobile permanecem.
- ESLint de `workout-storage.ts`, `workout-sync.ts` e `run.$workoutId.tsx`: zero erros/avisos. Lint global preexistente não foi reexecutado como se tivesse sido corrigido.
- `git diff --check`: passou.
- Chromium nas rotas reais, com dados locais e todas as requisições externas interceptadas: passou; nenhuma escrita no Supabase real.

## Regressões e interação

O navegador validou recuperação silenciosa sem mensagem de sucesso; cinco exercícios na mesma sessão; rascunho anterior parcial offline; conferência ao reconectar sem encerrar; edição durante resposta atrasada; não enviar snapshot parcial anterior; gravação incompleta de outra aba sem ciclo de storage events; substituição seguida de retomada, sem reinserir o exercício original; rota da sessão ativa; carga decimal, concluir/desfazer, descanso, séries, histórico e finalização com navegação ao mapa. Todos os snapshots verificados incluem os cinco exercícios e seus UUIDs estáveis.

Viewports: 320, 360, 390, 430, 768 e 1440 px. Sem rolagem horizontal; controles de pelo menos 44 px; último controle permanece acima do rodapé.

## Capturas reais

- [Tela recuperada no celular](treino-recuperado-mobile-tela.png).
- [Tela recuperada a 320 px](treino-recuperado-320.png).
- [Tela recuperada no desktop](treino-recuperado-desktop-tela.png).
- [Recuperação no celular, cinco exercícios](treino-recuperado-mobile.png).
- [Recuperação no desktop](treino-recuperado-desktop.png).
- [Resumo do treino no celular](treino-mobile.png).
- [Séries e descanso no celular](treino-series-mobile.png).
- [Layout desktop](treino-desktop.png).

As capturas usam dados de teste e não representam informações da conta real. O resultado estruturado está em `resultado.json`. Não houve publicação ou execução de SQL remoto.
