/**
 * True Gemini Live API WebSocket Proxy for conversation-engine (Person 1)
 * Endpoint: ws://localhost:4000/ws/live/:sessionId
 *
 * Fully supports English, Hindi, and Tamil text streaming for both
 * General Medicine OPD and AYUSH OPD.
 */

const WebSocket = require('ws');
const store = require('../session/sessionStore');
const stateMachine = require('../dialogue/stateMachine');
const qb = require('../dialogue/questionBank');
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

    const patientLang = session.schema?.patient?.preferred_language || session.language || 'en';
    const isAyush = session.department === 'AYUSH';

    // Ensure session.pendingQuestion is initialized in the patient's language
    if (!session.pendingQuestion) {
      session.pendingQuestion = stateMachine.firstQuestion(session);
    }

    const openingGreeting = session.pendingQuestion?.prompt || (
      isAyush
        ? (patientLang.startsWith('ta')
            ? 'வணக்கம்! நான் உங்கள் ஆயுஷ் ஏஐ மருத்துவ உதவியாளர். சமீபத்தில் உங்களுக்கு என்ன விதமான உடல் உபாதைகள் அல்லது மாற்றங்கள் ஏற்படுகின்றன?'
            : patientLang.startsWith('hi')
            ? 'नमस्ते! मैं आपका आयुष एआई स्वास्थ्य सहायक हूँ। हाल ही में आप किस तरह की शारीरिक परेशानी या बदलाव महसूस कर रहे हैं?'
            : 'Hello! I am your AYUSH AI Intake Assistant. What current symptoms or physical changes brought you in today?')
        : (patientLang.startsWith('ta')
            ? 'வணக்கம்! நான் உங்கள் ஏஐ மருத்துவ உதவியாளர். இன்று உங்களுக்கு ஏற்பட்டுள்ள முதன்மை உடல்நலப் பிரச்சினை என்ன?'
            : patientLang.startsWith('hi')
            ? 'नमस्ते! मैं आपका एआई मेडिकल सहायक हूँ। आज आपको क्या मुख्य स्वास्थ्य समस्या है जिसके लिए आप अस्पताल आए हैं?'
            : 'Hello! I am your AI clinical assistant. What is the main health problem that brought you in today?')
    );

    let langInstruction = '';
    if (isAyush) {
      if (patientLang.startsWith('hi')) {
        langInstruction = 'The patient selected Hindi. Speak and respond ONLY in natural, polite Hindi.';
      } else if (patientLang.startsWith('ta')) {
        langInstruction = 'The patient selected Tamil. Speak and respond ONLY in natural, polite Tamil.';
      } else {
        langInstruction = 'The patient selected English. Speak and respond in natural, polite English.';
      }
    } else {
      if (patientLang.startsWith('hi')) {
        langInstruction = 'The patient selected Hindi. Speak and respond ONLY in natural spoken Hindi.';
      } else if (patientLang.startsWith('ta')) {
        langInstruction = 'The patient selected Tamil. Speak and respond ONLY in natural spoken Tamil.';
      } else {
        langInstruction = 'The patient selected English. Speak and respond in natural spoken English.';
      }
    }

    const systemInstructionText = isAyush
      ? `You are the AYUSH Live AI Intake Voice Assistant at an AYUSH hospital outpatient department (OPD).
${langInstruction}
Patient Name: ${session.schema?.patient?.name || 'Patient'}
CRITICAL: Speak directly to the patient in 1 short sentence. NEVER output English meta-commentary or say "as an AI". Never use technical Sanskrit terms.`
      : `You are MediKiosk Live AI Medical Intake Voice Assistant.
${langInstruction}
Patient Name: ${session.schema?.patient?.name || 'Patient'}
CRITICAL: Speak directly to the patient in 1 short sentence. NEVER output English meta-commentary or say "as an AI".`;

    // Connect server-side to Gemini Live API WebSocket endpoint if API key available
    let geminiWs = null;
    if (apiKey) {
      try {
        const geminiWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
        geminiWs = new WebSocket(geminiWsUrl);
        console.log(`[LIVE PROXY] Initiating server-side WebSocket to Gemini Live API...`);
      } catch (err) {
        console.warn('[LIVE PROXY] Gemini Live connection unavailable, falling back to local multi-lingual engine:', err.message);
      }
    }

    let fullPatientTranscript = '';
    let endOfSpeechTime = 0;
    let pcmCountReceived = 0;

    // Send connected status to client immediately
    ws.send(JSON.stringify({ type: 'status', status: 'connected', message: 'MediKiosk Live session active' }));

    // Send the opening greeting text to the client immediately so it displays in full text in the selected language!
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const alreadyHasAi = session.transcript.some((t) => t.startsWith('AI:'));
        if (!alreadyHasAi) {
          session.transcript.push(`AI: ${openingGreeting}`);
        }
        ws.send(JSON.stringify({ type: 'ai_text_chunk', text: openingGreeting }));
        ws.send(JSON.stringify({ type: 'turn_complete' }));
      }
    }, 250);

    if (geminiWs) {
      geminiWs.on('open', () => {
        console.log(`[WEBSOCKET STABILITY] Gemini Live WebSocket OPENED for session ${sessionId}`);

        const setupFrame = {
          setup: {
            model: 'models/gemini-2.5-flash-native-audio-latest',
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Puck',
                  },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: systemInstructionText }],
            },
          },
        };

        geminiWs.send(JSON.stringify(setupFrame));
      });

      geminiWs.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());

          // Forward audio PCM to client for smooth voice playback
          if (msg.serverContent?.modelTurn?.parts) {
            for (const part of msg.serverContent.modelTurn.parts) {
              if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
                ws.send(JSON.stringify({
                  type: 'ai_audio_pcm',
                  data: part.inlineData.data,
                  mimeType: part.inlineData.mimeType,
                  sampleRate: 24000,
                }));
              }
            }
          }

          if (msg.serverContent?.turnComplete) {
            ws.send(JSON.stringify({ type: 'turn_complete' }));
          }

          if (msg.serverContent?.interimInputTranscription) {
            const userInterim = msg.serverContent.interimInputTranscription.text || '';
            ws.send(JSON.stringify({ type: 'patient_transcript', text: userInterim, isFinal: false }));
          }
        } catch (err) {
          console.error('[LIVE PROXY ERROR] Gemini message error:', err.message);
        }
      });

      geminiWs.on('error', (err) => {
        console.warn(`[WEBSOCKET STABILITY NOTICE] Gemini WS notice for session ${sessionId}:`, err.message);
      });

      geminiWs.on('close', (code) => {
        console.log(`[WEBSOCKET STABILITY] Gemini WS closed for session ${sessionId}. Code: ${code}`);
      });
    }

    // Handle incoming messages from browser client
    ws.on('message', async (message) => {
      try {
        const parsed = JSON.parse(message.toString());

        // Interim transcript streaming from client
        if (parsed.type === 'interim_transcript' && parsed.text) {
          ws.send(JSON.stringify({ type: 'patient_transcript', text: parsed.text, isFinal: false }));
        }

        // 16kHz PCM Audio Stream Chunk from Patient Mic
        if (parsed.type === 'audio_pcm_chunk' && parsed.data) {
          pcmCountReceived += 1;
          if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.send(JSON.stringify({
              realtimeInput: {
                mediaChunks: [
                  {
                    mimeType: 'audio/pcm;rate=16000',
                    data: parsed.data,
                  },
                ],
              },
            }));
          }
        }

        // Patient Text or Finalized Voice Utterance
        if (parsed.type === 'user_text' && parsed.text) {
          endOfSpeechTime = Date.now();
          const textInput = parsed.text.trim();
          console.log(`[PATIENT TURN] Session ${sessionId} [${patientLang}]: "${textInput}"`);

          session.transcript.push(`Patient: ${textInput}`);
          fullPatientTranscript += ' ' + textInput;

          // Real-time Red-Flag Safety Net
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

          // Advance state machine to compute next question in patient's selected language
          const curQuestion = session.pendingQuestion || { section: isAyush ? 'ayush_intake' : 'chief_complaint', field: 'text' };
          const result = await stateMachine.submitAnswer(session, curQuestion, textInput);
          session.pendingQuestion = result.nextQuestion;

          if (result.redFlags && result.redFlags.length > 0) {
            ws.send(JSON.stringify({ type: 'red_flags', redFlags: result.redFlags }));
          }

          if (result.sessionComplete || !result.nextQuestion) {
            // Intake complete message in patient language
            const closingText = patientLang.startsWith('ta')
              ? 'மிக்க நன்றி! உங்கள் விவரங்கள் வெற்றிகரமாகப் பதிவு செய்யப்பட்டுள்ளன. ஆவணங்களைப் பதிவேற்றத் தொடரலாம்.'
              : patientLang.startsWith('hi')
              ? 'धन्यवाद! आपकी जानकारी सफलतापूर्वक दर्ज कर ली गई है। अब आप अपने दस्तावेज़ अपलोड कर सकते हैं।'
              : 'Thank you! Your information has been recorded successfully. You may now proceed to document upload.';

            session.transcript.push(`AI: ${closingText}`);
            session.currentSection = 'done';
            ws.send(JSON.stringify({ type: 'ai_text_chunk', text: closingText }));
            ws.send(JSON.stringify({ type: 'turn_complete' }));
            ws.send(JSON.stringify({ type: 'complete' }));
          } else {
            const nextText = result.nextQuestion.prompt;
            session.transcript.push(`AI: ${nextText}`);

            // Send full next question text in the selected language to display in chat!
            ws.send(JSON.stringify({ type: 'ai_text_chunk', text: nextText }));
            ws.send(JSON.stringify({ type: 'turn_complete' }));

            // If Gemini WS is active, prompt it with the question to speak in native audio
            if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
              geminiWs.send(JSON.stringify({
                clientContent: {
                  turns: [
                    {
                      role: 'user',
                      parts: [{ text: `Speak this question politely to the patient: "${nextText}"` }],
                    },
                  ],
                  turnComplete: true,
                },
              }));
            }
          }
        }

        // Interrupted by patient
        if (parsed.type === 'interrupted') {
          console.log(`[LIVE PROXY] Patient interrupted in session ${sessionId}`);
        }

        // Finish interview trigger
        if (parsed.type === 'finish_interview') {
          console.log(`[LIVE PROXY] Finish interview received for session ${sessionId}`);
          session.currentSection = 'done';

          if (session.transcript && session.transcript.length > 0) {
            const llm = require('../llm');
            if (typeof llm.extractFullTranscript === 'function') {
              llm.extractFullTranscript({
                transcript: session.transcript,
                schema: session.schema,
                department: session.department,
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

                  if (session.schema.ayushAssessment && extracted.ayush_assessment) {
                    for (const [k, v] of Object.entries(extracted.ayush_assessment)) {
                      if (v && session.schema.ayushAssessment[k]) {
                        session.schema.ayushAssessment[k].patientReported = v;
                      }
                    }
                  }
                }
              }).catch((e) => console.warn('[liveProxy] Extraction notice:', e.message));
            }
          }

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'complete' }));
          }
        }
      } catch (err) {
        console.error('[LIVE PROXY ERROR] Message handling error:', err.message);
      }
    });

    ws.on('close', (code) => {
      console.log(`[WEBSOCKET STABILITY] Client WS closed for session ${sessionId}. Code: ${code}`);
      if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.close();
      }
    });
  });
}

module.exports = { setupLiveProxy };
