#!/usr/bin/env node
// Собирает dist/demo.html — один самодостаточный файл: всё приложение работает в браузере (данные в localStorage).
const fs = require('fs'), path = require('path');
const P = f => fs.readFileSync(path.join(__dirname, 'public', f), 'utf8');
const safe = js => js.replace(/<\/script/gi, '<\\/script');
let html = P('index.html')
  .replace('<link rel="manifest" href="manifest.webmanifest">', '')
  .replace('<link rel="stylesheet" href="styles.css">', () => '<style>' + P('styles.css') + '</style>')
  .replace('<script src="core.js"></script>', () => '<script>window.ECO_FORCE_LOCAL=true;\n' + safe(P('core.js')) + '</script>')
  .replace('<script src="xlsx.js"></script>', () => '<script>' + safe(P('xlsx.js')) + '</script>')
  .replace('<script src="qr.js"></script>', () => '<script>' + safe(P('qr.js')) + '</script>')
  .replace('<script src="app.js"></script>', () => '<script>' + safe(P('app.js')) + '</script>');
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'demo.html'), html);
console.log('dist/demo.html', Math.round(html.length / 1024), 'KB');
