/**
 * True Gemini Live API WebSocket Proxy for conversation-engine (Person 1)
 * Endpoint: ws://localhost:4000/ws/live/:sessionId
 *
 * Security:
 * GEMINI_API_KEY remains strictly on the server in process.env.GEMINI_API_KEY.
 * Never exposed to browser client or network frames.
 */

const WebSocket = require('ws');
const store = require('../session/sessionStore');
const redFlagRules = require('../dialogue/redFlags').RULES;

function setupLiveProxy(wss) {
  wss.on('connection', async (ws, req) => {
    const url = req.url || '';
    const match = url.match(/\/ws\/live\/([^/?#]+)/);
    const sessionId = match ? match[1] : null;

    console.log(`[LIVE PROXY] Client connected for session: ${sessionId}`);

    if (!sessionId) {
      ws.close(1008, 'Session ID required');
      return;
    }

    let session;
    try {
      session = store.getSession(sessionId);
    } catch (err) {
      console.warn(`[LIVE PROXY] Session ${sessionId} not found in store, creating fallback.`);
      session = store.createSession({ name: 'Patient', age: 40, gender: 'unspecified', language: 'en' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error('[LIVE PROXY ERROR] GEMINI_API_KEY is missing in server environment!');
      ws.send(JSON.stringify({ type: 'error', message: 'GEMINI_API_KEY not configured on server.' }));
      ws.close(1011, 'Server API Key Missing');
      return;
    }

    const patientLang = session.schema?.patient?.preferred_language || 'en';

    let langInstruction = '';
    if (patientLang.startsWith('hi')) {
      langInstruction = `The patient selected Hindi. You MUST conduct the entire clinical intake interview naturally in spoken Hindi.
Begin the conversation immediately by speaking a warm opening question in Hindi: "नमस्ते! मैं आपका एआई मेडिकल सहायक हूँ। आज आपको क्या स्वास्थ्य समस्या है?"
Understand spoken Hindi and respond ONLY in natural spoken Hindi. Do NOT use English under any circumstances. Every response from you MUST be entirely in Hindi (using Devanagari script).`;
    } else if (patientLang.startsWith('ta')) {
      langInstruction = `The patient selected Tamil. You MUST conduct the entire clinical intake interview naturally in spoken Tamil.
Begin the conversation immediately by speaking a warm opening question in Tamil: "வணக்கம்! நான் உங்கள் ஏஐ மருத்துவ உதவியாளர். இன்று உங்களுக்கு என்ன ஆரோக்கியப் பிரச்சினை உள்ளது?"
Understand spoken Tamil and respond ONLY in natural spoken Tamil. Do NOT use English under any circumstances. Every response from you MUST be entirely in Tamil (using Tamil script).`;
    } else {
      langInstruction = `The patient selected English. Conduct the entire clinical intake interview naturally in spoken English.
Begin the conversation immediately by speaking a warm opening question in English: "Hello! I am your AI clinical assistant. What health problem brought you in today?"
Understand spoken English and respond in natural spoken English.`;
    }

    const systemInstructionText = `You are MediKiosk AI, an empathetic, conversational medical voice assistant (like Google Assistant for hospital patient intake).

${langInstruction}

=== PATIENT CONTEXT ===
- Name: ${session.schema?.patient?.name || 'Patient'}
- Age: ${session.schema?.patient?.age || 'Unknown'}
- Gender: ${session.schema?.patient?.gender || 'Unknown'}

=== MANDATORY CONVERSATIONAL GUIDELINES ===
1. SPEAK DIRECTLY TO THE PATIENT as a warm, professional assistant.
2. NEVER output internal thoughts, preambles, meta-commentary, or headers (e.g. NEVER output "**Initiating Patient Interaction**" or "As an AI...").
3. Speak in 1-2 concise, natural sentences at a time.
4. Collect the patient's clinical history step-by-step: chief complaint, onset/duration, severity, associated symptoms, past medical history, and allergies.
5. NEVER ask for information that the patient has already provided in the conversation.
6. Acknowledge what the patient says with empathy and ask the single next logical question.
7. Do not diagnose conditions or prescribe medications.
8. When sufficient history is collected (or after 5-7 short exchanges), thank the patient and conclude gracefully.`;

    // Connect server-side to Gemini Live API WebSocket endpoint
    const geminiWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    let geminiWs = null;

    try {
      geminiWs = new WebSocket(geminiWsUrl);
      console.log(`[LIVE PROXY] Initiating server-side WebSocket to Gemini Live API...`);
    } catch (err) {
      console.error('[LIVE PROXY ERROR] Failed to connect to Gemini Live API:', err.message);
      ws.send(JSON.stringify({ type: 'error', message: 'Could not connect to Gemini Live service.' }));
      return;
    }

    let fullPatientTranscript = '';
    let currentAiTranscriptBuffer = '';
    let endOfSpeechTime = 0;
    let pcmCountReceived = 0;

    geminiWs.on('open', () => {
      console.log(`[WEBSOCKET STABILITY] Gemini Live WebSocket OPENED successfully for session ${sessionId}`);

      // Send Setup Frame to Gemini Live API
      const setupFrame = {
        setup: {
          model: 'models/gemini-2.5-flash-native-audio-latest',
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: 'Puck'
                }
              }
            }
          },
          systemInstruction: {
            parts: [{ text: systemInstructionText }]
          }
        }
      };

      geminiWs.send(JSON.stringify(setupFrame));
      console.log(`[QUESTION ORIGIN] Dynamic Gemini Live initial setup frame sent with language context: ${patientLang}`);
      ws.send(JSON.stringify({ type: 'status', status: 'connected', message: 'Gemini Live persistent session active' }));

      // Trigger Gemini Live to immediately generate and speak its opening intake question in patient language
      setTimeout(() => {
        if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
          endOfSpeechTime = Date.now();
          console.log(`[LATENCY TRACK] Sent initial turn trigger to Gemini Live at ${endOfSpeechTime}`);
          let triggerText = 'Hello, please start the patient intake now.';
          if (patientLang.startsWith('hi')) {
            triggerText = 'नमस्ते! रोगी का विवरण लेना शुरू करें।';
          } else if (patientLang.startsWith('ta')) {
            triggerText = 'வணக்கம்! நோயாளி விவரங்களைச் சேகரிக்கத் தொடங்குங்கள்.';
          }

          const initialTriggerFrame = {
            clientContent: {
              turns: [
                {
                  role: 'user',
                  parts: [{ text: triggerText }]
                }
              ],
              turnComplete: true
            }
          };
          geminiWs.send(JSON.stringify(initialTriggerFrame));
        }
      }, 500);
    });

    geminiWs.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.setupComplete) {
          console.log(`[WEBSOCKET STABILITY] Gemini Live setupComplete received for session ${sessionId}`);
        }

        // 1. Handle Gemini Audio Output Chunks (24kHz 16-bit Mono PCM)
        if (msg.serverContent?.modelTurn?.parts) {
          if (endOfSpeechTime > 0) {
            const firstByteTime = Date.now();
            const rtt = firstByteTime - endOfSpeechTime;
            console.log(`[LATENCY MEASUREMENT] RTT (End-of-speech -> First response chunk): ${rtt} ms`);
            endOfSpeechTime = 0; // Reset
          }

          console.log(`[MIC STAGE E] Received Gemini Live response parts from API`);

          for (const part of msg.serverContent.modelTurn.parts) {
            if (part.text) {
              // Strip any markdown thoughts or header lines if present
              let cleanText = part.text.replace(/^\*\*.*?\*\*\s*/gm, '').trim();
              if (cleanText) {
                currentAiTranscriptBuffer += cleanText + ' ';
                console.log(`[QUESTION ORIGIN] Dynamic Gemini Live output text chunk: "${cleanText.substring(0, 50)}..."`);
                ws.send(JSON.stringify({ type: 'ai_text_chunk', text: cleanText }));
              }
            }
            if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
              ws.send(JSON.stringify({
                type: 'ai_audio_pcm',
                data: part.inlineData.data,
                mimeType: part.inlineData.mimeType,
                sampleRate: 24000
              }));
            }
          }
        }

        if (msg.serverContent?.turnComplete) {
          if (currentAiTranscriptBuffer.trim()) {
            session.transcript.push(`AI: ${currentAiTranscriptBuffer.trim()}`);
            currentAiTranscriptBuffer = '';
          }
          ws.send(JSON.stringify({ type: 'turn_complete' }));
        }

        if (msg.serverContent?.interimInputTranscription) {
          const userInterim = msg.serverContent.interimInputTranscription.text || '';
          console.log(`[MIC STAGE E] Gemini input transcription received: "${userInterim}"`);
          ws.send(JSON.stringify({ type: 'patient_transcript', text: userInterim, isFinal: false }));
        }
      } catch (err) {
        console.error('[LIVE PROXY ERROR] Message parsing error:', err.message);
      }
    });

    geminiWs.on('error', (err) => {
      console.error(`[WEBSOCKET STABILITY ERROR] Gemini WS Error for session ${sessionId}:`, err.message);
      ws.send(JSON.stringify({ type: 'error', message: 'Gemini Live error: ' + err.message }));
    });

    geminiWs.on('close', (code, reason) => {
      console.warn(`[WEBSOCKET STABILITY CLOSE] Gemini Live connection CLOSED for session ${sessionId}. Code: ${code}, Reason: ${reason.toString() || 'none'}`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'status', status: 'disconnected', code, reason: reason.toString() }));
      }
    });

    // Handle incoming WebSocket messages from browser client
    ws.on('message', (message) => {
      try {
        const parsed = JSON.parse(message.toString());

        // Partial / Interim Patient Transcript Streaming (Mid-sentence)
        if (parsed.type === 'interim_transcript' && parsed.text) {
          ws.send(JSON.stringify({ type: 'patient_transcript', text: parsed.text, isFinal: false }));
        }

        // A. 16kHz PCM Audio Stream Chunk from Patient's Microphone
        if (parsed.type === 'audio_pcm_chunk' && parsed.data) {
          pcmCountReceived += 1;
          if (pcmCountReceived % 20 === 1) {
            console.log(`[MIC STAGE C] Backend received PCM chunk #${pcmCountReceived} from client (Base64 len: ${parsed.data.length})`);
          }

          if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
            const realtimeFrame = {
              realtimeInput: {
                mediaChunks: [
                  {
                    mimeType: 'audio/pcm;rate=16000',
                    data: parsed.data
                  }
                ]
              }
            };
            geminiWs.send(JSON.stringify(realtimeFrame));
            if (pcmCountReceived % 20 === 1) {
              console.log(`[MIC STAGE D] Backend forwarded PCM chunk #${pcmCountReceived} to Gemini Live API`);
            }
          } else {
            console.warn(`[MIC STAGE D FAIL] Backend received PCM chunk #${pcmCountReceived} but Gemini WS is not OPEN (state: ${geminiWs?.readyState})`);
          }
        }

        // B. Patient Transcript / Text Fallback Input
        if (parsed.type === 'user_text' && parsed.text) {
          endOfSpeechTime = Date.now();
          const textInput = parsed.text.trim();
          console.log(`[MIC STAGE C/D] User text input received at ${endOfSpeechTime}: "${textInput}"`);

          session.transcript.push(`Patient: ${textInput}`);
          fullPatientTranscript += ' ' + textInput;

          // Execute Real-Time Independent Red-Flag Safety Net
          const lowerText = fullPatientTranscript.toLowerCase();
          const triggeredFlags = [];
          for (const rule of redFlagRules) {
            const hits = rule.keywords.filter((kw) => lowerText.includes(kw)).length;
            if (hits >= rule.minMatches) {
              const alreadyFired = session.schema.red_flags.some((f) => f.flag === rule.id);
              if (!alreadyFired) {
                const flagObj = { flag: rule.id, severity: rule.severity, triggered_by: textInput, timestamp: new Date().toISOString() };
                session.schema.red_flags.push(flagObj);
                triggeredFlags.push(flagObj);
              }
            }
          }

          if (triggeredFlags.length > 0) {
            console.log(`[SAFETY NET] Triggered Red Flags:`, triggeredFlags.map((f) => f.flag));
            ws.send(JSON.stringify({ type: 'red_flags', redFlags: triggeredFlags }));
          }

          // Forward user text to Gemini Live session
          if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
            console.log(`[QUESTION ORIGIN] Forwarding user text turn to Dynamic Gemini Live session...`);
            const clientContentFrame = {
              clientContent: {
                turns: [
                  {
                    role: 'user',
                    parts: [{ text: textInput }]
                  }
                ],
                turnComplete: true
              }
            };
            geminiWs.send(JSON.stringify(clientContentFrame));
          } else {
            console.warn(`[LANGUAGE FALLBACK DETECTED] Gemini WS is CLOSED! QuestionBank fallback would be required.`);
          }
        }

        // C. Patient Barge-in / Interruption Event
        if (parsed.type === 'interrupted') {
          console.log(`[LIVE PROXY] Patient interrupted AI speech in session ${sessionId}`);
        }

        // D. Explicit Finish Interview / Proceed to Documents
        if (parsed.type === 'finish_interview') {
          console.log(`[LIVE PROXY] Finish interview received for session ${sessionId}`);
          session.currentSection = 'done';
          if (session.transcript && session.transcript.length > 0) {
            const llm = require('../llm');
            if (typeof llm.extractFullTranscript === 'function') {
              llm.extractFullTranscript({
                transcript: session.transcript,
                schema: session.schema,
              }).then((extracted) => {
                if (extracted) {
                  if (extracted.chief_complaint && !session.schema.chief_complaint.text) {
                    session.schema.chief_complaint.text = extracted.chief_complaint;
                    session.schema.chief_complaint.text_en = extracted.chief_complaint;
                  }
                  if (extracted.hpi) {
                    session.schema.hpi = { ...session.schema.hpi, ...extracted.hpi };
                  }
                  if (extracted.past_medical_history) session.schema.past_medical_history_raw = extracted.past_medical_history;
                  if (extracted.past_surgical_history) session.schema.past_surgical_history_raw = extracted.past_surgical_history;
                  if (extracted.drug_allergy_history) session.schema.drug_allergy_history_raw = extracted.drug_allergy_history;
                  if (extracted.family_history) session.schema.family_history_raw = extracted.family_history;
                  if (extracted.personal_history) session.schema.personal_history_raw = extracted.personal_history;
                }
              }).catch((e) => console.warn('[liveProxy] Extraction on finish notice:', e.message));
            }
          }
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'complete' }));
          }
        }
      } catch (err) {
        console.error('[LIVE PROXY ERROR] Client message handling error:', err.message);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`[WEBSOCKET STABILITY] Client WS closed for session ${sessionId}. Code: ${code}`);
      if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.close();
      }
    });
  });
}

module.exports = { setupLiveProxy };
