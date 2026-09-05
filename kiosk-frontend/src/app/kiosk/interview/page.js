"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { loadActiveSession, saveActiveSession, upsertQueueEntry } from "@/lib/registry";
import { finalizeSession } from "@/lib/api";
import RedFlagBanner from "@/components/RedFlagBanner";

export default function LiveInterviewPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState(null);
  const [language, setLanguage] = useState("en");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [redFlags, setRedFlags] = useState([]);
  const [complete, setComplete] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [error, setError] = useState(null);

  // Live Assistant UI states
  const [liveState, setLiveState] = useState("CONNECTING");
  const [patientTranscript, setPatientTranscript] = useState("");

  // Refs – stable across renders, no stale closure issues
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
  const completeRef = useRef(false); // mirror of `complete` state for stable closures
  const sessionIdRef = useRef(null);
  const micStoppedRef = useRef(false);

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

  // ─── Audio: Stop Microphone (stable, does not close AudioCtx) ────────────────
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
      // Schedule playback smoothly without forced 60ms gap per chunk
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

  // ─── Submit patient turn → Gemini ────────────────────────────────────────────
  const commitPatientTurn = useCallback((text) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return;

    ensureAudioContext();

    // Only interrupt playback if AI is actually speaking
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
        // Echo gate: skip sending mic audio while AI is speaking to prevent loopback
        if (isAiSpeakingRef.current || micStoppedRef.current) return;
        const pcm = resampleTo16kPcm(e.inputBuffer.getChannelData(0), ctx.sampleRate);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "audio_pcm_chunk", data: pcm }));
        }
      };
      src.connect(proc);
      proc.connect(ctx.destination);

      // Web Speech Recognition for zero-latency transcript + auto turn submission
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = language.startsWith("hi") ? "hi-IN" : language.startsWith("ta") ? "ta-IN" : "en-IN";

        rec.onresult = (e) => {
          if (isAiSpeakingRef.current || micStoppedRef.current) return; // ignore self-echo

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
            // Immediately commit finalised utterance
            commitPatientTurn(final.trim());
          } else {
            // 400 ms silence → fast turn submission
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
          // Restart speech recognition automatically unless stopped or complete
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
    setSessionId(sId);
    sessionIdRef.current = sId;
    setLanguage(pLang);
    setRedFlags(active.redFlags || []);

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
            const last = m[m.length - 1];
            if (last && last.role === "ai") {
              return [...m.slice(0, -1), { role: "ai", text: last.text + msg.text }];
            }
            return [...m, { role: "ai", text: msg.text }];
          });
        } else if (msg.type === "patient_transcript" && msg.text) {
          setPatientTranscript(msg.text);
        } else if (msg.type === "turn_complete") {
          // AI finished its turn → back to listening
          if (!isAiSpeakingRef.current) setLiveState("LISTENING");
        } else if (msg.type === "red_flags" && Array.isArray(msg.redFlags)) {
          setRedFlags((prev) => {
            const merged = [...prev, ...msg.redFlags];
            upsertQueueEntry(sId, { redFlags: merged });
            saveActiveSession({ redFlags: merged });
            return merged;
          });
        } else if (msg.type === "complete") {
          completeRef.current = true;
          setComplete(true);
          setLiveState("DISCONNECTED");
          // stopLiveMicrophone is stable (useCallback) — safe to call here
          stopLiveMicrophone();
          saveActiveSession({ sessionComplete: true });
          upsertQueueEntry(sId, { status: "interview_complete" });
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
      // Non-blocking trigger so extraction completes in background while UI transitions instantly
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

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div>
      <p className="eyebrow">Step 4 of 6</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 30, marginTop: 8, marginBottom: 6 }}>Live AI Intake</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {liveState === "CONNECTED" && (
            <span style={{ background: "#dcfce7", color: "#166534", padding: "6px 14px", borderRadius: 14, fontSize: 13, fontWeight: 600 }}>
              🟢 Connected
            </span>
          )}
          {liveState === "LISTENING" && (
            <span style={{ background: "#fef3c7", color: "#b45309", padding: "6px 14px", borderRadius: 14, fontSize: 13, fontWeight: 600 }}>
              🎙️ Listening…
            </span>
          )}
          {liveState === "THINKING" && (
            <span style={{ background: "#f3e8ff", color: "#7c3aed", padding: "6px 14px", borderRadius: 14, fontSize: 13, fontWeight: 600 }}>
              💭 Thinking…
            </span>
          )}
          {liveState === "SPEAKING" && (
            <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "6px 14px", borderRadius: 14, fontSize: 13, fontWeight: 600 }}>
              🔊 AI Speaking
            </span>
          )}
          {liveState === "INTERRUPTED" && (
            <span style={{ background: "#fee2e2", color: "#991b1b", padding: "6px 14px", borderRadius: 14, fontSize: 13, fontWeight: 600 }}>
              ⏸️ Interrupted
            </span>
          )}
          {liveState === "DISCONNECTED" && (
            <span style={{ background: "#f3f4f6", color: "#4b5563", padding: "6px 14px", borderRadius: 14, fontSize: 13, fontWeight: 600 }}>
              🔴 Text Mode
            </span>
          )}
        </div>
      </div>

      <p style={{ color: "var(--slate)", marginBottom: 16 }}>
        Speak naturally — the AI will listen and reply instantly. You can speak over the AI at any time.
      </p>

      {redFlags.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <RedFlagBanner tone="amber" flags={["Emergency symptom identified! Doctor notified immediately."]} />
        </div>
      )}

      {/* Conversation Transcript */}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Text fallback + mic toggle */}
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
              {liveState === "LISTENING" || liveState === "SPEAKING" ? "🛑 Stop Mic" : "🎙️ Start Mic"}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer if mic is unavailable…"
              style={{ flex: 1, fontSize: 16, padding: "13px 16px", borderRadius: 10, border: "1.5px solid var(--line)" }}
            />
            <button className="btn btn-primary" disabled={!input.trim()}>Send</button>
          </form>

          {/* Finish & proceed */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <span style={{ fontSize: 14, color: "var(--slate)" }}>Done with your symptoms?</span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleFinishInterview}
              disabled={isFinalizing}
              style={{ padding: "12px 24px", fontSize: 15, fontWeight: 600 }}
            >
              {isFinalizing ? "Saving…" : "Finish & Upload Documents ➔"}
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", background: "var(--teal-tint)", border: "none" }}>
          <p style={{ marginBottom: 14, fontWeight: 600, fontSize: 17 }}>That&rsquo;s everything for the interview.</p>
          <button
            className="btn btn-primary"
            style={{ width: "100%", padding: "12px" }}
            disabled={isFinalizing}
            onClick={handleFinishInterview}
          >
            {isFinalizing ? "Proceeding…" : "Continue to Documents ➔"}
          </button>
        </div>
      )}
    </div>
  );
}
