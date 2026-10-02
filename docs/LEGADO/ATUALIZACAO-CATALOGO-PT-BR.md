# LEGADO — documento histórico

Esta integração foi substituída pela biblioteca própria eForge. Não use estes passos para uma instalação ou atualização atual. Consulte [Biblioteca oficial eForge](../../BIBLIOTECA-EFORGE.md). Este conteúdo permanece apenas para entender versões anteriores do banco.

---

# eForge — tradução e gestão do catálogo

Atualização sobre `main` / `c0d7b8b`, de 02/10/2026. Código preparado e validado localmente; este pacote não aplica SQL, não publica funções e não traduz/exclui o catálogo remoto sozinho.

## Aplicar no projeto atual

1. Extraia a atualização na raiz do eForge, preservando a configuração pública do seu projeto Supabase. O ZIP não inclui credenciais, dependências ou arquivos Git.
2. No **SQL Editor do mesmo Supabase**, execute inteiro `maintenance/20261002180000_catalog_management_manual.sql`. É somente a nova migration. Ela registra o histórico junto com a aplicação e pode ser repetida sem executar novamente quando já estiver registrada. Não repita as duas migrations antigas.
3. No **terminal do VS Code**, dentro da raiz do eForge, instale/verifique o aplicativo:

```powershell
npm ci
npm test
npm run typecheck
npm run build
npm run build:mobile
```

4. Publique a versão atualizada do importador e a nova função de tradução:

```powershell
npx --yes supabase functions deploy sync-exercisedb --project-ref amqgfygcgsrzycarvxot
npx --yes supabase functions deploy translate-exercises --project-ref amqgfygcgsrzycarvxot
```

Se precisar reinstalar o CLI e faltar espaço no cache de C:, use antes, nessa mesma janela:

```powershell
New-Item -ItemType Directory -Force "D:\npm-cache-eforge" | Out-Null
$env:npm_config_cache = "D:\npm-cache-eforge"
```

Use `npx --yes supabase login` se a sessão do CLI tiver expirado. Os comandos `functions deploy` não reaplicam migrations. Não é necessário refazer a atribuição de administrador já realizada.

5. Configure o Google Cloud, descrito abaixo. Depois aplique o código do app ao seu fluxo Git/Vercel e acesse `/admin/exercises` na versão atualizada. A publicação do frontend não foi feita pelo assistente.

## Configuração do tradutor escolhido

Foi escolhido **Google Cloud Translation Basic v2**. No Google Cloud, selecione/crie um projeto, habilite a **Cloud Translation API**, configure o faturamento e gere uma API key restrita a essa API. A API pode cobrar por caracteres; configure a quota compatível com seu orçamento no Google Cloud. Não precisa instalar um SDK no frontend.

No **Supabase → Edge Functions → Secrets**, adicione:

- Nome: `GOOGLE_TRANSLATE_API_KEY`
- Valor: a chave do Google Cloud.

A chave fica somente na Edge Function. Não use `VITE_`, não coloque no `.env` público, em commits ou em mensagens. `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são os valores padrão do ambiente da função, não segredos a expor no app.

A condição `EXERCISEDB_USAGE_MODE=non-commercial` continua necessária para importar da API gratuita em um projeto que cumpra os termos. A tradução não altera a licença dos dados/GIFs.

Fontes oficiais:

- <https://docs.cloud.google.com/translate/docs/setup>
- <https://docs.cloud.google.com/translate/docs/reference/rest/v2/translate>
- <https://supabase.com/docs/guides/functions/secrets>
- <https://supabase.com/docs/guides/functions/deploy>
- <https://oss.exercisedb.dev/docs#tag/exercises>

## Traduzir todos ou os selecionados

Em `/admin/exercises`, abra **Traduzir para português**:

1. Clique em **Preparar tradução de todos**, ou selecione exercícios e use **Preparar selecionados**.
2. Confira a quantidade e a estimativa inicial de caracteres.
3. Clique em **Traduzir / retomar lote**. Só essa etapa chama o Google.
4. Você pode pausar após o lote atual, retomar ou encerrar. Mantenha a aba aberta e a conexão disponível para continuar processando.

A fila traduz os campos ainda sem versão em português nos registros ExerciseDB não excluídos, incluindo pendentes de revisão. Trabalha em grupos de três exercícios, com checkpoint, lease de dois minutos e escrita transacional. Há limite de 1.000 IDs na seleção e 20.000 por fila completa. O histórico administrativo mostra progresso real. Preparar e encerrar não chamam a API de tradução.

Nomes/instruções originais são conservados. Nomes traduzidos entram no nome exibido e na busca, salvo quando já há um nome editado manualmente. Traduções previamente preenchidas não são sobrescritas. Equipamentos e partes do corpo conhecidos usam um vocabulário português local; termos novos passam pelo Google e são gravados em listas paralelas. Os identificadores originais continuam nos filtros e na integração.

Tradução automática exige revisão: use **Editar / revisar** para ajustar nomes, instruções e classificação. Traduções existentes são preservadas inclusive quando uma sincronização traz novas instruções; confira mudanças externas na revisão. Traduções de equipamentos/partes são invalidadas quando esses dados originais mudam, evitando rótulos desalinhados. Notas privadas e descrições manuais não são enviadas ao Google; a fonte atual não fornece uma descrição narrativa.

O desenho/animação e eventual texto gravado dentro dos pixels de um GIF não são traduzidos por esta função. Não há OCR nem edição de mídia. Tradução não aprova automaticamente músculos desconhecidos ou classificação.

A estimativa de caracteres inclui campos a preencher antes da deduplicação/vocabulário local; não é um orçamento monetário nem medição exata de cobrança. Um timeout/falha depois de uma resposta do provedor pode exigir repetição da chamada na retomada; o checkpoint impede duplicar as alterações no banco, mas não promete eliminar cobranças externas repetidas.

## Excluir individual, múltiplos ou todos

**Gerenciar exercícios oficiais** inclui seleção por checkbox, selecionar/desmarcar a página, paginação, busca, parte do corpo e status. A seleção se mantém entre páginas; mudar os filtros de parte/status ou sair da página limpa a seleção. O contador informa o escopo atual.

- **Excluir** em um item: remove esse exercício da biblioteca. Administradores também podem excluir um oficial diretamente no card de `/exercises`.
- **Excluir selecionados**: remove os IDs selecionados, inclusive de outras páginas.
- **Excluir todos**: remove todos os exercícios oficiais não excluídos, independentemente dos filtros/paginação. O diálogo mostra esse escopo e exige digitar `EXCLUIR TODOS`.
- **Mostrar → Excluídos → Restaurar**: recoloca um item na biblioteca quando estiver aprovado; itens pendentes continuam exigindo revisão.

A exclusão é **lógica e reversível**: grava `catalog_deleted_at` e desativa o item. Preserva ID, mídia original, treinos montados, séries e histórico. Evita o `ON DELETE CASCADE` existente na relação dos treinos. Impede novas adições desse item; treinos já montados continuam funcionando. A sincronização não desfaz a exclusão; só a ação explícita Restaurar o faz. O painel não administra/exclui exercícios particulares de usuários. A exclusão própria na biblioteca personalizada mantém o comportamento já existente.

Encerre uma importação ou tradução pausada/em andamento antes de excluir. Pausar preserva uma execução retomável; **Encerrar** libera o catálogo para a outra operação. O banco verifica o bloqueio, mesmo se duas contas/abas estiverem abertas.

## Importar por categoria

Abra **Importar exercícios** e selecione uma ou mais partes do corpo: peito, costas, ombros, abdômen, braços, antebraços, coxas, panturrilhas, pescoço ou cardio. Sem seleção, importa todas.

Categorias são as **partes do corpo da ExerciseDB**, não uma classificação automática como musculação/alongamento. O endpoint oficial `/api/v1/exercises/bodyparts` recebe `bodyParts`, `limit=25` e cursor `after`. O filtro fica salvo na execução; retomadas usam o mesmo escopo. Para mudar as categorias de uma execução pausada, encerre-a e inicie outra. Registros inesperados fora do filtro não são gravados e aparecem como erros de contrato.

Importar uma categoria não exclui as outras já existentes. Não importa nem baixa mídia em massa para Storage; GIFs continuam referenciados pela origem. Músculos-alvo/secundários, revisão conservadora e regras semanais do avatar são preservados.

## Arquitetura e segurança

Consultados README, integração ExerciseDB, regras mobile/semanais, hotfix TanStack/fontes e os `.md` fornecidos de arquitetura, frontend, design e validação. Aplicadas as regras de preservar React/TanStack/Supabase/Radix, componentes/pastas, Teko Bold, marca Forega e tema grafite/roxo; áreas de toque confortáveis, labels, foco e fluxos mobile.

- Migration incremental `20261002180000_catalog_management.sql`, sem alterar migrations antigas.
- Novos campos `catalog_deleted_at`, `equipamentos_pt_br`, `partes_corpo_pt_br` e `exercise_sync_runs.body_parts`.
- Nova tabela RLS `exercise_translation_runs`; clientes administrativos apenas leem, operações privilegiadas passam por RPCs restritas à service role.
- `translate-exercises` exige token validado com `getUser` e papel `admin`, limita payload/lote, usa timeout e retorna erros sanitizados. Não retorna lease, fila de IDs, credenciais ou respostas cruas do Google.
- Exclusão/restauração administrativas validam `auth.uid()`/papel no banco. Exercícios privados continuam isolados por usuário, inclusive em relação a administradores.
- Uma tradução confirma campos-fonte e traduções existentes novamente na transação, evitando sobrescrever uma edição realizada durante a requisição.
- Originais externos e overrides internos são preservados; texto traduzido é renderizado como texto React, nunca como HTML.
- Pesquisa comum e inclusão no treino excluem itens removidos. Componentes administrativos usam RPC paginado e não carregam o catálogo completo no navegador.

Não foi introduzido outro framework, ORM, SDK de tradução, renderização 3D ou worker permanente. Não há Vault/Obsidian no repositório fornecido.

## Validação e limites

- TypeScript, dez suites `npm test`, build web e mobile.
- Checagem Deno das duas Edge Functions e ESLint dos arquivos alterados: passaram.
- `npm run lint` geral permanece com dívida anterior em outros arquivos: 1.084 erros e 25 avisos; não foi feita uma refatoração de todo o projeto.
- PostgreSQL local PGlite: permissões, privacidade, filtros, leases, respostas repetidas, edição concorrente, exclusão/restauração, não reaparecimento na importação e preservação de treinos/séries.
- Playwright da rota real: seleção entre páginas, tradução preparada/execução, exclusão individual/múltipla/todos, confirmação, restauração, filtros de importação, biblioteca, montagem/substituição/conclusão do treino, mapa e layouts 320/390/430/768/1440 px.
- Capturas usam respostas HTTP de teste interceptadas; nenhum registro de teste é inserido no Supabase real.

Não foram usados a chave real do Google, o banco remoto ou um telefone físico. Não houve tradução paga, importação, exclusão, publicação de frontend ou publicação de funções pelo assistente. Configuração de Secrets, aplicação SQL e publicação das funções são os passos pendentes no ambiente do usuário.
