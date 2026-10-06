# Hotfix Vercel — Teko / Lightning CSS

## Causa
O `@import url("https://fonts.googleapis.com/...")` em `src/styles.css` era processado pelo pipeline CSS do Vite/Lightning CSS e resultava em `ENOENT`, como se a URL fosse um arquivo local.

## Correção
- Remove o `@import` remoto de `src/styles.css`.
- Carrega Teko 600/700 no `<head>` via TanStack Router em `src/routes/__root.tsx`.
- Atualiza `capacitor.html` para usar a mesma Teko.
- Na versão deste hotfix, `Forega Sport` era restrita à logo. Em 06/10/2026, foi substituída pelos SVG F Forjado, sem alterar Teko nem reintroduzir o import remoto no CSS. Aplicação atual: [Identidade visual](vault/Identidade-visual.md).

## Validação rápida
```bash
npm run build
```
