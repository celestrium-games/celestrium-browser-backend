const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const wisp = require('wisp-server-node');
const { createBareServer } = require('@mercuryworkshop/bare-mux/node');

const app = express();
const server = http.createServer();
const PORT = process.env.PORT || 3000;

// ── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));

// ── UV STATIC FILES ────────────────────────────────────────────────────────
let uvDist;
try {
  uvDist = path.join(path.dirname(require.resolve('transport-core/package.json')), 'dist');
} catch {
  uvDist = path.join(__dirname, 'node_modules/transport-core/dist');
}
app.use('/uv/', express.static(uvDist));

// ── UV CONFIG (encoding handled client-side, server just serves the file) ──
app.get('/uv/uv.config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  const base = `${req.protocol}://${req.get('host')}`;
  res.send(`self.__uv$config = {
  prefix: '/uv/service/',
  bare: '${base}/bare/',
  handler: '/uv/uv.handler.js',
  bundle: '/uv/uv.bundle.js',
  config: '/uv/uv.config.js',
  sw: '/uv/uv.sw.js',
};`);
});

// ── BARE SERVER ────────────────────────────────────────────────────────────
const bareServer = createBareServer('/bare/');

server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

// ── WISP (WebSocket proxy) ─────────────────────────────────────────────────
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/wisp/')) {
    wisp.routeRequest(req, socket, head);
  } else if (bareServer.shouldRoute(req)) {
    bareServer.routeUpgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});

// ── HEALTH CHECK ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'running' });
});

// ── START ──────────────────────────────────────────────────────────────────
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));