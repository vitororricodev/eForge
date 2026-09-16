# eForge 1.3.0

Site mobile em React/TanStack Start + Supabase. Preto, roxo e branco.

## Instalação

1. `npm ci`
2. Copie `.env.example` para `.env` e informe os valores públicos do seu projeto.
3. Aplique as migrations pendentes em ordem, incluindo `supabase/migrations/20260914191455_eforge_mobile.sql` e `supabase/migrations/20260916093000_muscle_tertiary.sql`, no MESMO projeto Supabase. A migration de 16/09 adiciona músculos terciários a exercícios/séries e atualiza o snapshot do treino.
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
- Mapa muscular vetorial masculino/feminino, frente/costas, com normalização dos nomes em português. Séries concluídas usam papel principal (1), secundário (0,55) e terciário (0,25); aquecimento é excluído; período 1/7/30 dias. Durante o treino, o mapa ao vivo reage imediatamente às séries marcadas como concluídas.
- RLS adicional de validação dos pais nas relações de treinos/séries/sessões.


## Atualização do mapa muscular — 2026-09-16

- Corrigida a causa do mapa não acender: os exercícios armazenavam músculos em português, enquanto o SVG anterior esperava chaves internas em inglês. A nova camada `muscle-activity.ts` normaliza os dois formatos.
- Novo avatar vetorial com versões masculina/feminina e vistas frente/costas; o sexo do perfil define o padrão e a tela permite troca manual.
- Cores por função muscular: principal, secundária e terciária, com brilho acumulado conforme séries concluídas.
- Mapa compacto em tempo real dentro da execução do treino; marcar/desmarcar uma série atualiza o corpo imediatamente.
- Cadastro/edição de exercício passa a aceitar músculos terciários, sem permitir duplicar o mesmo músculo entre principal/secundário/terciário.
- Diálogos e alertas ganharam gutter lateral responsivo e `gap` consistente entre ações; telas muito estreitas reduzem formulários de duas colunas para uma.
- Teko Bold passa a ser a fonte global; Forega Sport DEMO fica restrita ao wordmark `eForge`.

## Tipografia

Forega Sport DEMO permanece exclusivamente no wordmark `eForge`. O restante da interface usa Teko Bold (Google Fonts), incluindo títulos, formulários e números, com suporte aos acentos do português. Caso a fonte remota ainda não esteja disponível, o app usa fallback de sistema.

## Limites e validação no dispositivo

A sincronização exige a migração aplicada. O código foi validado localmente; nenhum banco remoto foi alterado. Não há garantia de som/vibração com tela bloqueada. Armazenamento do navegador pode ser apagado pelo sistema/usuário; sincronize quando possível. O rascunho suporta uma sessão ativa por conta neste aparelho; não há resolução de edição simultânea entre aparelhos. Dados privados de API não entram no cache do service worker. Rascunhos permanecem separados por usuário no armazenamento local (não são criptografia contra quem controla fisicamente o dispositivo).

Ainda não incluídos: onboarding, biblioteca inicial, cronograma semanal, notificações push, histórico completo por exercício com gráficos/PRs, todas as medalhas automáticas, exportação de dados e testes em celulares físicos. Não considerar publicação concluída somente por compilar.

Teste: usuário A cria sessão, fecha e reabre; usuário B não vê sessão A; retornar a A recupera; registrar offline/reconectar não duplica sessão; bloquear tela e retornar recalcula descanso; conferir teclado, safe areas e atualização instalada no Android/iPhone.

## Verificação realizada

Nesta atualização, os testes de armazenamento, mapa muscular e sinal da intro passaram; o teste novo confirma a conversão dos rótulos em português (`Peito`, `Costas`, `Trapézio`, etc.), a hierarquia principal/secundário/terciário e a exclusão de aquecimento do mapa ao vivo. Os arquivos TypeScript/TSX alterados também foram validados por transpilation/syntax check. O ambiente usado para esta revisão não conseguiu instalar as dependências completas do projeto, então `npm run build`, `npm run typecheck` e o teste PGlite devem ser executados novamente após `npm ci`. Não houve aplicação da migration remota nem teste final em aparelho físico.

## Identidade visual 1.2.0

A identidade agora é compartilhada por todas as rotas: fundo preto, superfícies grafite, destaque roxo e texto branco. Marca vetorial em public/brand/eforge-mark.svg e componente Brand reutilizado. Ícones PWA e favicon seguem o mesmo símbolo. Forega fica apenas no wordmark `eForge`; Teko Bold é a fonte da interface. Cards de 12–16 px de raio, botões com área de toque ampliada, navegação fixa de cinco itens e estados ativos uniformes.

Autenticação e boas-vindas usam a marca única. Dashboard recebeu cards de destaque; execução recebeu acabamento de descanso/séries e resumo com troféu; perfil recebeu avatar de iniciais. Conquistas têm 11 símbolos diferenciados em medalhões roxos/cinza, com estado bloqueado identificado. Mapa mantém geometria vetorial própria e ganhou contraste/contornos. Exercícios sem mídia mostram uma miniatura do grupo muscular, não uma demonstração de execução.

Não é uma reprodução pixel a pixel das imagens geradas: anatomia, ícones e imagens são os componentes reais do projeto. Não foram inventados dados de treino para preencher as telas. O navegador de validação bloqueou localhost; revisão visual em celular real ainda é necessária. Alterações deste pacote são locais; a versão publicada não foi atualizada.

## Abertura após login — 1.3.0

Animação de 3,7 segundos: bigorna e martelo vetoriais com acabamento metálico, três impactos (0,55 / 1,1 / 1,65 s), faíscas roxas e revelação de “Forjando a sua melhor versão!” a partir de 2,15 s. Os sons metálicos e o whoosh são sintetizados por Web Audio, sem arquivos externos. A arte vetorial segue a composição aprovada; não é o render 3D fotográfico da prancha conceitual.

A abertura ocorre após login por senha ou retorno do login Google iniciado pelo app. Não aparece a cada troca de página ou renovação de token. O sinal de exibição expira em 10 minutos e é consumido ao terminar/pular. A prévia não altera a autenticação. Som usa o gesto de login quando permitido; retorno OAuth pode exigir tocar “Ativar som”. Pular e Escape encerram e silenciam. Ao sair da aba, a abertura termina; não reproduz sons atrasados. Redução de movimento mostra apenas a mensagem por 1,4 s sem áudio.

### Testar só a animação, sem banco

1. `npm ci`
2. `npm run intro:dev`
3. Abrir `http://localhost:5174/intro-preview.html` (normalmente abre automaticamente).
4. Clicar em “Reproduzir com som”. É possível repetir quantas vezes quiser.

Essa prévia usa os mesmos componentes da abertura real. Não exige `.env`, Supabase nem login e não simula as outras telas. Para build isolado: `npm run intro:build`.

Validação: TypeScript, build da prévia, testes do sinal de login (conta, expiração, limpeza) e suíte existente. Validação visual/audio em celular físico ainda pendente; navegador remoto não alcança localhost neste ambiente.
