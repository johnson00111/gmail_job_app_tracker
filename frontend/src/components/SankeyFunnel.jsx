import { useState, useMemo } from "react";
import { GC, T, STATUS_ORDER } from "./ui";

export default function SankeyFunnel({ data }) {
  const [hL, setHL] = useState(null);
  const [hN, setHN] = useState(null);

  const c = useMemo(() => {
    const o = {};
    STATUS_ORDER.forEach((s) => (o[s] = 0));
    data.forEach((d) => { if (o[d.status] !== undefined) o[d.status]++; });
    o.total = data.length;
    o.adv = (o.interview || 0) + (o.action_needed || 0) + (o.offer || 0);
    o.nr = o.applied || 0;
    o.rej = o.rejected || 0;
    return o;
  }, [data]);

  const W = 700, H = 280, pad = 24, nW = 13;
  const sc = (H - pad * 2) / Math.max(c.total, 1);
  const gap = 14;

  const pos = {};
  pos.sent = { x: pad, y: pad, h: c.total * sc };

  const mid = [["adv", c.adv], ["nr", c.nr], ["rej", c.rej]];
  const midH = mid.reduce((a, [, v]) => a + v * sc, 0) + gap * 2;
  let my = pad + ((H - pad * 2) - midH) / 2;
  mid.forEach(([id, v]) => {
    pos[id] = { x: W * 0.38, y: my, h: Math.max(v * sc, 2) };
    my += v * sc + gap;
  });

  let ry = pos.adv.y;
  [["iv", c.interview || 0], ["act", c.action_needed || 0]].forEach(([id, v]) => {
    pos[id] = { x: W * 0.72, y: ry, h: Math.max(v * sc, 2) };
    ry += v * sc + gap;
  });
  pos.off = { x: W - pad - nW, y: pos.adv.y, h: Math.max((c.offer || 0) * sc, 2) };

  const ns = [
    { id: "sent", l: "Sent", cl: T.primary },
    { id: "adv", l: "Advanced", cl: "#2563eb" },
    { id: "nr", l: "No Reply", cl: "#a78bfa" },
    { id: "rej", l: "Rejected", cl: "#d1d5db" },
    { id: "iv", l: "Interview", cl: "#2563eb" },
    { id: "act", l: "Action", cl: "#dc2626" },
    { id: "off", l: "Offer", cl: "#059669" },
  ];

  const lk = [
    { f: "sent", t: "adv", v: c.adv, cl: "#2563eb" },
    { f: "sent", t: "nr", v: c.nr, cl: "#a78bfa" },
    { f: "sent", t: "rej", v: c.rej, cl: "#d1d5db" },
    { f: "adv", t: "iv", v: c.interview || 0, cl: "#2563eb" },
    { f: "adv", t: "act", v: c.action_needed || 0, cl: "#dc2626" },
    { f: "adv", t: "off", v: c.offer || 0, cl: "#059669" },
  ];

  const fo = {}, to = {};
  Object.keys(pos).forEach((k) => { fo[k] = 0; to[k] = 0; });

  const ps = lk.map((l) => {
    const f = fo[l.f] || 0, t2 = to[l.t] || 0;
    const fP = pos[l.f], tP = pos[l.t];
    const h = Math.max(l.v * sc, 1.5);
    const x1 = fP.x + nW, x2 = tP.x;
    const y1 = fP.y + f, y2 = tP.y + t2;
    const cx = (x1 + x2) / 2;
    fo[l.f] = f + l.v * sc;
    to[l.t] = t2 + l.v * sc;
    return { ...l, d: `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2} L${x2},${y2 + h} C${cx},${y2 + h} ${cx},${y1 + h} ${x1},${y1 + h} Z` };
  });

  const any = hL !== null || hN !== null;
  const hi = (i) => (hL !== null ? i === hL : hN !== null ? ps[i]?.f === hN || ps[i]?.t === hN : false);

  if (data.length === 0) {
    return (
      <GC style={{ marginBottom: 22, padding: "28px 32px" }}>
        <div style={{ fontSize: 10, color: T.primary, textTransform: "uppercase", letterSpacing: 3, fontWeight: 700 }}>Pipeline</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1c1917", marginTop: 4 }}>Application Funnel</div>
        <div style={{ color: "#d6d3d1", fontSize: 14, textAlign: "center", padding: 40 }}>No data</div>
      </GC>
    );
  }

  return (
    <GC style={{ marginBottom: 22, padding: "28px 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: T.primary, textTransform: "uppercase", letterSpacing: 3, fontWeight: 700 }}>Pipeline</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1c1917", marginTop: 4 }}>Application Funnel</div>
        </div>
        <span style={{ fontSize: 12, color: "#a8a29e" }}>Hover to explore</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        {ps.map((p, i) => (
          <path
            key={i}
            d={p.d}
            fill={p.cl}
            opacity={any ? (hi(i) ? 0.55 : 0.06) : 0.25}
            style={{ transition: "opacity 0.3s", cursor: "pointer" }}
            onMouseEnter={() => setHL(i)}
            onMouseLeave={() => setHL(null)}
          />
        ))}
        {ns.map((n) => {
          const p = pos[n.id];
          if (!p) return null;
          const isH = hN === n.id || (hL !== null && (ps[hL]?.f === n.id || ps[hL]?.t === n.id));
          return (
            <g key={n.id} onMouseEnter={() => setHN(n.id)} onMouseLeave={() => setHN(null)} style={{ cursor: "pointer" }}>
              <rect x={p.x} y={p.y} width={nW} height={p.h} rx={4} fill={n.cl} opacity={any ? (isH ? 1 : 0.25) : 0.85} style={{ transition: "opacity 0.3s" }} />
              <text
                x={p.x < W / 2 ? p.x - 8 : p.x + nW + 8}
                y={p.y + p.h / 2}
                textAnchor={p.x < W / 2 ? "end" : "start"}
                dominantBaseline="middle"
                fontSize="12"
                fontWeight="600"
                fill={isH ? n.cl : "#78716c"}
                style={{ transition: "fill 0.2s" }}
              >
                {n.l}
              </text>
            </g>
          );
        })}
        {hL !== null && ps[hL] && (
          <g>
            <rect x={W / 2 - 60} y={4} width={120} height={26} rx={8} fill="#292524" opacity=".9" />
            <text x={W / 2} y={20} textAnchor="middle" fontSize="11" fontWeight="500" fill="#fff">
              {ns.find((n) => n.id === ps[hL].f)?.l} → {ns.find((n) => n.id === ps[hL].t)?.l}: {ps[hL].v}
            </text>
          </g>
        )}
      </svg>
    </GC>
  );
}