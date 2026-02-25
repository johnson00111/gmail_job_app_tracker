import { useState, useMemo } from "react";
import { GC, AnimNum, T } from "./ui";

function BarItem({ wk, ct, maxV }) {
  const [h, setH] = useState(false);
  return (
    <div
      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: h ? T.accent : T.primary, opacity: ct > 0 ? 1 : 0, transition: "all 0.2s" }}>
        {ct}
      </span>
      <div
        style={{
          width: "100%",
          maxWidth: 52,
          height: `${(ct / maxV) * 140}px`,
          background: h ? T.gradBarHov : T.gradBar,
          borderRadius: 10,
          minHeight: ct > 0 ? 14 : 0,
          boxShadow: h ? "0 6px 20px rgba(217,119,6,0.3)" : "0 2px 8px rgba(217,119,6,0.08)",
          transform: h ? "scaleY(1.06)" : "scaleY(1)",
          transformOrigin: "bottom",
          transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
      <span style={{ fontSize: 11, color: "#a8a29e", fontWeight: 500 }}>{wk.slice(5)}</span>
    </div>
  );
}

export default function WeeklyTrend({ data }) {
  const weekly = useMemo(() => {
    const w = {};
    data.forEach((d) => {
      if (!d.date) return;
      const x = new Date(d.date);
      const ws = new Date(x);
      ws.setDate(x.getDate() - x.getDay());
      const k = ws.toISOString().slice(0, 10);
      w[k] = (w[k] || 0) + 1;
    });
    return Object.entries(w).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  const wMax = Math.max(...weekly.map((w) => w[1]), 1);

  return (
    <GC style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: T.primary, textTransform: "uppercase", letterSpacing: 3, fontWeight: 700 }}>Activity</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1c1917", marginTop: 4 }}>Weekly Trend</div>
          </div>
          <div style={{ borderLeft: "1px solid rgba(214,211,209,0.5)", paddingLeft: 20 }}>
            <div style={{ color: T.primary }}>
              <AnimNum value={data.length} size={32} />
            </div>
            <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 2 }}>emails in range</div>
          </div>
        </div>
      </div>
      {weekly.length === 0 ? (
        <div style={{ color: "#d6d3d1", fontSize: 14, textAlign: "center", padding: 40 }}>No data in this range</div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 200, paddingTop: 10 }}>
          {weekly.map(([wk, ct], i) => (
            <BarItem key={i} wk={wk} ct={ct} maxV={wMax} />
          ))}
        </div>
      )}
    </GC>
  );
}