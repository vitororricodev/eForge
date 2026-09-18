# eForge — mapa muscular mobile

Implementação sobre o `eForge.zip` enviado em 16/09/2026. Sem publicação e sem alterações no banco remoto.

## Alterações

- `/muscle-map` usa o layout mobile aprovado: frente/costas, um corpo inteiro por vez, seleção em roxo, nomes, detalhes abaixo, lista de músculos e navegação inferior.
- Em telas a partir de 1024 px, há navegação lateral, painel de detalhes à direita e opção Ambos. Ao voltar ao mobile, retorna a uma vista.
- Arte anatômica cinza com aparência 3D em dois WebP locais (aproximadamente 100 KB juntos). As regiões interativas são paths SVG separados; a imagem não é apresentada como vetor editável nem como modelo 3D rotacionável.
- As máscaras são alinhadas à arte e representam os 15 grupos já reconhecidos pelo app. Região selecionada usa preenchimento roxo; registros semanais usam contorno tracejado e tonalidade discreta. A seleção não altera os dados.
- Lista alternativa, teclado Enter/Espaço, foco visível e estados de imagem indisponível, carregamento, vazio e erro.
- A rota reutiliza Supabase e TanStack Query existentes, com isolamento por usuário. Nenhum serviço novo, esquema ou migração foi introduzido.
- Contagens usam séries concluídas em treinos concluídos da semana local, de segunda a domingo. Aquecimentos são excluídos. Principal, secundário e terciário são normalizados; cada série e sessão conta uma vez por músculo.
- Rascunho finalizado ainda não sincronizado pode complementar a consulta, apenas para o usuário e semana correspondentes, sem duplicar IDs. O mapa atualiza a cada 30 segundos e no retorno à janela.
- “Ver exercícios” abre `/exercises?muscle=...`. O filtro considera os três papéis musculares; links individuais incluem busca por nome. “Limpar” remove o filtro.
- Correção mínima preexistente em `run.$workoutId.tsx`: converter PromiseLike em Promise antes de usar catch na consulta do perfil.

## Diretrizes consultadas

README-eForge.md, MUDANCAS-2026-09-16.md, ATUALIZACAO-AVATAR-SEMANAL.md, HOTFIX-VERCEL-FONTE.md; documentos fornecidos architect-review, frontend-developer, design-system-architect, ui-designer, ui-ux-designer e ui-visual-validator.

A composição, cores e tipografia da nova tela seguem a prévia mobile aprovada. A fonte de sistema legível fica restrita a essa tela/navegação correspondente; Forega permanece na marca e a tipografia das demais telas é preservada.

## Executar

1. Extraia o projeto. Preserve seu `.env` local; credenciais e dependências instaladas não são incluídas no pacote de entrega.
2. Rode `npm ci`.
3. Para uma instalação nova, copie `.env.example` para `.env` e preencha a configuração pública do mesmo Supabase que já utiliza. Continue usando as migrations existentes do projeto.
4. Rode `npm run dev` e abra `/muscle-map` após entrar na conta.
5. Valide com `npm run typecheck`, `npm test` e `npm run build` antes de uma futura publicação.

## Verificação no navegador

`tests/muscle-map-browser.mjs` testa a rota real com sessão e respostas HTTP fictícias, isoladas no processo de teste. Nenhuma fixture está no código da aplicação e nenhuma requisição de teste é enviada ao banco real. As capturas em `validation/` são do navegador, com esses dados de teste.

Para repetir, instale Playwright no ambiente de desenvolvimento, instale Chromium, inicie o servidor local na porta 5173 e execute `node tests/muscle-map-browser.mjs`. `TEST_BASE_URL` e `TEST_SCREENSHOTS` podem configurar URL local e destino das capturas.

## Limites

- A arte segue a referência masculina aprovada e é ilustrativa. Não é um atlas médico nem uma medida de ativação fisiológica/recuperação. O mapa compacto no treino mantém seus componentes anteriores.
- Não foram executadas ações na conta real, no Supabase remoto, no GitHub ou na Vercel. O pacote precisa ser aplicado ao seu ambiente para alterar o aplicativo publicado.
- Validação em aparelho físico e com sua sessão real permanece necessária para avaliar os dados e o comportamento específico de iOS/Android.

## Resultado final da validação

- `npm run typecheck`: passou.
- `npm test`: passou (armazenamento, mapa/semana, banco local PGlite, intro e novos testes de contagem).
- `npm run build`: passou; avisos do adaptador/dependências não impediram o build.
- Teste Playwright da rota real: passou. Larguras 320, 390, 430, 768 e 1440 px sem overflow horizontal; seleção por clique e teclado; frente/costas/ambos; nomes; lista; limpeza; navegação/filtro de exercícios; vazio; erro e recuperação.
- Inspeção visual das capturas: avatar completo, destaque com textura preservada, ação principal visível no celular de 390 × 844, navegação inferior e layout desktop com duas vistas. Capturas usam dados de teste, não dados da conta real.
