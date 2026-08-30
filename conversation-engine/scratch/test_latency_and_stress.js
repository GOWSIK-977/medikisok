require('dotenv').config();
const store = require('../src/session/sessionStore');
const WebSocket = require('ws');

const testPhrases = [
  'I have a severe headache.',
  'It started 3 days ago.',
  'Bright light makes it worse.',
  'I also feel nauseous.',
  'No fever or neck stiffness.'
];

async function runLatencyTest() {
  console.log('==================================================');
  console.log('TASK 2: 5-TURN END-TO-END LATENCY TEST');
  console.log('==================================================');

  const session = store.createSession({ name: 'Latency Test', age: 35, gender: 'female', language: 'en' });
  const ws = new WebSocket('ws://localhost:4000/ws/live/' + session.sessionId);

  let turnIndex = 0;
  const rtts = [];
  let sendTime = 0;

  return new Promise((resolve) => {
    ws.on('open', () => {
      console.log('[LATENCY TEST] Connected to WebSocket proxy');
      sendNextTurn();
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'ai_audio_pcm' && sendTime > 0) {
        const rtt = Date.now() - sendTime;
        rtts.push(rtt);
        console.log(`[LATENCY TEST] Turn ${turnIndex} End-to-End RTT: ${rtt} ms`);
        sendTime = 0;
        setTimeout(sendNextTurn, 800);
      }
    });

    function sendNextTurn() {
      if (turnIndex >= testPhrases.length) {
        console.log('--------------------------------------------------');
        console.log('LATENCY SUMMARY:');
        console.log('All Turn RTTs (ms):', rtts);
        const avg = rtts.reduce((a, b) => a + b, 0) / rtts.length;
        console.log(`Average End-to-End Latency: ${avg.toFixed(1)} ms`);
        console.log('==================================================\n');
        ws.close();
        resolve(rtts);
        return;
      }

      const text = testPhrases[turnIndex];
      turnIndex++;
      sendTime = Date.now();
      console.log(`[LATENCY TEST] Sending Turn ${turnIndex} ("${text}") at ${sendTime}`);
      ws.send(JSON.stringify({ type: 'user_text', text }));
    }
  });
}

async function runStressTest(runNumber) {
  console.log('==================================================');
  console.log(`TASK 3: STRESS TEST RUN #${runNumber} (20 CONSECUTIVE TURNS)`);
  console.log('==================================================');

  const session = store.createSession({ name: `Stress Test ${runNumber}`, age: 40, gender: 'male', language: 'en' });
  const ws = new WebSocket('ws://localhost:4000/ws/live/' + session.sessionId);

  let turnCount = 0;
  let disconnectCount = 0;
  let successTurns = 0;
  let sendTime = 0;

  return new Promise((resolve) => {
    ws.on('open', () => {
      console.log(`[STRESS RUN #${runNumber}] WebSocket Persistent Session Connected.`);
      sendTurn();
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'ai_audio_pcm' && sendTime > 0) {
        successTurns += 1;
        sendTime = 0;
        if (turnCount < 20) {
          setTimeout(sendTurn, 400);
        } else {
          console.log(`[STRESS RUN #${runNumber}] Completed 20 turns cleanly.`);
          ws.close();
          resolve({ runNumber, disconnectCount, successTurns });
        }
      }
    });

    ws.on('error', (err) => {
      console.error(`[STRESS RUN #${runNumber} ERROR]:`, err.message);
      disconnectCount += 1;
    });

    ws.on('close', (code) => {
      if (turnCount < 20) {
        console.warn(`[STRESS RUN #${runNumber} CLOSE] Premature close at turn ${turnCount}, Code: ${code}`);
        disconnectCount += 1;
      }
    });

    function sendTurn() {
      turnCount++;
      sendTime = Date.now();
      const promptText = `Patient intake report turn #${turnCount}: headache severity ${turnCount}/10.`;
      ws.send(JSON.stringify({ type: 'user_text', text: promptText }));
    }
  });
}

async function main() {
  await runLatencyTest();

  console.log('Starting Task 3: 3x 20-Turn Consecutive Stress Tests...');
  const run1 = await runStressTest(1);
  const run2 = await runStressTest(2);
  const run3 = await runStressTest(3);

  console.log('==================================================');
  console.log('STRESS TEST FINAL REPORT:');
  console.log(`Run 1 (20 turns): Disconnect Count = ${run1.disconnectCount}, Successful Turns = ${run1.successTurns}/20`);
  console.log(`Run 2 (20 turns): Disconnect Count = ${run2.disconnectCount}, Successful Turns = ${run2.successTurns}/20`);
  console.log(`Run 3 (20 turns): Disconnect Count = ${run3.disconnectCount}, Successful Turns = ${run3.successTurns}/20`);
  console.log(`TOTAL DISCONNECT COUNT ACROSS 60 CONSECUTIVE TURNS: ${run1.disconnectCount + run2.disconnectCount + run3.disconnectCount}`);
  console.log('==================================================');
}

main().catch(console.error);
