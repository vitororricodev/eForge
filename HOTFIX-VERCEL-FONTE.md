# Hotfix Vercel — Teko / Lightning CSS

## Causa
O `@import url("https://fonts.googleapis.com/...")` em `src/styles.css` era processado pelo pipeline CSS do Vite/Lightning CSS e resultava em `ENOENT`, como se a URL fosse um arquivo local.

## Correção
- Remove o `@import` remoto de `src/styles.css`.
- Carrega Teko 600/700 no `<head>` via TanStack Router em `src/routes/__root.tsx`.
- Atualiza `capacitor.html` para usar a mesma Teko.
- Mantém `Forega Sport` somente em `.eforge-wordmark` (logo eForge).

## Validação rápida
```bash
npm run build
```
