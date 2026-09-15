import fs from 'fs';
import path from 'path';

const distClient = path.resolve('dist/client');
const assetsDir = path.join(distClient, 'assets');

function findFile(prefix) {
  const files = fs.readdirSync(assetsDir);
  const match = files.find(f => f.startsWith(prefix) && f.endsWith('.js'));
  return match ? `assets/${match}` : null;
}

function findCssFile() {
  const files = fs.readdirSync(assetsDir);
  const match = files.find(f => f.startsWith('styles') && f.endsWith('.css'));
  return match ? `assets/${match}` : null;
}

const runtimeJs = findFile('index-BR9H2IWa');
const appJs = findFile('index-DwfCIhxh'); // root route entry
const stylesCss = findCssFile();

const scripts = [];
if (runtimeJs) scripts.push(`<script type="module" src="${runtimeJs}"></script>`);
if (appJs) scripts.push(`<script type="module" src="${appJs}"></script>`);

const cssLink = stylesCss ? `<link rel="stylesheet" href="${stylesCss}" />` : '';

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
  <meta name="theme-color" content="#000000" />
  <meta name="color-scheme" content="dark" />
  <meta name="format-detection" content="telephone=no" />
  <title>PersonaFit</title>
  <meta name="description" content="App fitness premium com mapa muscular, treinos personalizados e evolução corporal." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" />
  ${cssLink}
  <style>
    html, body { background: #000; }
    #root { min-height: 100dvh; }
  </style>
</head>
<body>
  <div id="root"></div>
  ${scripts.join('\n  ')}
</body>
</html>`;

fs.writeFileSync(path.join(distClient, 'index.html'), html);
console.log('✅ Mobile index.html generated at dist/client/index.html');
