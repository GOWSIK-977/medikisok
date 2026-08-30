require('dotenv').config();
const express = require('express');
const documentRoutes = require('./src/routes/documents');
const summaryRoutes = require('./src/routes/summary');

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Base64 images can be sizeable - raise the JSON body limit.
app.use(express.json({ limit: '10mb' }));

app.use('/api/documents', documentRoutes);
app.use('/api/summary', summaryRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`MediKiosk document engine listening on port ${PORT}`);
});
