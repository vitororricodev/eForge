# Validação — menu superior da Evolução

06/10/2026. A implementação reutiliza os componentes e tokens existentes, com links nas rotas atuais. Não modifica o menu inferior, banco, consultas ou funcionalidades das páginas.

## Navegação e layout

Chromium local, aplicativo real servido pelo Vite, autenticação/dados de teste e todas as chamadas externas interceptadas. Nenhum registro da conta real foi consultado ou alterado. Teko carregada pela mesma configuração de pesos usada pelo aplicativo.

77 conferências de rota/layout passaram:

- Seis opções na ordem Relatórios, Cardio, Medidas, Metas, Medalhas e Mapa muscular; menu único em cada tela.
- Navegação por cada opção e retorno por Relatórios em 320, 360, 390, 430 e 1440px.
- Um único item ativo, com `aria-current="page"` e fundo roxo; menu inferior mantém Evolução ativa.
- Entrada direta e recarga em todas as seis rotas; voltar/avançar acompanha a seleção.
- Deslize horizontal nativo no menu de 320px; acesso à última opção e retorno à primeira.
- Tab/Enter e foco visível; áreas de toque de pelo menos 44px, espaço de 8px e nomes sem truncamento.
- Rolagem horizontal restrita ao menu, sem transbordamento na página; opção ativa visível após navegar/redimensionar.
- Menu ausente nas telas de início, treinos, exercícios e perfil. A parte do código que renderiza o menu inferior foi comparada e permaneceu idêntica.
- Nenhum erro de execução ou chamada externa inesperada.

[Resultado das verificações](resultado.json).

## Verificações do projeto

- `npm test`: doze suítes existentes passaram.
- `npm run typecheck`: passou.
- ESLint nos três arquivos TSX alterados: zero erros. Permanece um aviso anterior de dependência do hook `user` em `reports.tsx`; o cálculo/consulta não foi modificado.
- `npm run build`: passou. [Log web](build-web.log).
- `npm run build:mobile`: passou. [Log mobile](build-mobile.log).

Os builds mantêm avisos anteriores do adaptador Cloudflare, diretivas de dependências e tamanho de chunk mobile. As variáveis públicas usadas na validação apontam para um projeto fictício de teste. Os artefatos compilados não acompanham o pacote de código.

## Capturas

- [Relatórios no celular, 390px](relatorios-mobile.png).
- [Cardio com opção ativa, 390px](cardio-mobile.png).
- [Mapa muscular com o menu, 320px](mapa-muscular-mobile.png).

Os dados das capturas são de teste. Esta conferência usa viewports mobile em Chromium; não substitui uma conferência no aparelho físico. Nenhuma publicação, commit, push ou execução de SQL foi realizada.
