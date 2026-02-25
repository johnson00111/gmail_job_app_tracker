import { useState, useMemo } from "react";
import { GC, T, ROLE_COLORS } from "./ui";

/* ===== Action Card ===== */
function ActCard({ it }) {
  const [h, setH] = useState(false);
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 14,
        background: h ? "rgba(254,242,242,0.9)" : "rgba(255,251,251,0.8)",
        border: "1px solid #fecaca",
        transform: h ? "scale(1.015)" : "scale(1)",
        boxShadow: h ? "0 8px 24px rgba(220,38,38,0.08)" : "none",
        transition: "all 0.25s",
        backdropFilter: "blur(8px)",
        marginBottom: 8,
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 11,
        background: "linear-gradient(135deg, #fecaca, #fca5a5)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, color: "#1c1917", fontSize: 14 }}>{it.company}</span>
          <span style={{ fontSize: 11, color: "#a8a29e", background: "rgba(250,250,249,0.8)", padding: "2px 10px", borderRadius: 6 }}>{it.role}</span>
        </div>
        <div style={{ color: "#dc2626", fontSize: 12, marginTop: 3, fontWeight: 600 }}>{it.action}</div>
      </div>
    </div>
  );
}

/* ===== Role Bar ===== */
function RBar({ role, ct, total, i }) {
  const [h, setH] = useState(false);
  const p = total > 0 ? (ct / total) * 100 : 0;
  const c = ROLE_COLORS[i % ROLE_COLORS.length];
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: "#292524", fontWeight: 600 }}>{role}</span>
        <span style={{ fontSize: 12, color: "#a8a29e" }}>{ct} ({p.toFixed(0)}%)</span>
      </div>
      <div style={{ background: "rgba(245,245,244,0.8)", borderRadius: 6, height: 10, overflow: "hidden" }}>
        <div
          style={{
            width: `${p}%`, height: "100%",
            background: `linear-gradient(90deg, ${c}, ${c}aa)`,
            borderRadius: 6, minWidth: p > 0 ? 10 : 0,
            boxShadow: h ? `0 0 12px ${c}44` : "none",
            transition: "all 0.3s",
          }}
        />
      </div>
    </div>
  );
}

/* ===== Action Items Card ===== */
export default function ActionItems({ data }) {
  const acts = useMemo(() => data.filter((d) => d.status === "action_needed"), [data]);

  return (
    <GC>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: "#dc2626", textTransform: "uppercase", letterSpacing: 3, fontWeight: 700 }}>Urgent</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1c1917", marginTop: 4 }}>Action Items</div>
        </div>
        {acts.length > 0 && (
          <span style={{
            background: "linear-gradient(135deg, #fecaca, #fca5a5)", color: "#dc2626",
            fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99, marginLeft: "auto",
          }}>
            {acts.length}
          </span>
        )}
      </div>
      {acts.length === 0 ? (
        <div style={{ color: "#d6d3d1", fontSize: 14, textAlign: "center", padding: 24 }}>All clear</div>
      ) : (
        acts.map((it) => <ActCard key={it.id} it={it} />)
      )}
    </GC>
  );
}

/* ===== By Role Card ===== */
export function ByRole({ data }) {
  const total = data.length;
  const roleData = useMemo(() => {
    const rc = {};
    data.forEach((d) => { if (d.role) rc[d.role] = (rc[d.role] || 0) + 1; });
    return Object.entries(rc).sort((a, b) => b[1] - a[1]);
  }, [data]);

  return (
    <GC>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: T.primary, textTransform: "uppercase", letterSpacing: 3, fontWeight: 700 }}>Breakdown</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1c1917", marginTop: 4 }}>By Role</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {roleData.length === 0 ? (
          <div style={{ color: "#d6d3d1", fontSize: 14, textAlign: "center", padding: 24 }}>No data</div>
        ) : (
          roleData.map(([role, ct], i) => <RBar key={role} role={role} ct={ct} total={total} i={i} />)
        )}
      </div>
    </GC>
  );
}