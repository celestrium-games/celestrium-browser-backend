const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { BareServer } = require('@tomphttp/bare-server-node');

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

// ── UV CONFIG ──────────────────────────────────────────────────────────────
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
const bareServer = new BareServer('/bare/');

server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

server.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
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
