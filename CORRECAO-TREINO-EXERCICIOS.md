# Correção: exercícios desaparecendo durante o treino

## Investigação e reprodução

A retomada anterior de `/run/$workoutId` aceitava qualquer rascunho local ativo e retornava antes de consultar `workout_exercises`. Não existia uma cópia da lista inicial para verificar se faltavam exercícios. O salvamento local também aceitava sobrescrever a lista completa com uma versão parcial. A sincronização usava o objeto recebido antes de aguardar autenticação, e a confirmação de envio podia gravar esse objeto antigo novamente.

O teste em Chromium iniciou um plano de cinco exercícios, registrou séries e simulou um rascunho anterior contendo apenas os dois primeiros. A versão anterior retomou esses dois e deixou três exercícios pendentes inacessíveis. A reprodução falhou na asserção “resume hides untouched exercises from an incomplete local draft”. A versão corrigida recuperou os cinco na mesma sessão.

Isso demonstra uma falha concreta compatível com o relato, mas não identifica o evento original no aparelho: não foram fornecidos logs, versão instalada nem o rascunho da sessão de campo. Retomada de um rascunho incompleto é a causa reproduzida; suspensão, outra aba e respostas atrasadas são condições agora cobertas por proteções e testes, sem atribuí-las como causa comprovada no seu aparelho.

## Comportamento corrigido

- Cada nova sessão mantém a lista inicial completa e a identidade do item do treino. Trocar o exercício preserva essa identidade e não recupera o original por engano.
- Rascunhos anteriores são conferidos com o plano cadastrado. Os exercícios ausentes voltam à lista, com a mesma sessão e sem reiniciar séries, cargas, repetições ou descanso dos exercícios preservados.
- A recuperação é silenciosa, sem banner ou mensagem de sucesso.
- Sem conexão, um rascunho anterior continua utilizável, com o status normal de sincronização pendente. Reconexão e retorno à tela tentam recuperar o plano automaticamente. Enquanto não houver conferência, um rascunho ativo anterior não substitui os registros do servidor.
- Respostas de carregamento usam a versão atual do rascunho, preservando edições feitas enquanto a consulta estava em andamento.
- Os controles usam a versão atual da sessão e a identidade do item, não uma posição desatualizada da lista.
- Uma escrita parcial não reduz a lista já salva. Eventos de outra aba e retorno à tela atualizam a interface sem criar um ciclo de gravações.
- A sincronização relê o rascunho após a autenticação, inclui séries pendentes e concluídas e só confirma uma versão finalizada se ela ainda corresponder à enviada. Uma resposta atrasada não sobrescreve dados locais mais novos.
- Abrir outro treino enquanto existe uma sessão ativa retorna à rota da sessão correta, mantendo a regra existente de uma sessão ativa por usuário.

## Aplicação

**Esta correção não exige SQL, migration, reimportação ou nova função no Supabase.** A RPC `save_workout_snapshot` existente permanece com o mesmo contrato. O pacote completo inclui os ajustes de IMC anteriormente entregues e o layout atual de treino/avatar, compartilhamento, organização e catálogo próprio.

Preserve seu `.env` e histórico Git. Copie os arquivos do pacote para o projeto ou extraia em uma pasta nova. Se copiar por cima de uma versão antiga, execute o script `scripts/remove-legacy-catalog.ps1` já fornecido: a extração não remove sozinha os arquivos aposentados enumerados em `ARQUIVOS-LEGADOS.json`.

Execute `npm ci`, `npm test`, `npm run typecheck`, `npm run build` e `npm run build:mobile`. A atualização do código/PWA ou APK precisa ser aplicada ao ambiente instalado pelo responsável; nenhuma publicação, push ou alteração remota no banco foi realizada nesta entrega. O PWA mantém a regra de atualizar após finalizar a sessão ativa.

## Validação

As 12 suítes de `npm test`, TypeScript, builds web/Capacitor e ESLint dos três módulos de treino alterados passaram. `git diff --check` também passou. O lint global tem dívida preexistente registrada nas entregas anteriores; não foi tratado como um resultado aprovado desta correção.

O teste `tests/workout-run-browser.mjs` usa as rotas reais com todas as chamadas externas interceptadas. Valida um treino com cinco exercícios, recuperação de rascunho anterior sem finalizar, edição durante consulta atrasada, reconexão, sobrescrita de outra aba, substituição seguida de recarga, identidade da rota, UUIDs e snapshots completos. Mantém a validação de concluir/desfazer, cargas com vírgula, descanso, séries, histórico e navegação ao mapa muscular. Viewports de 320, 360, 390, 430, 768 e 1440 px, sem rolagem horizontal, áreas de toque de pelo menos 44 px e rodapé sem cobrir o último controle.

Resultados e capturas: [Validação da recuperação](validation/treino-recuperacao-20261005/README.md). Testes locais e capturas usam dados de teste; não representam registros da sua conta.

## Limites

Para sessões novas, a recuperação usa o plano inicial salvo e funciona sem consultar o plano atual. Alterar o treino cadastrado depois de iniciar não reescreve a sessão em execução.

Rascunhos anteriores sem plano inicial exigem conexão uma vez. Se o plano cadastrado também foi alterado, apagado ou ficou indisponível, não é possível reconstruir com certeza a lista histórica original. Substituições anteriores sem identidade de item são mantidas e vinculadas aos espaços ainda disponíveis, sem descartar séries. Dados que já desapareceram de todas as cópias não podem ser recriados fielmente.

Armazenamento do aparelho ainda pode ser apagado pelo navegador/sistema. A correção mantém a sincronização existente; não cria retomada remota em outro aparelho. O novo teste de campo continua necessário para confirmar o comportamento na versão atualizada do seu celular.
