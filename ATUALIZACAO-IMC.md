# eForge — altura, IMC e referência do perfil

Correção de 05/10/2026 sobre a `main` `b711b0f`. Preserva compartilhamento, organização de treinos, catálogo próprio, avatar, autenticação e histórico.

## O que mudou

O campo antigo dizia centímetros e tratava `1.85` como `1,85 cm`. O IMC de 55 kg ficava 10.000 vezes maior. Não era apenas a posição da vírgula: a altura estava na unidade errada.

- **Altura (m ou cm)** aceita `1,85`, `1.85` e `185`. Todos representam 185 cm. A tela explica o formato e mantém o schema/RPC existentes em centímetros; não grava metros em `height_cm`.
- IMC aparece com vírgula decimal brasileira, uma casa e sem separador de milhar, no formulário e no resumo salvo. O valor completo é usado na classificação; o número exibido é arredondado.
- A classificação indica **Abaixo do peso**, **Na faixa de referência** ou **Acima do peso**, com a categoria de sobrepeso/obesidade quando aplicável.
- **IMC desejável · referência** considera a idade e mostra o intervalo de IMC e o peso correspondente à altura. Esse intervalo é recalculado ao editar; não é um número de meta inventado por sexo ou objetivo fitness.
- Para adultos de 20–59 anos, usa IMC ≥18,5 e <25. Para 60+, usa >22 e <27 (SISVAN). Os limites superiores são exclusivos, como indicado na tela. A faixa de peso é aproximada pelo arredondamento da apresentação.
- Para menores de 20 anos, mostra o IMC numérico e explica que a classificação exige idade em meses e curvas de crescimento. O perfil atual não fornece esses dados completos; a tabela adulta não é aplicada automaticamente.
- Se o IMC estiver abaixo da faixa e o objetivo for perder peso, aparece uma orientação para revisar o objetivo com profissional de saúde. O objetivo não é alterado automaticamente.
- A interface informa que IMC não distingue massa muscular de gordura e que a faixa de referência não define uma meta individual.

**Caso da captura:** 55 kg ÷ (1,85 m)² = 16,070124… → **16,1**. Aos 26 anos, a classificação é abaixo do peso; a faixa de referência corresponde aproximadamente a **63,3–85,6 kg**, com os limites exatos calculados antes de arredondar.

## Aplicar

Copie o código completo sobre seu projeto ou extraia em outra pasta, preservando `.env` e Git. Ao copiar sobre uma versão antiga, rode `scripts/remove-legacy-catalog.ps1`: ele move somente os caminhos de `ARQUIVOS-LEGADOS.json` para um backup fora do projeto. A main tinha reintroduzido 11 desses arquivos, e eles quebravam typecheck e testes. Esta entrega já os remove do pacote; migrations históricas e documentos em `docs/LEGADO/` permanecem.

**Esta correção não exige SQL nem migration nova.** A RPC `save_body_profile` e a migration `20261003150000` do fechamento anterior permanecem. Se o perfil já salva no seu Supabase, não é preciso reaplicar esse SQL nem alterar dados manualmente.

Use `npm ci`, `npm test`, `npm run typecheck`, `npm run build` e `npm run build:mobile` no ambiente de destino. Nenhum push, deploy ou banco remoto foi executado nesta correção.

## Arquitetura e regras aplicadas

`heightCentimeters`, cálculo, classificação, formatação e faixa derivada ficam em `src/lib/body-profile.ts`. `BMIResult` é reutilizado no formulário e no resumo, evitando regras diferentes entre as duas telas. Reutiliza React, Tailwind, Lucide, Radix e as validações/RPC existentes, sem dependências novas. Mantém Teko na interface e Forega na marca, layout mobile, foco e descrições acessíveis. Segue as instruções de arquitetura, frontend, UI/design system e validação visual; documentação atualizada em `vault/Perfil.md` e `vault/Arquitetura.md`.

## Verificação

Testes cobrem o caso da captura, vírgula/ponto, alturas em metros/centímetros, limites inválidos, classificação nas fronteiras, faixa por idade, referência em kg e pesos de medidas antigas. O teste de navegador usa as rotas reais e PostgreSQL local, salva a altura em cm, recarrega, verifica classificação/referência, testa erros de gravação e confere telas de 320px, 390px e desktop. Mantém os testes do compartilhamento e da organização.

Resultados e capturas: `validation/imc-20261005/`. Dados são de teste; nenhum registro remoto foi lido ou modificado. Instalação física Android/iOS não foi executada. Pendências históricas do lint global continuam no relatório do fechamento anterior; os arquivos de código desta correção são verificados separadamente.

## Critérios consultados

- [INCA / Ministério da Saúde — Peso corporal](https://www.gov.br/inca/pt-br/assuntos/causas-e-prevencao-do-cancer/peso-corporal/peso-corporal): fórmula e faixa para adultos.
- [Ministério da Saúde — Orientações básicas do SISVAN](https://bvsms.saude.gov.br/bvs/publicacoes/orientacoes_basicas_sisvan.pdf): tabelas de adultos e idosos (incluindo os limites ≤22 e ≥27).
- [Ministério da Saúde — Orientações para a coleta e análise de dados antropométricos](https://www.gov.br/saude/pt-br/composicao/saps/vigilancia-alimentar-e-nutricional/arquivos/orientacoes-para-a-coleta-e-analise-de-dados-antropometricos-em-servicos-de-saude/view): avaliação por fase da vida.

Consultados em 05/10/2026. Os critérios são uma referência populacional; o aplicativo não calcula dieta, diagnóstico ou prescrição individual a partir do IMC.
