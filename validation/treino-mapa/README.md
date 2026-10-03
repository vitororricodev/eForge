# Validação de treino e mapa — 03/10/2026

Capturas das rotas reais no Chromium. Todos os dados/autenticação/HTTP são fixtures exclusivas dos testes; nenhum acesso ao Supabase real. Os números visíveis são ilustrativos nesta evidência e não foram fixados no código da aplicação.

- [Treino no celular](treino-mobile.png): resumo e descanso, sem o avatar antigo.
- [Séries no celular](treino-series-mobile.png): carga, repetições, conclusão, tipo e remoção.
- [Treino no desktop](treino-desktop.png).
- [Músculos treinados](mobile-treinados.png): primário forte e secundário suave, sem seleção.
- [Seleção no celular](mobile-frente.png): ciano preserva o roxo do músculo treinado.
- [Costas no celular](mobile-costas.png).
- [Detalhes e dados da semana](mobile-detalhes.png).
- [Frente e costas no desktop](desktop.png).
- [Mapa vazio](mobile-vazio.png).
- [Erro e opção de tentar novamente](mobile-erro.png).

Testes: `tests/workout-run-browser.mjs` e `tests/muscle-map-browser.mjs`. Passaram interação, papéis, links e viewports de 320 a 1440px sem rolagem horizontal. Ações da execução foram medidas com pelo menos 44px; o último controle fica acessível acima do rodapé ao rolar.

Inspeção visual confirmou a diferença entre roxo forte/suave, textura anatômica preservada, seleção ciano separada, séries legíveis, ações de descanso e botão de substituição com contraste. Após a inspeção foi corrigida a cor do texto do botão de substituição e as capturas foram refeitas.

Capturas não comprovam suporte físico a som/vibração nem uma importação remota de GIFs. O pacote não inclui logs de usuário real.
