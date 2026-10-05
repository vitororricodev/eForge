# Perfil

`/body-profile` mantém tabelas e campos existentes. `save_body_profile` é SECURITY INVOKER, deriva ID de `auth.uid()`, valida limites e faz upsert com RETURNING. A tela verifica o ID retornado, mostra erro em falhas e só confirma quando o banco devolve o registro. Não altera papéis, conta Auth, e-mail ou histórico de medidas.

A migration `20261003150000` converte `male/female/other` em `masculino/feminino/outro` e corrige `profiles_sex_check` para os valores que o formulário já utiliza. A conversão preserva `updated_at`; o trigger de atualização é desabilitado e reabilitado apenas durante essa conversão transacional.

`decimalNumber` aceita ponto ou vírgula e rejeita texto parcial. A correção de 05/10/2026 adiciona `heightCentimeters`: `1,85`, `1.85` e `185` viram 185 cm, tanto no cálculo quanto antes de chamar a RPC. Alturas fora de 80–260 cm são rejeitadas. `calculateBMI` usa peso/(altura em metros)²; `formatBodyNumber` apresenta vírgula, uma casa e sem agrupamento de milhares. O diálogo recalcula a cada edição, sem salvar o IMC como campo independente. Após salvar, o perfil é consultado novamente. O botão de editar aguarda carregamento para evitar que a resposta inicial apague uma edição iniciada antes da consulta.

`effectiveWeight` considera a medida mais recente que contém peso. Uma medida com data anterior à atualização do perfil não oculta o peso salvo no perfil; no mesmo dia, utiliza o momento de registro. A comparação de timestamps considera o fuso; datas de medidas são interpretadas como datas locais. O formulário começa com o peso efetivamente mostrado, evitando salvar um peso antigo ao editar apenas altura/objetivo.

`BMIResult` é compartilhado pelo resumo e diálogo. `classifyBMI` usa o valor completo e a idade, indicando abaixo/na faixa/acima. `getBMIReference` utiliza SISVAN: de 20 a 59 anos, ≥18,5 e <25; com 60+, >22 e <27. `bmiWeightRange` deriva os limites de kg por IMC × altura², exibindo-os como aproximação. Sexo e objetivo não inventam outra faixa adulta; objetivo perder peso com IMC abaixo da faixa recebe orientação de revisão. Para <20 anos, o IMC numérico permanece, e a classificação por curvas/idade em meses não é calculada sem os dados necessários.

Não foi criado diagnóstico, plano alimentar ou meta individual de peso/IMC. A tela informa a limitação de composição corporal e oferece a fonte oficial. O perfil da aba Perfil continua abrindo este formulário. Não há SQL novo para a correção de IMC; a estrutura e a RPC do fechamento são preservadas.

Validação: caso 55 kg/1,85 m/26 anos →16,1, metros/centímetros, fronteiras por idade, faixa em kg, vírgula, peso antigo/recente, ausência de dados, IMC durante edição, erro sem fechar o formulário, upsert, save/reload e isolamento de conta. Capturas novas: `validation/imc-20261005/`; as do fechamento anterior permanecem em `validation/fechamento/`. Guia: [Atualização de IMC](../ATUALIZACAO-IMC.md).

Relacionados: [[Banco-e-acesso]], [[Arquitetura]], [[Treinos]].
