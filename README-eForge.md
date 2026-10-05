# eForge 1.3.0

Aplicativo voltado ao celular em React/TanStack Start, Supabase e Capacitor, com identidade escura, superfícies grafite e roxo. A biblioteca oficial usa os GIFs próprios fornecidos e os dados classificados do manifesto; exercícios pessoais, treinos, históricos e o Muscle Map semanal são preservados.

## Instalação e atualização

**Fechamento de compartilhamento, ordem e perfil:** esta atualização inclui SQL novo. Com a biblioteca própria anterior instalada, execute o arquivo completo `maintenance/20261003150000_workout_sharing_order_profile_manual.sql` no SQL Editor. Configure `VITE_PUBLIC_SITE_URL` antes do build Android/iOS para gerar links do domínio público. Consulte [Fluxos, instalação e validação](FECHAMENTO-EFORGE.md).

**Ajustes anteriores de treino e avatar:** se sua biblioteca já está instalada, aplique o código e execute as verificações. Não há SQL, migration, reimportação de GIFs ou Edge Function nova para estes ajustes. Consulte [Treino e mapa atualizados](ATUALIZACAO-TREINO-MAPA.md). Os passos de banco abaixo são da instalação da biblioteca anterior.

1. Execute npm ci.
2. Copie .env.example para .env e configure a URL/chave **públicas** do mesmo projeto Supabase. Preserve seu arquivo local; nenhuma credencial acompanha a entrega.
3. Para uma instalação nova, aplique as migrations existentes em ordem. Para atualizar o projeto que já tem o catálogo/snapshot anteriores, use o arquivo completo maintenance/20261002200000_owned_gif_library_manual.sql no SQL Editor. Ele aplica somente etapas pendentes; não reaplica o antigo ADD COLUMN source.
4. Execute npm run dev. A configuração existente normalmente usa http://localhost:8080; para uma porta específica, use npm run dev -- --port 5173 --strictPort.
5. Entre como administrador em /admin/exercises, selecione o manifesto classificado e seu ZIP de 611 GIFs, importe, confira o relatório e só depois confirme **Substituir biblioteca antiga**.

O projeto completo não inclui o ZIP de GIFs novamente: use gifs_categorizados_por_musculo(1).zip, já fornecido por você. O manifesto original, JSON equivalente e relatório de classificação acompanham a pasta catalog/.

Ao copiar este pacote sobre um projeto existente, execute scripts/remove-legacy-catalog.ps1 após a cópia para mover os arquivos antigos enumerados para um backup fora do projeto. Uma extração em pasta nova já não contém esses arquivos. Histórico Git e .env local devem ser preservados por você.

Passos completos, permissões, limites, revisão e retirada dos serviços remotos antigos: [Biblioteca oficial eForge](BIBLIOTECA-EFORGE.md). Resultados reais de testes e auditoria: [AUDITORIA-BIBLIOTECA-EFORGE.md](AUDITORIA-BIBLIOTECA-EFORGE.md).

## Biblioteca oficial eForge

- 611 GIFs únicos em oito categorias; 14 aliases deduplicados por SHA-256.
- Importação administrativa por CSV/JSON com ZIP ou pasta, todos ou por categoria; pausa, retomada idempotente, progresso e relatório.
- GIFs no bucket existente exercise-media; banco guarda caminho/URL/hash, anatomia, primário/secundários, confiança, notas e músculos sem região. Terciários inicialmente vazios.
- Busca, filtros e paginação no Supabase; TanStack Query e mídia lazy loaded. Não carrega toda a biblioteca para filtrar no cliente.
- Edição/revisão, ativar/inativar, exclusão individual/múltipla/todos, seleção de página/resultados e restauração. Dados reais do manifesto, sem traduções ou classificações inventadas.
- Migração explícita depois da validação: remove somente itens oficiais antigos sem referências, arquiva os usados e preserva IDs, treinos, séries, histórico e exercícios privados/públicos de usuários.
- Sem consulta operacional à antiga API, sem Edge Function de importação, sem Google Translate, sem chaves externas no frontend.

Os nomes seguem o CSV, inclusive os poucos nomes em inglês. A revisão administrativa permite corrigir esses nomes. O manifesto não informa modalidade operacional, equipamento ou tipo de controle; esses campos precisam de conferência. Detalhes no guia.

## Treinos, mapa e identidade preservados

O rascunho local e a fila de sincronização continuam separados por usuário, com UUID estável e snapshot transacional. Permanecem salvamento de séries, decimal com vírgula, descanso por horário final, marcação, substituição e navegação com cinco entradas. Vibração/som dependem das permissões e do dispositivo.

A execução /run/$workoutId prioriza resumo, descanso e séries, com edição de carga/repetições, marcação, tipo, remoção e adição de série. O avatar geométrico antigo foi retirado dessa tela. O descanso usa minutos/segundos e botões separados; o histórico fica recolhido após as séries. O rodapé reserva espaço no conteúdo.

A rota /muscle-map mantém a arte anatômica cinza com aparência 3D, imagens WebP e máscaras SVG interativas. Primários treinados aparecem em roxo forte, secundários em roxo suave; a seleção usa contorno ciano e preserva a cor de treino. Frente/costas no celular, ambas no desktop, nomes, detalhes e lista acessível são mantidos. Papéis vêm dos snapshots das séries concluídas. Pesos: primário 1, secundário 0,55, terciário 0,25; aquecimentos excluídos. Semana local: segunda-feira 00:00 até a próxima segunda, exclusiva. A virada muda a análise visual, sem excluir histórico.

Documentos específicos: [Mapa mobile](ATUALIZACAO-MAPA-MOBILE.md), [avatar semanal](ATUALIZACAO-AVATAR-SEMANAL.md) e [Vault técnico](vault/README.md). Forega Sport DEMO permanece na marca; Teko Bold na interface existente, com exceção de fonte de sistema já aprovada para a tela do mapa.

PWA, ícones, service worker e fallback offline mantêm a configuração existente. Visite as telas online antes de testar offline; GIFs/telas ainda não carregados e consultas novas exigem conexão. Dados privados de API não entram no cache do service worker.

## Desenvolvimento e verificação

```sh
npm test
npm run typecheck
npm run build
npm run build:mobile
```

O comando npm test executa onze suítes, incluindo importador, ZIP, PostgreSQL local/RLS/Storage simulado, compartilhamento público, cópia seletiva, retries, ordem, perfil e SQL manual. Os testes de navegador são separados, usam rotas reais e HTTP isolado; a suíte de compartilhamento executa também PostgreSQL local. Resultado e dívida preexistente do lint global estão documentados na validação.

O build web usa o adaptador TanStack/Nitro existente. O build mobile usa a configuração Capacitor existente; para sincronizar ou abrir projetos nativos, use os scripts cap:sync, cap:android e cap:ios. Nenhuma publicação é executada nesta entrega. Use HTTPS/PWA conforme o ambiente já adotado pelo projeto.

React Start e Start Server Core permanecem nas versões corrigidas do hotfix; [HOTFIX-TANSTACK-XSS.md](HOTFIX-TANSTACK-XSS.md) registra a correção anterior. Não é necessário habilitar o bypass de segurança do Vercel.

Para testar a abertura isoladamente, use npm run intro:dev e abra /intro-preview.html na porta indicada pelo Vite. Ela reutiliza os componentes da intro, sem banco/login e sem simular as demais telas.

## Operação e limites

Esta entrega não altera seu Supabase, não importa arquivos remotamente, não executa commit/push e não publica produção. O relatório do painel informa as quantidades reais após você aplicar o schema, importar e ativar. Os testes/capturas locais não representam registros da sua conta.

Histórico de schema e dados antigos referenciados permanece por compatibilidade, sem dependência operacional da API anterior. Os documentos de instalação externa foram movidos para docs/LEGADO/; não os use para configurar a versão atual. Após ativação, o guia explica como remover as funções/Secrets antigos que possam estar publicados no seu projeto.

Armazenamento local pode ser apagado pelo navegador/sistema e não substitui sincronização. Validação em aparelho físico e com suas sessões reais ainda é necessária; as capturas entregues são do Chromium com viewports mobile e dados de teste.
