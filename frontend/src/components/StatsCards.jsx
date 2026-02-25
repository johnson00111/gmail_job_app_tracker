import { useMemo } from "react";
import { GC, AnimNum, T, STATUS_ORDER } from "./ui";

export default function StatsCards({ data }) {
  const counts = useMemo(() => {
    const c = {};
    STATUS_ORDER.forEach((s) => (c[s] = 0));
    data.forEach((d) => { if (c[d.status] !== undefined) c[d.status]++; });
    return c;
  }, [data]);

  const total = data.length;
  const ivN = (counts.interview || 0) + (counts.action_needed || 0) + (counts.offer || 0);
  const pct = (n) => (total > 0 ? (n / total * 100).toFixed(1) : "0.0");

  const cards = [
    { label: "APPLICATIONS", val: total, s: "", grad: T.grad, glow: T.glow },
    { label: "INTERVIEW RATE", val: pct(ivN), s: "%", grad: "linear-gradient(135deg, #06b6d4, #22d3ee)", glow: "rgba(6,182,212,0.12)" },
    { label: "OFFER RATE", val: pct(counts.offer || 0), s: "%", grad: "linear-gradient(135deg, #059669, #34d399)", glow: "rgba(5,150,105,0.12)" },
    { label: "REJECTION RATE", val: pct(counts.rejected || 0), s: "%", grad: "linear-gradient(135deg, #dc2626, #f87171)", glow: "rgba(220,38,38,0.12)" },
  ];

  return (
    <div className="stats-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 22 }}>
      {cards.map((c, i) => (
        <GC key={i} hover glow={c.glow} style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "22px 24px 18px" }}>
            <div style={{ fontSize: 10, color: "#a8a29e", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600 }}>
              {c.label}
            </div>
            <div style={{ color: "#1c1917", marginTop: 6 }}>
              <AnimNum value={c.val} suffix={c.s} />
            </div>
          </div>
          <div style={{ height: 4, background: c.grad }} />
        </GC>
      ))}
    </div>
  );
}