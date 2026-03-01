const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { createBareServer } = require('@tomphttp/bare-server-node');
const wisp = require('wisp-server-node');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// ── CORS — allow requests from your Vercel frontend ────────────────────────
app.use(cors({
  origin: [
    'https://celestrium-online-portal.vercel.app',
    /\.vercel\.app$/,
    'http://localhost:3000',
    'http://localhost:8000',
  ],
  credentials: true,
}));

// ── SERVE ULTRAVIOLET STATIC FILES ─────────────────────────────────────────
// UV needs its bundle, config, and service worker served as static files
const uvPath = require.resolve('@titaniumnetwork-dev/ultraviolet').replace('index.js', '');
app.use('/uv/', express.static(path.join(uvPath, 'dist')));

// ── SERVE YOUR OWN UV CONFIG ────────────────────────────────────────────────
// This tells UV where the service worker and bare server live
app.get('/uv/uv.config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
self.__uv$config = {
  prefix: '/uv/service/',
  bare: '/bare/',
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: '/uv/uv.handler.js',
  bundle: '/uv/uv.bundle.js',
  config: '/uv/uv.config.js',
  sw: '/uv/uv.sw.js',
};
  `.trim());
});

// ── BARE SERVER (handles proxied HTTP requests) ─────────────────────────────
const bareServer = createBareServer('/bare/');

server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

// ── WISP SERVER (handles WebSocket proxying) ────────────────────────────────
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/wisp/')) {
    wisp.routeRequest(req, socket, head);
  } else if (bareServer.shouldRoute(req)) {
    bareServer.routeUpgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});

// ── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'Celestrium Proxy Backend running', version: '1.0.0' });
});

// ── START ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Celestrium proxy backend listening on port ${PORT}`);
});
