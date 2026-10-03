# Biblioteca oficial eForge

Entrega de código em 02/10/2026. O catálogo oficial passa a usar os GIFs e o manifesto fornecidos, `source='eforge'`, o bucket existente `exercise-media` e a tabela existente `exercises`. Exercícios pessoais continuam com `source='user'`, sua titularidade e sua visibilidade. O aplicativo não consulta uma API externa de exercícios.

## Aplicar esta entrega no seu projeto

1. Extraia o projeto completo em uma pasta nova. Preserve seu `.env` e a configuração pública do mesmo Supabase; o pacote não inclui credenciais, `node_modules`, builds ou `.git`.
2. Se preferir copiar sobre uma pasta existente, execute, **depois da cópia**, `powershell -ExecutionPolicy Bypass -File scripts/remove-legacy-catalog.ps1`. O script move apenas os arquivos antigos enumerados para uma pasta de backup ao lado do projeto. Isso evita deixar componentes antigos que um ZIP não consegue apagar.
3. Execute `npm ci`. No Windows, use uma instalação LTS do Node compatível com o projeto; o importador por terminal usa Node 20.12 ou superior.
4. No SQL Editor do seu projeto Supabase, execute o arquivo inteiro `maintenance/20261002200000_owned_gif_library_manual.sql`. Ele aplica somente estruturas pendentes, registra as versões e recusa schema parcialmente aplicado. **Não rode novamente o antigo `ALTER TABLE ... ADD COLUMN source`.** As versões anteriores `20261002120000` e `20261002121000` precisam estar completas e registradas no histórico. Se esse requisito falhar, pare e confira o schema antes de registrar qualquer versão manualmente.
5. Execute `npm run dev` e abra `/admin/exercises` com sua conta administrativa. A autorização usa o papel `admin` já existente em `public.user_roles`; conhecer um UUID não dá acesso administrativo.
6. Em **Importar GIFs**, selecione `catalog/manifest_gifs_categorizados.csv` e o ZIP classificado que você enviou (`gifs_categorizados_por_musculo(1).zip`). A versão JSON equivalente, `catalog/manifest.json`, também é aceita. Não use o ZIP anterior sem a nova estrutura de subcategorias.
7. Importe **Todas as categorias** ou uma categoria de cada vez. Mantenha o manifesto completo selecionado. Termine as oito categorias antes da substituição. Mantenha a aba aberta durante uploads; se houver pausa, fechamento ou falha, repita com os mesmos arquivos para retomar pelos hashes.
8. Confira o resultado e use **Baixar relatório do banco**. Para a biblioteca original completa e disponível, o relatório deve mostrar 611 registros, 611 arquivos correspondentes e nenhuma ausência no manifesto.
9. Só então use **Substituir biblioteca antiga** e digite `SUBSTITUIR BIBLIOTECA`. O servidor verifica novamente todos os hashes informados, disponibilidade, MIME e tamanho dos objetos. A aplicação do SQL, sozinha, **não apaga nem troca o catálogo**.
10. Confira biblioteca, treinos, substituição de exercícios e mapa com sua conta real. Esta entrega não publica o aplicativo nem executa ações no seu Supabase.

As migrations individuais, para fluxos existentes com Supabase CLI, são `20261002180000_catalog_management.sql` (se ainda pendente), `20261002200000_owned_gif_library.sql` e `20261002201000_retire_external_catalog.sql`. Use o arquivo manual **ou** o fluxo de migrations do projeto; não reaplique versões já registradas. Em uma instalação inteiramente nova, aplique primeiro as migrations anteriores do projeto, em ordem; o arquivo manual desta entrega é uma atualização incremental.

## Arquivos, categorias e manifesto

O CSV tem 625 linhas de dados: 611 com `importar=sim` e 14 aliases de arquivos idênticos. A importação usa `novo_caminho_categorizado`, conserva as subcategorias e deduplica por SHA-256.

| Categoria          | GIFs únicos |
| ------------------ | ----------: |
| Abdômen            |          66 |
| Bíceps             |          73 |
| Costas             |          76 |
| Deltoides          |          43 |
| Membros inferiores |         187 |
| Panturrilha        |          20 |
| Peitoral           |         100 |
| Tríceps            |          46 |
| Total              |         611 |

São preservados nome, slug, caminho, tamanho, SHA-256, músculo anatômico, chave primária do avatar, secundários, músculos sem região, confiança, observações e aliases. O manifesto original e suas observações permanecem em `external_data`, reutilizado como proveniência da biblioteca própria. Não são gerados nomes, equipamentos, instruções, traduções ou músculos por dedução automática.

Os nomes seguem exatamente o CSV, incluindo os poucos nomes em inglês ou pouco específicos. O administrador pode corrigi-los em **Editar / revisar**, sem contratar um tradutor externo e sem perder a classificação original. O reimportador não desfaz edições. Não se altera texto que esteja desenhado dentro de um GIF.

## Músculos e revisão

O importador aceita somente as 15 chaves existentes: `chest`, `abs`, `obliques`, `shoulders`, `biceps`, `forearms`, `quads`, `calves`, `traps`, `lats`, `lower_back`, `glutes`, `hamstrings`, `triceps`, `rear_delts`.

Terciários começam vazios. Informações sem região própria ficam em `unmapped_muscles`; nove exercícios de adutores não recebem um primário fictício. As aproximações explicitamente fornecidas para glúteo médio/mínimo e manguito rotador mantêm a chave visual do CSV **separada** do nome anatômico e de suas observações.

O arquivo fornecido informa 578 classificações de confiança alta e 33 de confiança média, inferidas por nome/categoria. A lista nominal dos 33 está em `catalog/relatorio_classificacao_muscular.md`. O importador não transforma essa inferência em uma conferência humana: grava `classification_reviewed=false`, mantém a confiança e publica os registros como `active=true`, `review_status='approved'`, conforme o catálogo solicitado. O filtro **Para revisar** inclui itens ainda não conferidos, com informações sem região ou pendentes.

O manifesto não informa a modalidade operacional (`categoria`) nem o tipo de registro de séries (`tipo_controle`). Para permitir o cadastro no schema existente sem inferir equipamento ou carga a partir do nome, o importador usa os defaults técnicos **Funcional / Repetições** e deixa a conferência pendente. Revise esses dois campos antes de usar um exercício com carga em kg, tempo ou distância. A categoria de pasta (Peitoral, Costas etc.) é um conceito diferente e usa `partes_corpo`/`partes_corpo_pt_br`, sem criar um enum paralelo.

## Storage e identidade

Reutiliza-se o bucket público existente `exercise-media`, para preservar os componentes e uploads pessoais. Os objetos oficiais usam:

```text
exercise-media/official/<categoria>/<subcategorias>/<slug>--<sha256-completo>.gif
```

Somente o arquivo fica no Storage. O PostgreSQL armazena `gif_path`, `gif_url`, `gif_sha256` e metadados. O suffix do hash torna a URL imutável e evita sobrescritas e cache de uma versão diferente.

Existem índices únicos para o hash e para o slug dos GIFs oficiais. O slug de catálogo combina categoria, slug fornecido e 12 caracteres do hash; assim, os dois exercícios chamados `paralelas`, em categorias diferentes, têm identidades distintas. Um conteúdo diferente gera um registro novo. O registro anterior é inativado ou excluído pelo administrador; IDs de histórico não são reaproveitados.

Antes de enviar, o importador consulta a existência do registro e do objeto. Não reenvia um objeto íntegro. Para um novo arquivo, valida tamanho, assinatura GIF87a/GIF89a e SHA-256; o upload usa `upsert=false`, MIME `image/gif`. Uma falha após upload permite retomar o cadastro. Um registro excluído permanece excluído ao reimportar e só volta pela ação **Restaurar**.

A opção ZIP lê o diretório central e descomprime um arquivo selecionado por vez; não carrega 611 GIFs na interface nem expande o ZIP inteiro em memória. Aceita ZIP convencional com armazenamento/Deflate; para ZIP64, multipart ou arquivos incompatíveis, extraia e use **Pasta de GIFs**. Limites: ZIP de até 512 MiB no painel, manifesto de até 8 MiB/5.000 entradas e GIF de até 8 MiB. Os 611 GIFs recebidos têm menos de 1,73 MB cada. Os limites do seu bucket/plano continuam aplicáveis.

## Administração e exclusão

`/admin/exercises` oferece busca, filtros, paginação, GIF, edição, ativar/inativar, checkbox, selecionar página, selecionar todos os resultados, seleção entre páginas, exclusão múltipla, excluir todos e restauração. **Selecionar todos os resultados** respeita os filtros; **Excluir todos** afeta o catálogo oficial inteiro e exige `EXCLUIR TODOS`. A seleção é limpa quando os filtros mudam. A seleção em lote é limitada a 10.000 IDs; a biblioteca fornecida tem 611.

A exclusão normal é reversível: `catalog_deleted_at` e `active=false`. Não remove arquivos vinculados nem registros de séries. O formulário pode alterar nome, categoria de pasta, músculos, anatomia, confiança, observações, modalidade e controle. A mídia oficial não pode ser sobrescrita pelo formulário: importe uma nova versão e inative a anterior.

Busca pública, montagem e substituição reutilizam o mesmo hook paginado, TanStack Query e RPC `search_exercises_v2`. Os filtros incluem nome, categoria de pasta, primário, secundário, origem, visibilidade e equipamento quando informado. O CSV não fornece equipamentos; esse campo fica vazio até revisão. Cada página tem 20 registros, no máximo 50 por RPC, com GIFs lazy loaded. Não existe uma consulta que carregue os 611 GIFs para filtrar no cliente.

## Preservação do catálogo antigo e histórico

`activate_owned_gif_library` executa a troca em uma transação, com bloqueio contra importações antigas. Atinge apenas `source='exercisedb'` e registros oficiais `source='eforge'` sem hash da biblioteca nova. Exercícios `source='user'` são preservados.

Para cada item antigo, verifica `workout_exercises.exercise_id` e `set_logs.exercise_id`. Sem referências, remove o registro; com referência, conserva seu ID, músculos, mídia, nome e demais campos, grava `active=false`/`catalog_deleted_at`, e não o oferece para novas montagens. `workout_sessions` relaciona-se aos treinos/séries, sem uma FK direta adicional para exercícios. Sessões, logs, nomes e músculos dos snapshots permanecem intactos. Treinos existentes com IDs arquivados continuam legíveis e executáveis; a função existente de snapshot foi preservada.

O estado da troca (`owned_catalog_state`) registra data, administrador e quantidades efetivamente removidas/arquivadas. Repetir a ação não repete a limpeza. Após a troca, as consultas/facetas deixam de exibir a origem externa, o guard de banco impede reativá-la e as RPCs antigas de sincronização/tradução perdem permissão inclusive para `service_role`.

## Segurança

O painel exige sessão e papel `admin`; as RPCs e políticas verificam isso novamente no servidor. Usuários comuns não importam, alteram nem excluem GIFs oficiais. Leituras usam RLS existente: catálogo oficial público para usuários autenticados, exercícios privados do titular e exercícios pessoais públicos aprovados. O administrador do catálogo não ganha acesso aos exercícios privados de outras pessoas.

Uploads oficiais ficam restritos ao prefixo `official/` e ao administrador. Objetos oficiais referenciados não podem ser apagados por clientes; UPDATE desse prefixo é bloqueado. Os prefixos pessoais baseados no UUID mantêm suas regras anteriores. Como o bucket já era público, uma pessoa com uma URL pode ler o GIF; privacidade das linhas do banco não torna uma URL pública secreta.

Não há service role, senha de banco, chave de tradução ou token externo no frontend. O importador usa a sessão da conta. Nunca cole uma chave administrativa no `.env` usado pelo Vite.

## Importação por terminal, opcional

O painel é a opção mais simples e não exige copiar tokens. Para verificar os arquivos localmente sem acessar o Supabase:

```powershell
npm run catalog:import -- --manifest catalog/manifest_gifs_categorizados.csv --folder D:\GIFs\gifs-categorizados --dry-run --report verificacao-local.json
```

A pasta deve conter diretamente `abdomen`, `biceps`, `costas` etc. Para importar pelo terminal, a URL/chave pública já configuradas e `EFORGE_ADMIN_ACCESS_TOKEN` precisam representar uma sessão administrativa válida. Essa variável é somente do processo Node, não deve entrar em variáveis `VITE_*`, arquivos publicados ou Git. São aceitos `--category peitoral`, `--report arquivo.json` e, opcionalmente, `--activate`. Esse último faz a substituição real, por isso use-o apenas depois de conferir **todo o manifesto**. O CLI recusa service role como chave do cliente, interrompe após o arquivo atual com Ctrl+C e grava progresso/erros em JSON; repetir retoma pelo banco.

Para acrescentar GIFs no futuro, organize-os nas mesmas categorias e execute `npm run catalog:prepare -- --folder PASTA --output novo-manifesto.json`. O gerador valida os arquivos e deduplica, deixando os músculos vazios e a confiança baixa. Preencha somente classificações verificadas, ou revise no painel; o gerador não adivinha anatomia a partir de nomes.

## Desativar serviços remotos antigos, após a troca

Os arquivos de sincronização e tradução antiga foram removidos deste código. As migrations antigas permanecem como histórico de schema, e as RPCs antigas são revogadas na ativação. Para remover também as funções que você publicou no seu Supabase, confira primeiro que o relatório mostra `state.legacy_disabled=true`. Então, no projeto correto:

```powershell
npx --yes supabase functions delete sync-exercisedb --project-ref amqgfygcgsrzycarvxot
# Execute o próximo comando somente se essa função existir no Dashboard:
npx --yes supabase functions delete translate-exercises --project-ref amqgfygcgsrzycarvxot
```

Pelo Dashboard, remova apenas Secrets exclusivos dessas funções, como `EXERCISEDB_USAGE_MODE` e `GOOGLE_TRANSLATE_API_KEY`, se cadastrados. Retire também variáveis locais antigas como `EFORGE_SYNC_MAX_PAGES`/tokens de sincronização que não sejam usados por outras funções. Não remova os Secrets automáticos do Supabase nem configurações de outras funcionalidades.

Não foi encontrado cron de sincronização no repositório. Agendamentos remotos não puderam ser consultados nesta entrega: verifique a área Cron/Database no Dashboard e desative somente jobs que chamem explicitamente essas duas funções. Não use um comando genérico que apague todos os jobs. A nova biblioteca não exige Edge Function nem cron.

## Muscle Map e validação

A arte anatômica, máscaras SVG, navegação mobile e lista acessível foram preservadas. O mapa usa as chaves importadas e os snapshots das séries: principal 1, secundário 0,55, terciário 0,25; aquecimento excluído. A janela semanal começa segunda-feira 00:00 no fuso local. O reset é visual/analítico, não exclusão de histórico. Em 03/10/2026, o avatar antigo foi retirado da execução; o mapa semanal recebeu primários em roxo forte, secundários em roxo suave e seleção ciano, independente do treino. Consulte [Treino e mapa](ATUALIZACAO-TREINO-MAPA.md).

Execute `npm test`, `npm run typecheck`, `npm run build` e `npm run build:mobile`. Os testes novos cobrem CSV/JSON/ZIP, os 611 registros, idempotência, hash/slug, erros, Storage/RLS, filtros, exclusão e troca com exercício antigo utilizado. O banco dos testes é PostgreSQL local em PGlite, com tabelas/políticas de Storage simuladas. Os testes de navegador usam rotas reais com HTTP interceptado; não consultam sua conta real.

Para os testes visuais, instale Playwright/Chromium fora das dependências de produção, inicie `npm run dev -- --port 5173 --strictPort` e execute `node tests/owned-gif-browser.mjs` e `node tests/muscle-map-browser.mjs`. Configure `.env` com valores públicos. As capturas de `validation/` usam dados de teste, não são uma prova de importação remota.

Resultados e dívida técnica estão em [AUDITORIA-BIBLIOTECA-EFORGE.md](AUDITORIA-BIBLIOTECA-EFORGE.md). A arquitetura e operação também estão organizadas em [vault/README.md](vault/README.md). Documentos antigos ficam exclusivamente em `docs/LEGADO/`.
