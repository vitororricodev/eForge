# Banco e acesso

As migrations `20261002200000` e `20261002201000` acrescentam identidade dos GIFs/classificação, índices únicos, estado de troca e RPCs. A migration anterior `20261002180000`, se pendente, fornece os campos de gestão reutilizados. O script manual aplica apenas etapas pendentes, confere pré-requisitos e registra o histórico. As migrations já existentes não foram reescritas.

RLS preserva exercícios privados do titular e públicos aprovados. Administração/importação é verificada também no servidor com `is_catalog_admin()`. Um admin do catálogo não lê os exercícios privados de terceiros. No Storage, prefixo oficial exige admin, não permite sobrescrita e protege objetos referenciados; prefixos pessoais preservam políticas existentes.

Aplicar schema não limpa dados. `activate_owned_gif_library` exige um manifesto completo validado pelo painel; confirma todos os hashes ativos/aprovados e os objetos com MIME/tamanho corretos, então remove itens oficiais antigos sem referências e arquiva os usados. Verifica as FKs de `workout_exercises` e `set_logs`; preserva IDs, sessões, séries e snapshots. Usuários e exercícios pessoais não entram na limpeza.

`owned_catalog_state` conserva data e contagens reais da troca. RPCs externas perdem execução para clientes e `service_role`; um guard impede reintroduzir a biblioteca antiga. Estruturas históricas de sincronização permanecem sem dependência operacional, evitando uma remoção de schema que prejudique instalações anteriores.

Relacionados: [[Arquitetura]], [[Biblioteca]], [[Manutencao]].
