# Correção de IMC — 05/10/2026

Nas capturas observo o resultado **16,1 kg/m²**, o texto **Abaixo do peso**, o intervalo desejável e o peso correspondente à altura, com vírgula brasileira e sem o número inflado da captura original. A interface mantém a marca Forega, Teko, grafite e roxo; a classificação usa texto e cor. A captura do diálogo mostra a rolagem necessária para alcançar o resultado e os botões ao final. Em 320px, textos longos quebram linha sem rolagem horizontal.

## Resultado verificado

- Caso original: 55 kg, altura `1,85`/`1.85`/`185`, 26 anos → IMC 16,1.
- Salvar pela RPC real em PostgreSQL local e recarregar conserva 55 kg, 185 cm e 26 anos, com classificação e referência no resumo. Metros não são gravados no campo de centímetros.
- Faixa adulta: ≥18,5 e <25, equivalente aproximadamente a 63,3–85,6 kg para 1,85 m. Faixa com 60+ e ausência de classificação adulta para adolescentes verificadas.
- Na faixa/acima/abaixo, alerta ao objetivo de perder peso com IMC baixo, limpeza da altura e erro de gravação sem falso sucesso verificados.
- `npm test`: onze suítes aprovadas. `npm run typecheck`, `npm run build` e `npm run build:mobile`: aprovados. ESLint dos três arquivos TS/TSX desta correção: zero erros/avisos; `git diff --check`: aprovado. Dívida antiga de lint global e avisos dos builds ficam nos relatórios anteriores e não são apresentados como resolvidos.
- `tests/workout-sharing-browser.mjs`: aprovado, rotas reais em Chromium a 390×844, 320×740 e 1440×1050; PostgreSQL local/PGlite, duas contas e HTTP interceptado. Conserva validação de arrastar/setas/teclado, salvar/recarregar/cancelar, compartilhamento, cópia com substituição seletiva, retry e revogação.
- O fixture usa JSON do PostgreSQL para reproduzir os números e datas do PostgREST. Nenhum banco remoto, GIF real ou provedor externo é acessado.
- Arquivos operacionais legados reintroduzidos na main foram movidos para backup externo conforme `ARQUIVOS-LEGADOS.json`. Sem essa limpeza prevista, typecheck e testes da biblioteca própria falhavam. Migrations históricas e `docs/LEGADO/` foram preservados.

## Capturas da correção

- [Formulário com altura em metros](imc-formulario-mobile.png)
- [IMC, classificação e referência no diálogo](imc-resultado-mobile.png)
- [Resumo após salvar e recarregar](imc-resumo-mobile.png)
- [Celular de 320px](imc-mobile-320.png)
- [Desktop](imc-desktop.png)

As demais capturas desta pasta registram a regressão de compartilhamento/organização. Resultado estruturado: [resultado.json](resultado.json). Dados são fixtures, não a conta de produção. Fontes e regras: [ATUALIZACAO-IMC.md](../../ATUALIZACAO-IMC.md).

## Reproduzir

Com servidor local e Chromium/Playwright disponíveis, execute `TEST_SCREENSHOTS=validation/imc-20261005 node tests/workout-sharing-browser.mjs`. O teste só aceita localhost/127.0.0.1, aborta endpoints externos desconhecidos e não altera serviços remotos. `TEST_BASE_URL`, `TEST_CHROMIUM_MODULE` e `TEST_TEKO_FONT` permitem as mesmas opções do fechamento anterior.

Não houve SQL novo, publicação ou validação em aparelho físico. O IMC continua sendo uma referência populacional; curvas para adolescentes e prescrição de meta individual não são calculadas com dados incompletos.
