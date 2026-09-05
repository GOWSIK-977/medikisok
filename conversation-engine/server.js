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

// BASE_GATEWAY_URL points to local mock route right now.
// To switch to official government NHA ABDM Gateway when credentials arrive, update to 'https://abdm.gov.in'
const BASE_GATEWAY_URL = 'http://localhost:4000/api/validate-abha';

const mockRegistry = [
  { abhaNumber: "11223344556677", abhaAddress: "alex@sbx", name: "Alex Johnson", age: 32, gender: "male", status: "ACTIVE" },
  { abhaNumber: "99887766554433", abhaAddress: "priya@sbx", name: "Priya Sharma", age: 28, gender: "female", status: "ACTIVE" },
  { abhaNumber: "55555555555555", abhaAddress: "test@sbx", name: "Test User", age: 40, gender: "male", status: "SUSPENDED" },
  { abhaNumber: "91786767244217", abhaAddress: "navaneethanrs_18@abdm", name: "Navaneethan R S", age: 24, gender: "male", status: "ACTIVE" }
];

app.post('/api/validate-abha', (req, res) => {
  const rawInput = req.body.input || req.body.abhaId || req.body.abhaNumber || req.body.abhaAddress || "";
  if (!rawInput || typeof rawInput !== 'string') {
    return res.status(400).json({ valid: false, message: "ABHA ID or Address input is required" });
  }
  const cleanedInput = rawInput.replace(/[-\s]/g, "").trim().toLowerCase();
  const matchedProfile = mockRegistry.find((profile) => {
    const cleanNum = profile.abhaNumber.replace(/[-\s]/g, "").trim().toLowerCase();
    const cleanAddr = profile.abhaAddress.trim().toLowerCase();
    return cleanedInput === cleanNum || cleanedInput === cleanAddr;
  });

  if (matchedProfile) {
    if (matchedProfile.status === "ACTIVE") {
      return res.json({
        valid: true,
        message: "Valid Original Card Checked",
        profile: {
          abhaNumber: matchedProfile.abhaNumber,
          abhaAddress: matchedProfile.abhaAddress,
          name: matchedProfile.name,
          age: matchedProfile.age,
          gender: matchedProfile.gender,
          status: matchedProfile.status
        }
      });
    } else {
      return res.status(400).json({ valid: false, message: `ABHA Card status is ${matchedProfile.status}` });
    }
  }

  return res.status(404).json({ valid: false, message: "Invalid ABHA ID or Address. Lookup failed." });
});

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
