import { useState, useMemo } from "react";
import { GC, AnimNum, T } from "./ui";

const GRANULARITIES = [
  { key: "day", label: "Day" },
  { key: "3d", label: "3D" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

function bucketKey(dateStr, gran) {
  const d = new Date(dateStr);
  if (gran === "day") {
    return dateStr.slice(0, 10);
  }
  if (gran === "3d") {
    // 3-day buckets: floor to nearest 3 days from epoch
    const epoch = new Date("2026-01-01");
    const diff = Math.floor((d - epoch) / (1000 * 60 * 60 * 24));
    const bucket = new Date(epoch);
    bucket.setDate(bucket.getDate() + Math.floor(diff / 3) * 3);
    return bucket.toISOString().slice(0, 10);
  }
  if (gran === "week") {
    const ws = new Date(d);
    ws.setDate(d.getDate() - d.getDay() + 1); // Monday start
    return ws.toISOString().slice(0, 10);
  }
  if (gran === "month") {
    return dateStr.slice(0, 7); // YYYY-MM
  }
  return dateStr.slice(0, 10);
}

function formatLabel(key, gran) {
  if (gran === "month") {
    // "2026-02" → "Feb"
    const [y, m] = key.split("-");
    const d = new Date(Number(y), Number(m) - 1);
    return d.toLocaleString("en", { month: "short" });
  }
  // "2026-02-20" → "02-20"
  return key.slice(5);
}

function BarItem({ label, ct, maxV, gran }) {
  const [h, setH] = useState(false);
  const isNarrow = gran === "day" || gran === "3d";
  return (
    <div
      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: isNarrow ? 20 : 36 }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    >
      <span style={{
        fontSize: isNarrow ? 10 : 12, fontWeight: 700,
        color: h ? T.accent : T.primary,
        opacity: ct > 0 ? 1 : 0, transition: "all 0.2s",
      }}>
        {ct}
      </span>
      <div
        style={{
          width: "100%",
          maxWidth: isNarrow ? 32 : 52,
          height: `${(ct / maxV) * 140}px`,
          background: h ? T.gradBarHov : T.gradBar,
          borderRadius: isNarrow ? 6 : 10,
          minHeight: ct > 0 ? 14 : 0,
          boxShadow: h ? "0 6px 20px rgba(217,119,6,0.3)" : "0 2px 8px rgba(217,119,6,0.08)",
          transform: h ? "scaleY(1.06)" : "scaleY(1)",
          transformOrigin: "bottom",
          transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
      <span style={{
        fontSize: isNarrow ? 9 : 11, color: "#a8a29e", fontWeight: 500,
        whiteSpace: "nowrap",
      }}>
        {label}
      </span>
    </div>
  );
}

export default function Trend({ data }) {
  const [gran, setGran] = useState("day");

  const grouped = useMemo(() => {
    const m = {};
    data.forEach((d) => {
      if (!d.date) return;
      const k = bucketKey(d.date, gran);
      m[k] = (m[k] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data, gran]);

  const maxV = Math.max(...grouped.map((g) => g[1]), 1);

  return (
    <GC style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: T.primary, textTransform: "uppercase", letterSpacing: 3, fontWeight: 700 }}>Activity</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1c1917", marginTop: 4 }}>Trend</div>
          </div>
          <div style={{ borderLeft: "1px solid rgba(214,211,209,0.5)", paddingLeft: 20 }}>
            <div style={{ color: T.primary }}>
              <AnimNum value={data.length} size={32} />
            </div>
            <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 2 }}>in range</div>
          </div>
        </div>

        {/* Granularity toggle */}
        <div style={{ display: "flex", gap: 3, background: "rgba(245,245,244,0.7)", borderRadius: 10, padding: 3 }}>
          {GRANULARITIES.map((g) => (
            <button
              key={g.key}
              onClick={() => setGran(g.key)}
              style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                border: "none", cursor: "pointer",
                background: gran === g.key ? "rgba(255,255,255,0.9)" : "transparent",
                color: gran === g.key ? T.primary : "#a8a29e",
                boxShadow: gran === g.key ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.2s",
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <div style={{ color: "#d6d3d1", fontSize: 14, textAlign: "center", padding: 40 }}>No data in this range</div>
      ) : (
        <div style={{
          display: "flex", alignItems: "flex-end", gap: grouped.length > 20 ? 4 : 14,
          height: 200, paddingTop: 10, overflowX: grouped.length > 25 ? "auto" : "visible",
        }}>
          {grouped.map(([k, ct], i) => (
            <BarItem key={i} label={formatLabel(k, gran)} ct={ct} maxV={maxV} gran={gran} />
          ))}
        </div>
      )}
    </GC>
  );
}