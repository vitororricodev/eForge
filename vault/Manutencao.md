# Manutenção

Use `/admin/exercises` para importar CSV/JSON com ZIP/pasta, por categoria ou todos. Pausar termina o arquivo atual; repetir retoma por hashes/objetos. Baixe os relatórios para confirmar erros, ausências, contagens e revisões. Não substitua o catálogo antigo enquanto faltarem entradas do manifesto completo.

Buscar, filtrar, selecionar página/todos os resultados, editar, ativar/inativar, excluir/restaurar são ações reais. Exclusão normal é reversível e não destrói histórico. `Excluir todos` exige confirmação textual e nunca apaga exercícios de usuário. Para mudar um GIF, importe nova versão e arquive a anterior.

Para GIFs novos, `catalog:prepare` gera manifesto sem inventar músculos. Para verificar o pacote local, `catalog:import -- --manifest ... --folder ... --dry-run`. O painel não exige service role nem token externo. O CLI autenticado usa uma sessão admin temporária; nunca publique esse token.

Se a lista não carregar, confira configuração pública, login e migrations novas. Se o importador recusar um arquivo, compare caminho, tamanho e hash ao CSV; não altere o hash para encobrir um arquivo diferente. Se o SQL recusar schema parcial, corrija a etapa indicada antes de continuar. Não reaplique o antigo `ADD COLUMN source`.

Após ativação confirmada, remova as antigas funções/Secrets exclusivos no Supabase e confira jobs remotos. Nenhum serviço remoto foi alterado nesta entrega. Passos completos e limites: [Guia](../BIBLIOTECA-EFORGE.md). Execute testes, typecheck e builds antes de publicar.

Para atualizar a marca, use os mestres F Forjado documentados em [[Identidade-visual]]; não recrie o lettering com fonte. As exportações PNG acompanham o código e podem ser regeneradas pelo utilitário indicado. O cache de marca tem versão própria; atualização preserva sessão e rascunhos e continua bloqueada durante treino ativo. Não limpe dados do navegador para atualizar a logo.

Para exercícios que sumiram em sessão ativa, a versão de 05/10/2026 recupera a lista inicial local; rascunhos anteriores são conferidos ao reconectar. Preserve o rascunho e não limpe dados do navegador como primeira medida. Se persistir, registre versão instalada, quantidade de exercícios do plano/sessão, horário e se ocorreu retorno de suspensão, offline ou uso de outra aba. Não exponha tokens ou informações pessoais. [Correção e limites](../CORRECAO-TREINO-EXERCICIOS.md) e testes de regressão acompanham o projeto.
