# Banco e acesso

As migrations `20261002200000` e `20261002201000` acrescentam identidade dos GIFs/classificação, índices únicos, estado de troca e RPCs. A migration anterior `20261002180000`, se pendente, fornece os campos de gestão reutilizados. O script manual aplica apenas etapas pendentes, confere pré-requisitos e registra o histórico. As migrations já existentes não foram reescritas.

RLS preserva exercícios privados do titular e públicos aprovados. Administração/importação é verificada também no servidor com `is_catalog_admin()`. Um admin do catálogo não lê os exercícios privados de terceiros. No Storage, prefixo oficial exige admin, não permite sobrescrita e protege objetos referenciados; prefixos pessoais preservam políticas existentes.

Aplicar schema não limpa dados. `activate_owned_gif_library` exige um manifesto completo validado pelo painel; confirma todos os hashes ativos/aprovados e os objetos com MIME/tamanho corretos, então remove itens oficiais antigos sem referências e arquiva os usados. Verifica as FKs de `workout_exercises` e `set_logs`; preserva IDs, sessões, séries e snapshots. Usuários e exercícios pessoais não entram na limpeza.

`owned_catalog_state` conserva data e contagens reais da troca. RPCs externas perdem execução para clientes e `service_role`; um guard impede reintroduzir a biblioteca antiga. Estruturas históricas de sincronização permanecem sem dependência operacional, evitando uma remoção de schema que prejudique instalações anteriores.

A migration `20261003150000` adiciona ordem dos treinos, `workout_shares` e `workout_share_imports`, as RPCs de edição/ordem/compartilhamento/importação e o upsert corporal. Corrige a incompatibilidade entre o CHECK antigo de sexo e o formulário existente. O SQL manual novo em `maintenance/20261003150000_workout_sharing_order_profile_manual.sql` aplica apenas esta atualização, verifica pré-requisitos, registra a versão, aceita reaplicação completa e rejeita schema parcial.

RLS dos treinos/exercícios existentes permanece. O dono cria uma cópia pública por ação explícita; o público não consulta tabelas privadas. Shares têm leitura de metadados apenas pelo dono e não permitem DML do cliente. A RPC pública limita campos à cópia autorizada; a importação confere sessão, permissões atuais, substituições somente para indisponíveis e link ativo. Retry usa registro privado de pedido e gravação atômica. A edição mantém UUIDs dos itens. Nenhuma nova tabela paralela de exercícios ou exposição de perfil foi criada.

O ambiente de testes concede privilégios padrão antes das migrations, para que REVOKE/GRANT da aplicação sejam respeitados; não volta a liberar tabelas protegidas depois de migrar. Duas contas, acesso anônimo, snapshots, rejeições, rollback, revogação, importação e upsert são exercitados em PostgreSQL local.

Relacionados: [[Arquitetura]], [[Biblioteca]], [[Manutencao]], [[Compartilhamento]], [[Perfil]], [[Treinos]].
