require('dotenv').config();
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const sessionRoutes = require('./src/routes/session');
const { setupLiveProxy } = require('./src/ws/liveProxy');

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

app.use('/api/session', sessionRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

// Attach WebSocket proxy for Gemini Live API
const wss = new WebSocketServer({ server });
setupLiveProxy(wss);

server.listen(PORT, () => {
  console.log(`MediKiosk conversation engine listening on port ${PORT}`);
  console.log(`WebSocket Live proxy ready at ws://localhost:${PORT}/ws/live/:sessionId`);
});
