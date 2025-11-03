// Servidor Node.js para chat futurista seguro e com layout bonito

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const sanitizeHtml = require('sanitize-html'); // Lembre-se de instalar: npm install sanitize-html

const rateLimitWindow = 3500; // 3.5 segundos entre mensagens
const msgMaxLen = 200;
const usernameMinLen = 3;
const usernameMaxLen = 18;

app.use(express.static('public'));

function sanitizeStrong(str, maxLen) {
  // Remove qualquer HTML e limita tamanho
  return sanitizeHtml((str || '').substring(0, maxLen), {
    allowedTags: [],
    allowedAttributes: {}
  }).replace(/[<>]/g, '');
}

const users = {}; // socket.id => username
const lastMsgTime = {}; // socket.id => timestamp

io.on('connection', socket => {
  let userName = '';

  socket.on('set username', name => {
    name = sanitizeStrong(name, usernameMaxLen);
    if (
      typeof name !== 'string' ||
      name.length < usernameMinLen ||
      name.length > usernameMaxLen
    ) {
      socket.emit('status', { type: 'authfail', msg: 'Nome inválido.' });
      socket.disconnect();
      return;
    }
    userName = name;
    users[socket.id] = userName;
    socket.broadcast.emit('status', { type: 'join', user: userName });
  });

  socket.on('chat message', msg => {
    if (!userName) return;

    // Rate limit simples
    const now = Date.now();
    if (lastMsgTime[socket.id] && now - lastMsgTime[socket.id] < rateLimitWindow) {
      socket.emit('status', { type: 'ratelimit', msg: 'Espere um pouco antes de enviar a próxima mensagem.' });
      return;
    }
    lastMsgTime[socket.id] = now;

    msg = sanitizeStrong(msg, msgMaxLen);
    if (!msg || typeof msg !== 'string' || msg.length < 1) return;

    // Anti-link simples
    msg = msg.replace(/https?:\/\/[^\s]+/gi, '[link removido]');

    io.emit('chat message', { user: userName, text: msg });
  });

  socket.on('disconnect', () => {
    if (userName) {
      socket.broadcast.emit('status', { type: 'leave', user: userName });
      delete users[socket.id];
      delete lastMsgTime[socket.id];
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});