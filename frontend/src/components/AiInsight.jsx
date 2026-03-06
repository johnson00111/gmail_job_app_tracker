import { useState, useMemo, useRef } from "react";
import { GC, T, STATUS_ORDER } from "./ui";
import { chatAIStream } from "../api/client";

/* ── Provider display config ── */
const PROVIDER_META = {
  ollama: {
    label: "AI Insight · Ollama",
    icon: "https://github.com/ollama.png",
  },
  gemini: {
    label: "AI Insight · Gemini",
    icon: null,
  },
};

function GeminiIcon({ size = 34 }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 10,
        background: "linear-gradient(135deg, #4285F4, #A142F4, #FA7B17)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 2px 10px rgba(66,133,244,0.25)",
      }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
          fill="white" opacity="0.95"
        />
      </svg>
    </div>
  );
}

function ProviderBadge({ provider }) {
  const meta = PROVIDER_META[provider] || PROVIDER_META.ollama;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {provider === "gemini" ? (
        <GeminiIcon />
      ) : (
        <img
          src={meta.icon}
          alt={provider}
          style={{
            width: 34, height: 34, borderRadius: 10, objectFit: "cover",
            boxShadow: "0 2px 10px rgba(217,119,6,0.2)",
          }}
        />
      )}
      <div
        style={{
          fontSize: 10, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700,
          color: provider === "gemini" ? "#4285F4" : T.primary,
        }}
      >
        {meta.label}
      </div>
    </div>
  );
}

export default function AiInsight({ data }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [provider, setProvider] = useState("ollama");
  const abortRef = useRef(null);

  // Compute stats for auto summary
  const counts = useMemo(() => {
    const c = {};
    STATUS_ORDER.forEach((s) => (c[s] = 0));
    data.forEach((d) => { if (c[d.status] !== undefined) c[d.status]++; });
    return c;
  }, [data]);

  const total = data.length;
  const acts = data.filter((d) => d.status === "action_needed");
  const ivN = (counts.interview || 0) + (counts.action_needed || 0) + (counts.offer || 0);

  const auto = useMemo(() => {
    const p = [];
    if (acts.length > 0) p.push(`You have ${acts.length} action item${acts.length > 1 ? "s" : ""} that need attention.`);
    if (total > 0) p.push(`Interview conversion is ${((ivN / total) * 100).toFixed(0)}% across ${total} applications.`);
    if (counts.offer > 0) p.push(`${counts.offer} offer received — congrats!`);
    if (counts.rejected > 3) p.push(`${counts.rejected} rejections — totally normal, keep pushing.`);
    return p.length ? p.join(" ") : "No applications tracked yet. Hit Sync to get started.";
  }, [acts.length, total, ivN, counts.offer, counts.rejected]);

  // Stream a chat message
  const send = () => {
    const q = input.trim();
    if (!q || streaming) return;

    // Add user message, then an empty assistant message to fill in
    setMsgs((p) => [...p, { r: "u", t: q }, { r: "a", t: "" }]);
    setInput("");
    setStreaming(true);
    setExpanded(true);

    abortRef.current = chatAIStream(q, {
      onToken: (token, prov) => {
        if (prov) setProvider(prov);
        // Append token to the last (assistant) message
        setMsgs((p) => {
          const updated = [...p];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, t: last.t + token };
          return updated;
        });
      },
      onDone: () => {
        setStreaming(false);
        abortRef.current = null;
      },
      onError: (err) => {
        setMsgs((p) => {
          const updated = [...p];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = {
            ...last,
            t: last.t || `⚠️ ${err.message}. Make sure the backend is running.`,
          };
          return updated;
        });
        setStreaming(false);
        abortRef.current = null;
      },
    });
  };

  const quickAsk = (q) => {
    setInput(q);
    // Use setTimeout so the input state updates before send() reads it
    setTimeout(() => {
      setMsgs((p) => [...p, { r: "u", t: q }, { r: "a", t: "" }]);
      setStreaming(true);
      setExpanded(true);

      abortRef.current = chatAIStream(q, {
        onToken: (token, prov) => {
          if (prov) setProvider(prov);
          setMsgs((p) => {
            const updated = [...p];
            const last = updated[updated.length - 1];
            updated[updated.length - 1] = { ...last, t: last.t + token };
            return updated;
          });
        },
        onDone: () => {
          setStreaming(false);
          setInput("");
          abortRef.current = null;
        },
        onError: (err) => {
          setMsgs((p) => {
            const updated = [...p];
            const last = updated[updated.length - 1];
            updated[updated.length - 1] = { ...last, t: last.t || `⚠️ ${err.message}` };
            return updated;
          });
          setStreaming(false);
          setInput("");
          abortRef.current = null;
        },
      });
    }, 0);
  };

  return (
    <GC glow={T.glow} style={{ marginBottom: 22, padding: 0, overflow: "hidden" }}>
      {/* Top gradient bar */}
      <div
        style={{
          height: 3,
          background: provider === "gemini"
            ? "linear-gradient(90deg, #4285F4, #A142F4, #FA7B17, #0F9D58)"
            : "linear-gradient(90deg, #92400e, #d97706, #f59e0b, #fbbf24)",
        }}
      />

      <div style={{ padding: "20px 24px" }}>
        {/* Header + Auto Summary */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <ProviderBadge provider={provider} />
            <div style={{ fontSize: 14, color: "#44403c", marginTop: 8, lineHeight: 1.6, paddingLeft: 46 }}>
              {auto}
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        {expanded && msgs.length > 0 && (
          <div
            style={{
              maxHeight: 320, overflowY: "auto", marginBottom: 14,
              display: "flex", flexDirection: "column", gap: 10,
              padding: "12px 0", borderTop: "1px solid rgba(245,245,244,0.8)",
            }}
          >
            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.r === "u" ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    maxWidth: "80%", padding: "10px 16px", borderRadius: 14, fontSize: 13, lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    ...(m.r === "u"
                      ? { background: T.grad, color: "#fff", borderBottomRightRadius: 4 }
                      : { background: "rgba(245,245,244,0.8)", color: "#44403c", borderBottomLeftRadius: 4 }),
                  }}
                >
                  {m.t || (streaming && i === msgs.length - 1 ? "" : "No response.")}
                  {/* Blinking cursor while streaming */}
                  {streaming && m.r === "a" && i === msgs.length - 1 && (
                    <span
                      style={{
                        display: "inline-block", width: 2, height: 14,
                        background: "#78716c", marginLeft: 2, verticalAlign: "text-bottom",
                        animation: "blink 0.8s infinite",
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            onFocus={() => setExpanded(true)}
            placeholder="Ask about your applications..."
            disabled={streaming}
            style={{
              flex: 1, background: "rgba(250,250,249,0.8)",
              border: "1.5px solid rgba(214,211,209,0.6)", borderRadius: 12,
              padding: "10px 16px", color: "#44403c", fontSize: 13, outline: "none",
            }}
          />
          <button
            onClick={send}
            disabled={streaming}
            style={{
              width: 38, height: 38, borderRadius: 12, border: "none", cursor: "pointer",
              background: input.trim() ? T.grad : "rgba(245,245,244,0.8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: input.trim() ? "0 2px 10px rgba(217,119,6,0.25)" : "none",
              transition: "all 0.2s",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? "#fff" : "#a8a29e"} strokeWidth="2" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>

        {/* Quick Suggestions */}
        {expanded && msgs.length === 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {["What should I prioritize?", "How's my interview rate?", "Any strategy tips?", "Help me improve"].map((q) => (
              <button
                key={q}
                onClick={() => quickAsk(q)}
                disabled={streaming}
                style={{
                  padding: "6px 14px", borderRadius: 99, fontSize: 11, fontWeight: 500,
                  border: "1.5px solid rgba(214,211,209,0.6)",
                  background: "rgba(255,255,255,0.5)", color: "#78716c", cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = "rgba(217,119,6,0.06)"; e.currentTarget.style.color = T.primary; }}
                onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.5)"; e.currentTarget.style.color = "#78716c"; }}
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Blink cursor animation */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </GC>
  );
}