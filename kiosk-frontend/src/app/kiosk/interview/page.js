"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { loadActiveSession, saveActiveSession, upsertQueueEntry } from "@/lib/registry";
import { finalizeSession } from "@/lib/api";
import RedFlagBanner from "@/components/RedFlagBanner";

const GENERAL_QUICK_CHIPS = [
  { en: "Severe headache since 2 days", hi: "2 दिनों से तेज सिरदर्द", ta: "2 நாட்களாக கடுமையான தலைவலி" },
  { en: "High fever with chills", hi: "ठंड के साथ तेज बुखार", ta: "குளிருடன் கூடிய அதிக காய்ச்சல்" },
  { en: "Chest heaviness and sweating", hi: "सीने में भारीपन और पसीना", ta: "நெஞ்சு பாரம் மற்றும் வியர்வை" },
  { en: "Stomach pain and nausea", hi: "पेट दर्द और जी मिचलाना", ta: "வயிற்று வலி மற்றும் குமட்டல்" },
  { en: "Persistent cough and cold", hi: "लगातार खांसी और जुकाम", ta: "தொடர் இருமல் மற்றும் சளி" },
  { en: "Shortness of breath / difficulty breathing", hi: "सांस लेने में तकलीफ", ta: "மூச்சுத்திணறல் / சுவாசிப்பதில் சிரமம்" },
  { en: "Body ache and extreme fatigue", hi: "बदन दर्द और अत्यधिक थकान", ta: "உடல் வலி மற்றும் அதிக சோர்வு" },
  { en: "Pain is mild to moderate (4-5/10)", hi: "दर्द हल्का से मध्यम है (4-5/10)", ta: "வலி மிதமானது (4-5/10)" },
  { en: "Pain is very severe (8-9/10)", hi: "दर्द बहुत तेज है (8-9/10)", ta: "வலி மிகவும் தீவிரமானது (8-9/10)" },
  { en: "Started suddenly today", hi: "आज अचानक शुरू हुआ", ta: "இன்று திடீரென தொடங்கியது" },
  { en: "No other previous illnesses", hi: "कोई पुरानी बीमारी नहीं है", ta: "முந்தைய பிற நோய்கள் எதுவும் இல்லை" },
  { en: "No known drug allergies", hi: "दवाओं से कोई एलर्जी नहीं", ta: "மருந்து ஒவ்வாமை எதுவும் இல்லை" },
];

const AYUSH_QUICK_CHIPS = [
  { en: "Good appetite & smooth digestion", hi: "अच्छी भूख और सही पाचन", ta: "நல்ல பசி மற்றும் சீரான செரிமானம்" },
  { en: "Frequent acidity, gas or bloating", hi: "बार-बार गैस या एसिडिटी", ta: "அடிக்கடி வாயு அல்லது அசிடிட்டி" },
  { en: "Regular daily bowel movements", hi: "रोज़ाना पेट ठीक से साफ होता है", ta: "தினசரி மலம் சீராக கழிகிறது" },
  { en: "Tendency for hard stools / constipation", hi: "कब्ज या कठोर मल की समस्या", ta: "மலச்சிக்கல் / கடின மலம்" },
  { en: "Sensitive to cold, naturally dry skin", hi: "ठंड ज्यादा लगती है, रूखी त्वचा", ta: "குளிர் அதிகம் உணர்வேன், உலர் சருமம்" },
  { en: "Sensitive to heat, warm body & sweaty", hi: "गर्मी ज्यादा लगती है, पसीना आता है", ta: "வெப்பம் அதிகம் தாங்காது, வியர்க்கும்" },
  { en: "Sound sleep (7-8 hrs), wake up fresh", hi: "अच्छी नींद, सुबह ताजगी", ta: "ஆழ்ந்த தூக்கம், காலையில் புத்துணர்ச்சி" },
  { en: "Disturbed sleep / wake up tired", hi: "कच्ची नींद, सुबह थकान", ta: "தடைபட்ட தூக்கம், சோர்வு" },
  { en: "Good stamina, exercise regularly", hi: "अच्छी ताकत, रोज़ाना व्यायाम", ta: "நல்ல உடல் வலிமை, உடற்பயிற்சி" },
  { en: "Get fatigued quickly with light work", hi: "हल्के काम से जल्दी थकान", ta: "லேசான வேலைக்கே சீக்கிரம் சோர்வு" },
  { en: "Calm & emotionally stable", hi: "शांत स्वभाव और धैर्य", ta: "அமைதியான மனநிலை" },
  { en: "Prone to worry, anxiety or anger", hi: "तनाव या जल्दी गुस्सा", ta: "அதிக கவலை அல்லது கோபம்" },
  { en: "Slender / lean frame", hi: "पतला शरीर / कम वजन", ta: "மெலிந்த உடல் அமைப்பு" },
  { en: "Medium balanced frame", hi: "मध्यम संतुलित शरीर", ta: "நடுத்தர உடல் அமைப்பு" },
  { en: "Broad / heavy frame", hi: "चौड़ा / भारी शरीर", ta: "பருமன் / அகன்ற உடல் அமைப்பு" },
  { en: "No major past illness or allergy", hi: "कोई पुरानी बीमारी या एलर्जी नहीं", ta: "முந்தைய நோய்கள் அல்லது ஒவ்வாமை இல்லை" },
];

const AYUSH_DOMAINS = [
  { en: "1. Symptoms & Changes", hi: "1. लक्षण और बदलाव", ta: "1. அறிகுறிகள் & மாற்றங்கள்" },
  { en: "2. Hunger & Digestion", hi: "2. भूख और पाचन", ta: "2. பசி & செரிமானம்" },
  { en: "3. Stool & Bowels", hi: "3. पेट और मल त्याग", ta: "3. மலம் & வயிறு" },
  { en: "4. Body Nature", hi: "4. शारीरिक प्रकृति", ta: "4. உடல் இயல்பு" },
  { en: "5. Food & Diet", hi: "5. आहार और खान-पान", ta: "5. உணவுப் பழக்கம்" },
  { en: "6. Sleep & Routine", hi: "6. नींद और दिनचर्या", ta: "6. தூக்கம் & வழக்கம்" },
  { en: "7. Physical Strength", hi: "7. शारीरिक ताकत", ta: "7. உடல் வலிமை" },
  { en: "8. Stress & Emotions", hi: "8. तनाव और मानसिक स्थिति", ta: "8. மன அமைதி" },
  { en: "9. Body Build", hi: "9. शारीरिक बनावट", ta: "9. உடல் அமைப்பு" },
  { en: "10. Lifestyle & Habits", hi: "10. दिनचर्या और आदतें", ta: "10. பழக்கவழக்கங்கள்" },
];

export default function LiveInterviewPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState(null);
  const [language, setLanguage] = useState("en");
  const [department, setDepartment] = useState("GENERAL_MEDICINE");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [redFlags, setRedFlags] = useState([]);
  const [complete, setComplete] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [error, setError] = useState(null);

  // Live Assistant UI states
  const [liveState, setLiveState] = useState("CONNECTING");
  const [patientTranscript, setPatientTranscript] = useState("");

  // Refs
  const bottomRef = useRef(null);
  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const processorRef = useRef(null);
  const activeSourcesRef = useRef([]);
  const isAiSpeakingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  const speechRecRef = useRef(null);
  const speechTimerRef = useRef(null);
  const lastSpokenTextRef = useRef("");
  const completeRef = useRef(false);
  const sessionIdRef = useRef(null);
  const micStoppedRef = useRef(false);
  // Tracks whether the previous AI turn ended — when true, next ai_text_chunk starts a NEW bubble
  const aiTurnCompleteRef = useRef(true);

  // ─── Audio: Interrupt Playback ───────────────────────────────────────────────
  const interruptPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try { src.stop(); src.disconnect(); } catch (_) {}
    });
    activeSourcesRef.current = [];
    isAiSpeakingRef.current = false;
    nextPlayTimeRef.current = 0;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "interrupted" }));
    }
    setLiveState("INTERRUPTED");
    setTimeout(() => setLiveState("LISTENING"), 300);
  }, []);

  // ─── Audio: Ensure Active AudioContext ───────────────────────────────────────
  const ensureAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioCtx();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }, []);

  // ─── Audio: Stop Microphone ─────────────────────────────────────────────────
  const stopLiveMicrophone = useCallback(() => {
    micStoppedRef.current = true;
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    if (speechRecRef.current) {
      try { speechRecRef.current.stop(); } catch (_) {}
      speechRecRef.current = null;
    }
    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch (_) {}
      processorRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    setLiveState("CONNECTED");
  }, []);

  // ─── Audio: Play 24kHz PCM chunk with jitter buffer ──────────────────────────
  const playPcmChunk = useCallback((base64Data, sampleRate = 24000) => {
    if (typeof window === "undefined") return;
    try {
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768.0;

      const ctx = ensureAudioContext();
      if (!ctx) return;

      const buf = ctx.createBuffer(1, float32.length, sampleRate);
      buf.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      nextPlayTimeRef.current = Math.max(now, nextPlayTimeRef.current);
      source.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += buf.duration;
      activeSourcesRef.current.push(source);
      isAiSpeakingRef.current = true;
      setLiveState("SPEAKING");

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
        if (activeSourcesRef.current.length === 0) {
          isAiSpeakingRef.current = false;
          nextPlayTimeRef.current = 0;
          setLiveState("LISTENING");
        }
      };
    } catch (err) {
      console.error("[Audio Playback Error]:", err);
    }
  }, [ensureAudioContext]);

  // ─── Submit patient turn → Backend ────────────────────────────────────────────
  const commitPatientTurn = useCallback((text) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return;

    ensureAudioContext();

    if (isAiSpeakingRef.current) interruptPlayback();

    setMessages((m) => [...m, { role: "patient", text: trimmed }]);
    setInput("");
    setPatientTranscript("");
    lastSpokenTextRef.current = "";
    setLiveState("THINKING");

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "user_text", text: trimmed }));
    }
  }, [interruptPlayback, ensureAudioContext]);

  // ─── Resample to 16kHz PCM ────────────────────────────────────────────────────
  const resampleTo16kPcm = useCallback((inputBuf, inputRate) => {
    const ratio = inputRate / 16000;
    const newLen = Math.floor(inputBuf.length / ratio);
    const out = new Int16Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const s = Math.max(-1, Math.min(1, inputBuf[Math.floor(i * ratio)]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const bytes = new Uint8Array(out.buffer);
    let bin = "";
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }, []);

  // ─── Start Microphone ─────────────────────────────────────────────────────────
  const startLiveMicrophone = useCallback(async () => {
    if (typeof window === "undefined") return;
    micStoppedRef.current = false;
    try {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      if (speechRecRef.current) {
        try { speechRecRef.current.stop(); } catch (_) {}
        speechRecRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 16000 },
        video: false,
      });
      micStreamRef.current = stream;

      const ctx = ensureAudioContext();
      if (!ctx) return;

      const src = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = proc;

      proc.onaudioprocess = (e) => {
        if (isAiSpeakingRef.current || micStoppedRef.current) return;
        const pcm = resampleTo16kPcm(e.inputBuffer.getChannelData(0), ctx.sampleRate);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "audio_pcm_chunk", data: pcm }));
        }
      };
      src.connect(proc);
      proc.connect(ctx.destination);

      // Web Speech Recognition configured to patient's language
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = language.startsWith("hi") ? "hi-IN" : language.startsWith("ta") ? "ta-IN" : "en-IN";

        rec.onresult = (e) => {
          if (isAiSpeakingRef.current || micStoppedRef.current) return;

          let interim = "";
          let final = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const chunk = e.results[i][0].transcript;
            if (e.results[i].isFinal) final += chunk;
            else interim += chunk;
          }

          const cur = (final || interim).trim();
          if (!cur) return;

          setPatientTranscript(cur);
          setInput(cur);
          lastSpokenTextRef.current = cur;

          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "interim_transcript", text: cur }));
          }

          if (speechTimerRef.current) clearTimeout(speechTimerRef.current);

          if (final.trim().length > 1) {
            commitPatientTurn(final.trim());
          } else {
            speechTimerRef.current = setTimeout(() => {
              const pending = lastSpokenTextRef.current.trim();
              if (pending.length > 1) commitPatientTurn(pending);
            }, 400);
          }
        };

        rec.onerror = (e) => {
          if (e.error === "no-speech" && !completeRef.current && !micStoppedRef.current) {
            try { rec.start(); } catch (_) {}
          }
        };
        rec.onend = () => {
          if (!completeRef.current && !micStoppedRef.current) {
            try { rec.start(); } catch (_) {}
          }
        };

        speechRecRef.current = rec;
        rec.start();
      }

      setError(null);
      setLiveState("LISTENING");
    } catch (err) {
      console.warn("Mic access:", err.message);
      setError("Microphone permission denied or not supported. You can still type below.");
      setLiveState("CONNECTED");
    }
  }, [language, resampleTo16kPcm, commitPatientTurn, ensureAudioContext]);

  // ─── WebSocket + Session Setup ────────────────────────────────────────────────
  useEffect(() => {
    const active = loadActiveSession();
    if (!active?.sessionId) {
      router.push("/kiosk/identify");
      return;
    }

    const sId = active.sessionId;
    const pLang = active.language || active.schema?.patient?.preferred_language || "en";
    const dept = active.department || active.schema?.department || "GENERAL_MEDICINE";
    setSessionId(sId);
    sessionIdRef.current = sId;
    setLanguage(pLang);
    setDepartment(dept);
    setRedFlags(active.redFlags || []);

    // Seed the first question in patient's selected language so chat is NEVER empty
    const firstQPrompt = active.firstQuestion?.prompt;
    if (firstQPrompt) {
      aiTurnCompleteRef.current = false; // first message pre-loaded, next chunk should dedup not create new
      setMessages([{ role: "ai", text: firstQPrompt }]);
    }

    const wsUrl = `ws://localhost:4000/ws/live/${sId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setLiveState("CONNECTED");
      startLiveMicrophone();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "status" && msg.status === "connected") {
          setError(null);
          setLiveState("CONNECTED");
        } else if (msg.type === "error") {
          setError(msg.message);
          setLiveState("DISCONNECTED");
        } else if (msg.type === "ai_audio_pcm" && msg.data) {
          playPcmChunk(msg.data, msg.sampleRate || 24000);
        } else if (msg.type === "ai_text_chunk" && msg.text) {
          setLiveState((s) => s === "THINKING" ? "SPEAKING" : s);
          setMessages((m) => {
            // Prevent duplicate of initial message (WebSocket echo of pre-seeded first question)
            if (m.length === 1 && m[0].role === "ai" && m[0].text.trim() === msg.text.trim()) {
              aiTurnCompleteRef.current = false;
              return m;
            }
            // If previous turn ended, start a NEW bubble for this AI question
            if (aiTurnCompleteRef.current) {
              aiTurnCompleteRef.current = false;
              return [...m, { role: "ai", text: msg.text }];
            }
            // Same turn streaming: append to last AI bubble
            const last = m[m.length - 1];
            if (last && last.role === "ai") {
              if (last.text.trim() === msg.text.trim()) return m; // exact dedup
              return [...m.slice(0, -1), { role: "ai", text: last.text + msg.text }];
            }
            return [...m, { role: "ai", text: msg.text }];
          });
        } else if (msg.type === "patient_transcript" && msg.text) {
          setPatientTranscript(msg.text);
        } else if (msg.type === "turn_complete") {
          aiTurnCompleteRef.current = true; // next AI chunk starts a fresh bubble
          if (!isAiSpeakingRef.current) setLiveState("LISTENING");
        } else if (msg.type === "red_flags" && Array.isArray(msg.redFlags)) {
          setRedFlags((prev) => {
            const merged = [...prev, ...msg.redFlags];
            upsertQueueEntry(sId, { redFlags: merged, language: pLang });
            saveActiveSession({ redFlags: merged });
            return merged;
          });
        } else if (msg.type === "complete") {
          completeRef.current = true;
          setComplete(true);
          setLiveState("DISCONNECTED");
          stopLiveMicrophone();
          saveActiveSession({ sessionComplete: true });
          upsertQueueEntry(sId, { status: "interview_complete", language: pLang });
        }
      } catch (err) {
        console.error("[WS message error]:", err);
      }
    };

    ws.onerror = () => {
      setLiveState("DISCONNECTED");
    };

    ws.onclose = () => setLiveState("DISCONNECTED");

    return () => {
      ws.close();
      stopLiveMicrophone();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, patientTranscript]);

  // ─── Finish Interview ─────────────────────────────────────────────────────────
  const handleFinishInterview = useCallback(() => {
    if (isFinalizing) return;
    setIsFinalizing(true);
    completeRef.current = true;

    interruptPlayback();
    stopLiveMicrophone();

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try { wsRef.current.send(JSON.stringify({ type: "finish_interview" })); } catch (_) {}
    }

    const sId = sessionIdRef.current;
    if (sId) {
      saveActiveSession({ sessionComplete: true });
      upsertQueueEntry(sId, { status: "interview_complete" });
      finalizeSession(sId).catch((err) => console.warn("Finalize notice:", err.message));
    }

    router.push("/kiosk/documents");
  }, [isFinalizing, interruptPlayback, stopLiveMicrophone, router]);

  // ─── Text Fallback ────────────────────────────────────────────────────────────
  const handleSendTextFallback = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    commitPatientTurn(text);
  };

  const isAyush = department === "AYUSH";

  function getChipLabel(chip) {
    if (language.startsWith("hi") && chip.hi) return chip.hi;
    if (language.startsWith("ta") && chip.ta) return chip.ta;
    return chip.en;
  }

  // Multi-lingual UI strings
  const labels = {
    step: language.startsWith("ta") ? "படி 4 / 6" : language.startsWith("hi") ? "चरण 4 / 6" : "Step 4 of 6",
    title: isAyush
      ? (language.startsWith("ta") ? "🌿 ஆயுஷ் நேரலை AI மருத்துவ உதவியாளர்" : language.startsWith("hi") ? "🌿 आयुष लाइव एआई स्वास्थ्य सहायक" : "🌿 AYUSH Live AI Intake Assistant")
      : (language.startsWith("ta") ? "🏥 நேரலை AI மருத்துவ உட்கொள்ளல்" : language.startsWith("hi") ? "🏥 लाइव एआई चिकित्सा परामर्श" : "🏥 Live AI Medical Intake"),
    subtitle: isAyush
      ? (language.startsWith("ta")
          ? "உங்கள் உடல் இயல்பு, செரிமானம், தூக்கம் மற்றும் வாழ்க்கை முறை பற்றிய எளிய கேள்விகள்."
          : language.startsWith("hi")
          ? "आपके शारीरिक स्वभाव, पाचन, नींद और दिनचर्या के बारे में सरल प्रश्न।"
          : "Simple everyday questions about your body nature, digestion, sleep, and lifestyle. Never asking technical Sanskrit terms.")
      : (language.startsWith("ta")
          ? "இயல்பாகப் பேசலாம் அல்லது கீழே தட்டச்சு செய்யலாம். AI உங்கள் பதில்களைக் கேட்டு உடனடியாக வழிகாட்டும்."
          : language.startsWith("hi")
          ? "माइक में सामान्य रूप से बोलें या नीचे लिखें। एआई सुनकर तुरंत उत्तर देगा।"
          : "Speak naturally — the AI will listen and reply instantly. You can also type below at any time."),
    stateConnected: language.startsWith("ta") ? "🟢 இணைக்கப்பட்டது" : language.startsWith("hi") ? "🟢 जुड़ा हुआ" : "🟢 Connected",
    stateListening: language.startsWith("ta") ? "🎙️ கவனிக்கிறது…" : language.startsWith("hi") ? "🎙️ सुन रहा है…" : "🎙️ Listening…",
    stateThinking: language.startsWith("ta") ? "💭 சிந்திக்கிறது…" : language.startsWith("hi") ? "💭 सोच रहा है…" : "💭 Thinking…",
    stateSpeaking: language.startsWith("ta") ? "🔊 AI பேசுகிறது" : language.startsWith("hi") ? "🔊 एआई बोल रहा है" : "🔊 AI Speaking",
    stateInterrupted: language.startsWith("ta") ? "⏸️ குறுக்கீடு" : language.startsWith("hi") ? "⏸️ रुका हुआ" : "⏸️ Interrupted",
    stateDisconnected: language.startsWith("ta") ? "🔴 தட்டச்சு முறை" : language.startsWith("hi") ? "🔴 टेक्स्ट मोड" : "🔴 Text Mode",
    ayushDomainGuide: language.startsWith("ta") ? "ஆயுஷ் 10-பரிமாண பரிசோதனை நிலைகள்" : language.startsWith("hi") ? "आयुष 10-चरणीय स्वास्थ्य परीक्षण क्षेत्र" : "Intake Domains Covered Naturally (One question at a time)",
    chipsTitle: language.startsWith("ta") ? "💡 விரைவு பதில் தேர்வுகள் (அனுப்ப தட்டவும், அல்லது பேசவும்):" : language.startsWith("hi") ? "💡 त्वरित उत्तर विकल्प (टैप करें या बोलें):" : "💡 Quick answer options (tap to send, or speak into the microphone):",
    startMic: language.startsWith("ta") ? "🎙️ மைக் தொடங்கு" : language.startsWith("hi") ? "🎙️ माइक शुरू करें" : "🎙️ Start Mic",
    stopMic: language.startsWith("ta") ? "🛑 மைக் நிறுத்து" : language.startsWith("hi") ? "🛑 माइक रोकें" : "🛑 Stop Mic",
    placeholder: language.startsWith("ta") ? "மைக் வேலை செய்யாவிட்டால் உங்கள் பதிலை இங்கே தட்டச்சு செய்யவும்…" : language.startsWith("hi") ? "यदि माइक काम न करे तो अपना उत्तर यहाँ लिखें…" : "Type your answer if mic is unavailable…",
    send: language.startsWith("ta") ? "அனுப்பு" : language.startsWith("hi") ? "भेजें" : "Send",
    doneQuestion: language.startsWith("ta") ? "அறிகுறிகள் கூறி முடித்துவிட்டீர்களா?" : language.startsWith("hi") ? "क्या आपके लक्षण पूरे हो गए?" : "Done with your symptoms?",
    finishBtn: language.startsWith("ta") ? "முடித்து ஆவணங்களைப் பதிவேற்றுக ➔" : language.startsWith("hi") ? "पूरा करें और दस्तावेज़ अपलोड करें ➔" : "Finish & Upload Documents ➔",
    savingBtn: language.startsWith("ta") ? "சேமிக்கிறது…" : language.startsWith("hi") ? "सहेज रहा है…" : "Saving…",
    completeTitle: language.startsWith("ta") ? "நேர்காணல் முழுமை பெற்றது." : language.startsWith("hi") ? "साक्षात्कार पूरा हो गया है।" : "That’s everything for the interview.",
    continueDocsBtn: language.startsWith("ta") ? "ஆவணங்கள் பதிவேற்றத்திற்குச் செல்க ➔" : language.startsWith("hi") ? "दस्तावेज़ों पर आगे बढ़ें ➔" : "Continue to Documents ➔",
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div>
      <p className="eyebrow">{labels.step}</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 28, marginTop: 4, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
            {labels.title}
          </h1>
          <p style={{ color: "var(--slate)", fontSize: 14.5, margin: 0 }}>
            {labels.subtitle}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {liveState === "CONNECTED" && (
            <span style={{ background: "#dcfce7", color: "#166534", padding: "6px 14px", borderRadius: 14, fontSize: 13, fontWeight: 600 }}>
              {labels.stateConnected}
            </span>
          )}
          {liveState === "LISTENING" && (
            <span style={{ background: "#fef3c7", color: "#b45309", padding: "6px 14px", borderRadius: 14, fontSize: 13, fontWeight: 600 }}>
              {labels.stateListening}
            </span>
          )}
          {liveState === "THINKING" && (
            <span style={{ background: "#f3e8ff", color: "#7c3aed", padding: "6px 14px", borderRadius: 14, fontSize: 13, fontWeight: 600 }}>
              {labels.stateThinking}
            </span>
          )}
          {liveState === "SPEAKING" && (
            <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "6px 14px", borderRadius: 14, fontSize: 13, fontWeight: 600 }}>
              {labels.stateSpeaking}
            </span>
          )}
          {liveState === "INTERRUPTED" && (
            <span style={{ background: "#fee2e2", color: "#991b1b", padding: "6px 14px", borderRadius: 14, fontSize: 13, fontWeight: 600 }}>
              {labels.stateInterrupted}
            </span>
          )}
          {liveState === "DISCONNECTED" && (
            <span style={{ background: "#f3f4f6", color: "#4b5563", padding: "6px 14px", borderRadius: 14, fontSize: 13, fontWeight: 600 }}>
              {labels.stateDisconnected}
            </span>
          )}
        </div>
      </div>

      {/* AYUSH 10-Domain Visual Guide */}
      {isAyush && (
        <div style={{ marginTop: 14, marginBottom: 14, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#166534", marginBottom: 6 }}>
            {labels.ayushDomainGuide}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {AYUSH_DOMAINS.map((d, idx) => (
              <span
                key={idx}
                style={{
                  background: "#ffffff",
                  border: "1px solid #86efac",
                  color: "#065f46",
                  padding: "3px 8px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {getChipLabel(d)}
              </span>
            ))}
          </div>
        </div>
      )}

      {redFlags.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <RedFlagBanner
            tone="amber"
            flags={[
              language.startsWith("ta")
                ? "அவசர அறிகுறி கண்டறியப்பட்டது! உடனடியாக மருத்துவருக்குத் தெரிவிக்கப்பட்டுள்ளது."
                : language.startsWith("hi")
                ? "आपातकालीन लक्षण पहचाना गया! डॉक्टर को तुरंत सूचित कर दिया गया है।"
                : "Emergency symptom identified! Doctor notified immediately."
            ]}
          />
        </div>
      )}

      {/* Full Multi-lingual Conversation Transcript */}
      <div className="card" style={{ marginBottom: 18, maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "ai" ? "flex-start" : "flex-end",
              background: m.role === "ai" ? "var(--teal-tint)" : "var(--paper)",
              border: m.role === "ai" ? "none" : "1px solid var(--line)",
              borderRadius: 14,
              padding: "10px 16px",
              maxWidth: "80%",
              fontSize: 15.5,
              lineHeight: 1.5,
            }}
          >
            {m.text}
          </div>
        ))}
        {patientTranscript && (
          <div style={{ alignSelf: "flex-end", background: "#fef9c3", borderRadius: 14, padding: "8px 14px", fontSize: 14, fontStyle: "italic", color: "#854d0e" }}>
            🎙️ {patientTranscript}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div className="banner banner-red" style={{ marginBottom: 16 }}>{error}</div>}

      {!complete ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Quick response helper chips in selected language */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--surface)", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line)" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--slate)" }}>
              {labels.chipsTitle}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(isAyush ? AYUSH_QUICK_CHIPS : GENERAL_QUICK_CHIPS).map((chip, idx) => {
                const label = getChipLabel(chip);
                return (
                  <button
                    key={idx}
                    type="button"
                    className="btn btn-sm"
                    onClick={() => commitPatientTurn(label)}
                    style={{
                      background: isAyush ? "#f0fdf4" : "var(--paper)",
                      border: isAyush ? "1px solid #86efac" : "1px solid var(--line)",
                      color: isAyush ? "#065f46" : "var(--ink)",
                      borderRadius: 16,
                      padding: "5px 12px",
                      fontSize: 12.5,
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text input + mic toggle */}
          <form onSubmit={handleSendTextFallback} style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => (liveState === "LISTENING" || liveState === "SPEAKING" ? stopLiveMicrophone() : startLiveMicrophone())}
              style={{
                minWidth: 140,
                background: liveState === "LISTENING" ? "#fef3c7" : undefined,
                borderColor: liveState === "LISTENING" ? "#f59e0b" : undefined,
              }}
            >
              {liveState === "LISTENING" || liveState === "SPEAKING" ? labels.stopMic : labels.startMic}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={labels.placeholder}
              style={{ flex: 1, fontSize: 16, padding: "13px 16px", borderRadius: 10, border: "1.5px solid var(--line)" }}
            />
            <button className="btn btn-primary" disabled={!input.trim()}>{labels.send}</button>
          </form>

          {/* Finish & proceed */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <span style={{ fontSize: 14, color: "var(--slate)" }}>{labels.doneQuestion}</span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleFinishInterview}
              disabled={isFinalizing}
              style={{ padding: "12px 24px", fontSize: 15, fontWeight: 600 }}
            >
              {isFinalizing ? labels.savingBtn : labels.finishBtn}
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", background: "var(--teal-tint)", border: "none" }}>
          <p style={{ marginBottom: 14, fontWeight: 600, fontSize: 17 }}>{labels.completeTitle}</p>
          <button
            className="btn btn-primary"
            style={{ width: "100%", padding: "12px" }}
            disabled={isFinalizing}
            onClick={handleFinishInterview}
          >
            {isFinalizing ? labels.savingBtn : labels.continueDocsBtn}
          </button>
        </div>
      )}
    </div>
  );
}
