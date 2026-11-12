#!/usr/bin/env node
/*
 * EcoWaste ATU — сервер (Node.js ≥ 18, без внешних зависимостей).
 * Запуск:  node server.js        → http://localhost:3000
 * Переменные: PORT, DATA_FILE (по умолчанию ./data/db.json), TZ (по умолчанию Asia/Almaty)
 */
'use strict';
process.env.TZ = process.env.TZ || 'Asia/Almaty';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const Core = require('./public/core.js');

const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'db.json');
const PUBLIC = path.join(__dirname, 'public');

// Пароли: PBKDF2-SHA256, 120 000 итераций, соль 16 байт. В открытом виде не хранятся.
function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const h = crypto.pbkdf2Sync(pw, salt, 120000, 32, 'sha256').toString('hex');
  return 'pbkdf2$' + salt + '$' + h;
}
function verifyPw(pw, stored) {
  if (!stored || !stored.startsWith('pbkdf2$')) return false;
  const [, salt, h] = stored.split('$');
  const calc = crypto.pbkdf2Sync(pw, salt, 120000, 32, 'sha256');
  return crypto.timingSafeEqual(calc, Buffer.from(h, 'hex'));
}

function load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { return null; }
}
function save(db) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DATA_FILE); // атомарная запись
}

if (process.argv.includes('--reset')) { try { fs.unlinkSync(DATA_FILE); } catch (e) { /* нет файла */ } console.log('Демо-данные будут сгенерированы заново.'); }

const core = Core.createCore({ load, save, hashPw, verifyPw, genToken: () => crypto.randomBytes(24).toString('hex') });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    if (req.method !== 'POST') return send(res, 405, { error: 'Только POST' });
    const method = url.pathname.slice(5);
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2e6) req.destroy(); });
    req.on('end', () => {
      let args = {};
      try { args = body ? JSON.parse(body) : {}; } catch (e) { return send(res, 400, { error: 'Неверный JSON' }); }
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      try {
        send(res, 200, core.call(method, args, token));
      } catch (e) {
        if (e instanceof Core.ApiError) return send(res, e.code, { error: e.message, extra: e.extra });
        console.error(e);
        send(res, 500, { error: 'Внутренняя ошибка сервера' });
      }
    });
    return;
  }
  // статика
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`EcoWaste ATU запущен: http://localhost:${PORT}`);
  Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal)
    .forEach(i => console.log(`  со смартфона в той же Wi-Fi сети: http://${i.address}:${PORT}`));
  console.log('Демо-логины: iskander@atu.kz / demo123 · reviewer@atu.kz / review123 · admin@atu.kz / admin123 · director@atu.kz / mgmt123');
});
