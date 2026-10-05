# Perfil

`/body-profile` mantém tabelas e campos existentes. `save_body_profile` é SECURITY INVOKER, deriva ID de `auth.uid()`, valida limites e faz upsert com RETURNING. A tela verifica o ID retornado, mostra erro em falhas e só confirma quando o banco devolve o registro. Não altera papéis, conta Auth, e-mail ou histórico de medidas.

A migration `20261003150000` converte `male/female/other` em `masculino/feminino/outro` e corrige `profiles_sex_check` para os valores que o formulário já utiliza. A conversão preserva `updated_at`; o trigger de atualização é desabilitado e reabilitado apenas durante essa conversão transacional.

`decimalNumber` aceita ponto ou vírgula e rejeita texto parcial. `calculateBMI` usa peso/(altura em metros)² e retorna vazio quando falta um valor válido. O diálogo recalcula a cada edição, sem salvar o IMC como campo independente. Após salvar, o perfil é consultado novamente. O botão de editar aguarda carregamento para evitar que a resposta inicial apague uma edição iniciada antes da consulta.

`effectiveWeight` considera a medida mais recente que contém peso. Uma medida com data anterior à atualização do perfil não oculta o peso salvo no perfil; no mesmo dia, utiliza o momento de registro. A comparação de timestamps considera o fuso; datas de medidas são interpretadas como datas locais. O formulário começa com o peso efetivamente mostrado, evitando salvar um peso antigo ao editar apenas altura/objetivo.

Os limites e a classificação já existentes foram mantidos. Não foi criado diagnóstico, plano alimentar ou campo manual de IMC. O perfil da aba Perfil continua abrindo este formulário corporal.

Validação: vírgula, peso antigo, peso recente, ausência de dados, IMC durante edição, erro sem fechar o formulário, upsert sem linha anterior, save/reload e isolamento de conta em testes locais. Capturas: `validation/fechamento/`.

Relacionados: [[Banco-e-acesso]], [[Arquitetura]], [[Treinos]].
