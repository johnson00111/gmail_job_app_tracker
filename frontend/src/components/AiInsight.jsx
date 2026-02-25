import { useState, useMemo } from "react";
import { GC, T, STATUS_ORDER } from "./ui";
import { chatAI } from "../api/client";

export default function AiInsight({ data }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [typing, setTyping] = useState(false);

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

  // Send message to Ollama via backend
  const send = async () => {
    const q = input.trim();
    if (!q || typing) return;

    setMsgs((p) => [...p, { r: "u", t: q }]);
    setInput("");
    setTyping(true);
    setExpanded(true);

    try {
      const res = await chatAI(q);
      const reply = res.reply || res.message || "No response.";
      setMsgs((p) => [...p, { r: "a", t: reply }]);
    } catch (err) {
      setMsgs((p) => [...p, { r: "a", t: `⚠️ ${err.message}. Make sure Ollama + FastAPI are running.` }]);
    } finally {
      setTyping(false);
    }
  };

  const quickAsk = (q) => {
    setMsgs((p) => [...p, { r: "u", t: q }]);
    setTyping(true);
    setExpanded(true);
    chatAI(q)
      .then((res) => setMsgs((p) => [...p, { r: "a", t: res.reply || res.message || "No response." }]))
      .catch((err) => setMsgs((p) => [...p, { r: "a", t: `⚠️ ${err.message}` }]))
      .finally(() => setTyping(false));
  };

  return (
    <GC glow={T.glow} style={{ marginBottom: 22, padding: 0, overflow: "hidden" }}>
      {/* Top gradient bar */}
      <div style={{ height: 3, background: "linear-gradient(90deg, #92400e, #d97706, #f59e0b, #fbbf24)" }} />

      <div style={{ padding: "20px 24px" }}>
        {/* Header + Auto Summary */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <img
            src="https://github.com/ollama.png"
            alt="Ollama"
            style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover", boxShadow: "0 2px 10px rgba(217,119,6,0.2)" }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: T.primary, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>
              AI Insight · Ollama
            </div>
            <div style={{ fontSize: 14, color: "#44403c", marginTop: 4, lineHeight: 1.6 }}>
              {auto}
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        {expanded && msgs.length > 0 && (
          <div
            style={{
              maxHeight: 240, overflowY: "auto", marginBottom: 14,
              display: "flex", flexDirection: "column", gap: 10,
              padding: "12px 0", borderTop: "1px solid rgba(245,245,244,0.8)",
            }}
          >
            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.r === "u" ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    maxWidth: "80%", padding: "10px 16px", borderRadius: 14, fontSize: 13, lineHeight: 1.6,
                    ...(m.r === "u"
                      ? { background: T.grad, color: "#fff", borderBottomRightRadius: 4 }
                      : { background: "rgba(245,245,244,0.8)", color: "#44403c", borderBottomLeftRadius: 4 }),
                  }}
                >
                  {m.t}
                </div>
              </div>
            ))}
            {typing && (
              <div style={{ display: "flex" }}>
                <div style={{ background: "rgba(245,245,244,0.8)", padding: "10px 18px", borderRadius: 14, borderBottomLeftRadius: 4 }}>
                  <span style={{ display: "inline-flex", gap: 4 }}>
                    {[0, 1, 2].map((j) => (
                      <span
                        key={j}
                        style={{
                          width: 6, height: 6, borderRadius: "50%", background: "#a8a29e",
                          animation: `dp 1s ${j * 0.15}s infinite`,
                        }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}
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
            disabled={typing}
            style={{
              flex: 1, background: "rgba(250,250,249,0.8)",
              border: "1.5px solid rgba(214,211,209,0.6)", borderRadius: 12,
              padding: "10px 16px", color: "#44403c", fontSize: 13, outline: "none",
            }}
          />
          <button
            onClick={send}
            disabled={typing}
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
    </GC>
  );
}