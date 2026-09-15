# eForge 1.2.0

Site mobile em React/TanStack Start + Supabase. Preto, roxo e branco.

## Instalação

1. `npm ci`
2. Copie `.env.example` para `.env` e informe os valores públicos do seu projeto.
3. Aplique `supabase/migrations/20260914191455_eforge_mobile.sql` no SQL Editor do MESMO projeto que possui as tabelas anteriores. Essa migração é necessária para a sincronização, mapa atualizado e tipos de série.
4. `npm run dev` para desenvolvimento; `npm run build` para produção. A publicação usa o adaptador do TanStack/Nitro existente. Não publicar apenas uma pasta aleatória como site estático.
5. Use HTTPS na publicação. PWA e service worker são ativados em produção. Abra o dashboard online antes de testar offline; telas/assets ainda não visitados podem exigir internet.

## Implementado

- Identidade eForge e tema preto/roxo/branco; títulos esportivos inclinados.
- Manifesto, ícones, instalação, atualização manual e fallback offline.
- Rascunho local por ID do usuário; recuperação da sessão; fila de sincronização da sessão com UUID estável.
- Snapshot transacional no banco com validação de titularidade dos exercícios e treino.
- Salvamento automático de séries, decimal com vírgula, valores anteriores, adicionar/remover séries, tipo da série, substituir exercício.
- Descanso por horário final, +15/−15 segundos, pular, vibração e som opcionais (sujeitos às permissões do navegador).
- Cinco entradas na navegação, menu oculto durante execução, confirmação ao sair, campos maiores, redução de animações.
- Catálogo visual unificado de 11 medalhas; primeiro/dez treinos concedidos na finalização.
- Mapa sem dados fictícios, baseado em séries concluídas de sessões finalizadas: principal 1, secundários 0,4; aquecimento excluído; 1/7/30 dias.
- RLS adicional de validação dos pais nas relações de treinos/séries/sessões.

## Tipografia

Forega Sport DEMO incorporada em TTF, com licença original em public/fonts. Aplicada à marca e títulos; formulários e números usam fonte de leitura. Caracteres ausentes na demo usam fallback. Licença recebida permite uso pessoal; para uso comercial, obtenha a licença completa do autor.

## Limites e validação no dispositivo

A sincronização exige a migração aplicada. O código foi validado localmente; nenhum banco remoto foi alterado. Não há garantia de som/vibração com tela bloqueada. Armazenamento do navegador pode ser apagado pelo sistema/usuário; sincronize quando possível. O rascunho suporta uma sessão ativa por conta neste aparelho; não há resolução de edição simultânea entre aparelhos. Dados privados de API não entram no cache do service worker. Rascunhos permanecem separados por usuário no armazenamento local (não são criptografia contra quem controla fisicamente o dispositivo).

Ainda não incluídos: onboarding, biblioteca inicial, cronograma semanal, notificações push, histórico completo por exercício com gráficos/PRs, todas as medalhas automáticas, exportação de dados e testes em celulares físicos. Não considerar publicação concluída somente por compilar.

Teste: usuário A cria sessão, fecha e reabre; usuário B não vê sessão A; retornar a A recupera; registrar offline/reconectar não duplica sessão; bloquear tela e retornar recalcula descanso; conferir teclado, safe areas e atualização instalada no Android/iPhone.

## Verificação realizada

`npm run build` e `npm run typecheck` passaram. Testes locais com PGlite validaram RLS com duas contas, retries sem duplicação e rollback; testes do armazenamento validaram separação por usuário, vírgula decimal e temporizador suspenso. Execute `npm test`. Não houve teste em aparelho real nem aplicação da migração remota.

## Identidade visual 1.2.0

A identidade agora é compartilhada por todas as rotas: fundo preto, superfícies grafite, destaque roxo e texto branco. Marca vetorial em public/brand/eforge-mark.svg e componente Brand reutilizado. Ícones PWA e favicon seguem o mesmo símbolo. Forega nos títulos/marca, fonte de leitura nos dados. Cards de 12–16 px de raio, botões com área de toque ampliada, navegação fixa de cinco itens e estados ativos uniformes.

Autenticação e boas-vindas usam a marca única. Dashboard recebeu cards de destaque; execução recebeu acabamento de descanso/séries e resumo com troféu; perfil recebeu avatar de iniciais. Conquistas têm 11 símbolos diferenciados em medalhões roxos/cinza, com estado bloqueado identificado. Mapa mantém geometria vetorial própria e ganhou contraste/contornos. Exercícios sem mídia mostram uma miniatura do grupo muscular, não uma demonstração de execução.

Não é uma reprodução pixel a pixel das imagens geradas: anatomia, ícones e imagens são os componentes reais do projeto. Não foram inventados dados de treino para preencher as telas. O navegador de validação bloqueou localhost; revisão visual em celular real ainda é necessária. Alterações deste pacote são locais; a versão publicada não foi atualizada.
