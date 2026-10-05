# eForge — compartilhamento, organização e perfil

Atualização de 03/10/2026 sobre o código `05e3519` da branch `main`. Mantém a biblioteca própria, a execução mobile e o avatar anatômico com primários roxos fortes, secundários suaves e seleção ciano. Nenhum serviço remoto ou produção foi alterado.

## Aplicar no seu projeto

1. Extraia o projeto completo em uma pasta nova ou copie os arquivos sobre seu checkout, preservando seu `.env` e histórico Git. Se copiar sobre uma versão antiga, execute `scripts/remove-legacy-catalog.ps1`: ele move apenas os arquivos listados em `ARQUIVOS-LEGADOS.json` para um backup fora do projeto. Não apaga migrations nem dados.
2. No SQL Editor do mesmo Supabase usado pelo aplicativo, execute **inteiro** o arquivo `maintenance/20261003150000_workout_sharing_order_profile_manual.sql`. Este é o SQL novo desta entrega. Ele exige a biblioteca própria anterior instalada, aplica a atualização em uma transação e registra a migration `20261003150000`. Não reaplica o antigo `ADD COLUMN source`, não reimporta GIFs e não exige Edge Function.
3. Execute `npm ci`, `npm test`, `npm run typecheck`, `npm run build` e `npm run build:mobile`. Configure as mesmas variáveis públicas de Supabase já utilizadas pelo projeto.
4. Para o aplicativo Android/iOS, configure **antes do build** `VITE_PUBLIC_SITE_URL=https://SEU-DOMINIO-PUBLICO` em `.env`. Assim o link abre o site público, em vez de apontar para o `localhost` interno do Capacitor. No navegador/PWA, vazio utiliza o domínio atual. Esta variável é pública; não contém chave de serviço.
5. Teste com duas contas: compartilhar, abrir o link sem login, entrar e copiar com um substituto, editar a cópia, organizar/salvar/recarregar e revogar o link. Publicação fica por sua conta após essa conferência; não houve push ou deploy nesta entrega.

O arquivo de migration equivalente fica em `supabase/migrations/20261003150000_workout_sharing_order_profile.sql`. Para quem administra migrations pelo CLI, use o fluxo normal do projeto em vez de executar também o SQL manual. O script manual aceita repetição quando a estrutura está completa e recusa instalações parciais com mensagem explícita.

## Compartilhar e copiar

- Em **Treinos**, cada cartão possui **Compartilhar**. **Gerar link** cria uma cópia do nome, descrição, ordem dos exercícios, GIFs, informações de execução e planejamento de séries, repetições, carga e descanso.
- Qualquer pessoa com o link pode visualizar. E-mail, perfil corporal, sessões e séries realizadas não entram nessa cópia. Treinos e exercícios privados não recebem políticas públicas de leitura.
- O link existente pode ser copiado, aberto ou enviado pela opção de compartilhamento do navegador. Reabrir o diálogo conserva o mesmo link. **Gerar novo link e revogar o anterior** atualiza a cópia de forma explícita; editar o treino original não modifica links já criados.
- **Revogar link** impede novas leituras/importações pelo endereço. Excluir o treino original também invalida o link. Cópias já salvas por outras pessoas permanecem independentes.
- Para copiar, a pessoa entra em sua conta e retorna ao treino compartilhado. Pode mudar o nome. Exercícios ainda disponíveis na sua biblioteca reutilizam o mesmo ID; exercícios privados de outra pessoa, removidos ou indisponíveis pedem um substituto existente na sua biblioteca.
- Somente os exercícios indisponíveis podem ser substituídos nessa etapa. A cópia mantém posições, séries, repetições, carga planejada e descanso, inclusive zero segundos. Nenhum exercício novo é cadastrado por essa importação. O treino aparece em **Meus treinos** e pode ser editado normalmente.
- A cópia usa uma identificação do pedido: tentar novamente após falha de conexão não duplica o treino. Validação e gravação são transacionais, com autorização também no banco.

## Organizar

**Dentro do treino:** arraste pelo puxador de pontos no editor. As setas continuam disponíveis, e o puxador também aceita as teclas cima/baixo, Home e End. Séries, cargas e UUIDs dos itens acompanham seus exercícios. Salvar aplica tudo em uma transação; uma falha não apaga a lista anterior. Após salvar, **Editar** permite reorganizar novamente.

**Lista de treinos:** use **Organizar treinos**, arraste os cartões ou use as setas. **Salvar ordem** persiste a sequência na conta e a mantém após recarregar. **Cancelar organização** descarta a alteração local. O cartão de próximo treino no início também respeita essa ordem. Novos treinos entram ao final da lista.

O arrastar suporta touch, mouse e teclado; somente o puxador bloqueia a rolagem por toque. A lista rola ao aproximar o gesto das bordas. Interromper o gesto cancela apenas aquele movimento. Durante a gravação, os controles de organização ficam desabilitados.

## Perfil e ícones

O banco anterior restringia `profiles.sex` a valores em inglês, enquanto a tela enviava valores em português. A migration corrige a restrição e converte os valores antigos sem alterar a data do registro do peso. O perfil usa upsert pela identidade da sessão, confere o retorno e trata falhas; um registro ausente pode ser criado sem apresentar um falso sucesso.

Peso/altura aceitam ponto ou vírgula. O IMC é recalculado enquanto a pessoa edita e após salvar/recarregar. Uma medida antiga não sobrescreve visualmente um peso atualizado no perfil; a medida de peso mais recente pode ser usada conforme a data do registro. O histórico existente é preservado.

Os emojis escritos na interface foram substituídos por ícones Lucide nos relatórios/Evolução, início, cardio e metas. Conteúdo escrito por usuários é preservado. Forega na marca e Teko na interface permanecem existentes; a exceção de fonte do mapa continua restrita ao mapa.

## Validação e limites

`npm test` executa onze suítes, incluindo duas contas, RLS, snapshot público, substituição seletiva, autorização, retries, edição atômica, ordem, upsert do perfil e repetição do SQL manual. Typecheck e builds web/Capacitor são verificados. Os arquivos alterados passam no ESLint sem erros; avisos e dívida anterior do lint global estão registrados em `validation/fechamento/README.md`.

`tests/workout-sharing-browser.mjs` usa as rotas reais em Chromium e PostgreSQL local (PGlite), com todas as chamadas externas interceptadas. Cobre toque/mouse/teclado, salvar/recarregar/cancelar, link público, retorno de login/cadastro, cópia com substituição, falha/retry, revogação, edição de carga com vírgula, descanso zero, perfil/IMC e telas de 320px, 390px e desktop. Capturas e resultado ficam em `validation/fechamento/`.

Os dados das capturas são de teste. A mídia do teste é um GIF mínimo para verificar carregamento, sem representar seus GIFs reais. A opção nativa de enviar depende do navegador; copiar o link permanece disponível. Google/entrega de e-mail e instalação física Android/iOS exigem validação no ambiente real com as configurações de autenticação já existentes. O código mantém o provedor atual e o retorno seguro ao compartilhamento, sem criar um serviço de login paralelo.

Atualizações técnicas: `vault/Compartilhamento.md`, `vault/Perfil.md`, `vault/Treinos.md` e `vault/Banco-e-acesso.md`.
