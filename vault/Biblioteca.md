# Biblioteca

Fonte: `catalog/manifest_gifs_categorizados.csv`, 611 GIFs únicos, 14 aliases, oito categorias. `catalog/manifest.json` é a representação equivalente para importar. O ZIP classificado recebido é selecionado pelo administrador e não entra no bundle do aplicativo.

`source=eforge`, proprietário nulo, público, ativo e aprovado; exercícios personalizados mantêm `source=user`. Usam-se a tabela `exercises` e o bucket público existente `exercise-media`. Caminho oficial: `official/<categoria>/<subcategorias>/<slug>--<SHA-256>.gif`.

Hash único identifica conteúdo; slug único inclui categoria/nome/hash. A reimportação conserva edições e exclusões e evita novo upload quando o objeto íntegro já existe. GIFs são validados por bytes/assinatura/hash; o banco armazena paths/URLs e metadados.

Primário e secundários vêm do manifesto; terciários vazios. Anatomia real, confiança, notas, aliases e músculos sem região são preservados. Não existe inferência adicional nem tradução automática. Nove adutores ficam sem chave primária do avatar. A classificação inferida por nome ainda pode ser revisada pelo administrador.

Modalidade/tipo de controle não foram fornecidos: os defaults técnicos são `funcional`/`repeticoes` até revisão, separados da categoria de pasta. Equipamentos e instruções não fornecidos ficam vazios.

Relacionados: [[Banco-e-acesso]], [[Muscle-Map]], [[Manutencao]].
