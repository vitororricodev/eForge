# Manutenção

Use `/admin/exercises` para importar CSV/JSON com ZIP/pasta, por categoria ou todos. Pausar termina o arquivo atual; repetir retoma por hashes/objetos. Baixe os relatórios para confirmar erros, ausências, contagens e revisões. Não substitua o catálogo antigo enquanto faltarem entradas do manifesto completo.

Buscar, filtrar, selecionar página/todos os resultados, editar, ativar/inativar, excluir/restaurar são ações reais. Exclusão normal é reversível e não destrói histórico. `Excluir todos` exige confirmação textual e nunca apaga exercícios de usuário. Para mudar um GIF, importe nova versão e arquive a anterior.

Para GIFs novos, `catalog:prepare` gera manifesto sem inventar músculos. Para verificar o pacote local, `catalog:import -- --manifest ... --folder ... --dry-run`. O painel não exige service role nem token externo. O CLI autenticado usa uma sessão admin temporária; nunca publique esse token.

Se a lista não carregar, confira configuração pública, login e migrations novas. Se o importador recusar um arquivo, compare caminho, tamanho e hash ao CSV; não altere o hash para encobrir um arquivo diferente. Se o SQL recusar schema parcial, corrija a etapa indicada antes de continuar. Não reaplique o antigo `ADD COLUMN source`.

Após ativação confirmada, remova as antigas funções/Secrets exclusivos no Supabase e confira jobs remotos. Nenhum serviço remoto foi alterado nesta entrega. Passos completos e limites: [Guia](../BIBLIOTECA-EFORGE.md). Execute testes, typecheck e builds antes de publicar.
