# Validação — alerta de fim do descanso

06/10/2026. Implementação em `src/lib/rest-audio.ts`, integrada ao controle existente em `/run/$workoutId`. Não há SQL, migration, dependência ou asset de áudio novo. Nenhuma publicação foi realizada.

## Alteração

O bip anterior era senoidal, de 440Hz e 0,25s. Agora são seis bipes de onda quadrada, alternando 1.000/1.400Hz, com ganho de 0,95 e duração total de aproximadamente 2s. Rampas de entrada/saída evitam mudanças instantâneas de amplitude. O último bip é mais longo. A melhoria de presença vem do timbre, das frequências e da repetição; não há medição de volume acústico na academia nem promessa de ganho em decibéis.

O AudioContext é criado/retomado dentro do toque em “Som no descanso”, respeitando as [práticas de reprodução de áudio no navegador](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices). Ele é reutilizado durante o treino. Silenciar, finalizar ou sair cancela os tons; sair fecha o contexto. Pedidos de retomada atrasados são descartados quando a opção foi desligada, a tela foi desmontada ou passaram mais de 1s desde o pedido. Falhas ou ausência de Web Audio não interrompem o treino.

Som continua opcional e desligado inicialmente. Cálculo do descanso por horário final, vibração, botões de −15s/+15s/pular, séries, rascunho, sincronização, estilo e áudio da intro permanecem existentes.

## Conferências locais

Chromium com aplicação real servida pelo Vite, dados de teste e chamadas externas interceptadas. Nenhuma chamada chegou ao Supabase real. Resultados: [renderização e controles](resultado.json), [log do alerta final](alerta.log) e [regressão de treino](treino.log).

- Renderização do código real com OfflineAudioContext em 44,1/48/96kHz: seis tons, duração de aproximadamente 1,995s e pico entre 0,937 e 0,950, abaixo do limite digital de 1. Cancelamento imediato gera silêncio.
- Opção desativada: descanso termina e vibra, sem criar contexto nem tocar.
- Opção ativada pelo toque: contexto real entra em execução; cada fim de descanso agenda uma sequência, sem repetições adicionais após o timer zerar.
- Descansos seguintes reutilizam o mesmo contexto. Desativar cancela os tons em execução e futuros.
- Pular descanso não toca. Sair cancela a sequência e fecha o contexto, preservando a sessão e os cinco exercícios.
- Ausência da API, recusa da criação, rejeição da retomada e retomada pendente após silenciar/sair não causam erro de execução nem playback obsoleto.
- `tests/workout-run-browser.mjs` passou nas rotas reais: campos, vírgula decimal, concluir/desfazer, descanso, histórico/tipo, adicionar/remover, substituição, offline/retomada, recuperação de exercícios, concorrência entre abas, snapshot, finalização e mapa. Conferência em 320–1440px sem transbordamento e com controles confortáveis. [Captura de treino, 390px](treino-mobile.png).

Verificações do projeto passaram: `npm test` (doze suítes), `npm run typecheck`, ESLint nos dois arquivos TypeScript alterados, `npm run build` e `npm run build:mobile`. Os logs acompanham esta pasta. Builds usam configuração pública fictícia de teste; artefatos compilados não acompanham o código.

## Conferência no aparelho

Ative “Som no descanso”, ajuste o volume de mídia e conclua uma série. Ao zerar o descanso, confira os seis bipes e a vibração. Desative durante o alerta, teste pular e sair. A audibilidade final depende do alto-falante/fone, do volume de mídia e do ruído ambiente. Teste também o comportamento ao bloquear o celular: navegador/sistema podem suspender áudio. Esta validação local não mede volume físico nem garante reprodução em segundo plano.
