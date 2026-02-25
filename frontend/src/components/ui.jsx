import { useState, useEffect } from "react";

/* ===== Shared Constants ===== */
export const T = {
  primary: "#d97706",
  accent: "#92400e",
  grad: "linear-gradient(135deg, #d97706, #f59e0b)",
  gradBar: "linear-gradient(180deg, #fbbf24, #d97706)",
  gradBarHov: "linear-gradient(180deg, #92400e, #d97706)",
  glow: "rgba(217,119,6,0.12)",
};

export const statusConfig = {
  action_needed: { label: "Action", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  interview:     { label: "Interview", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  applied:       { label: "Applied", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  offer:         { label: "Offer", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  rejected:      { label: "Rejected", color: "#9ca3af", bg: "#f9fafb", border: "#e5e7eb" },
};

export const STATUS_ORDER = ["action_needed", "interview", "offer", "applied", "rejected"];
export const ROLE_COLORS = ["#d97706", "#06b6d4", "#7c3aed", "#ec4899", "#059669", "#f97316"];

/* ===== Animated Number ===== */
export function AnimNum({ value, suffix = "", size = 38 }) {
  const [d, setD] = useState(0);
  useEffect(() => {
    const n = parseFloat(value) || 0;
    let s = 0;
    const step = Math.max(n / 35, 0.1);
    const iv = setInterval(() => {
      s += step;
      if (s >= n) { setD(n); clearInterval(iv); }
      else setD(Math.floor(s * 10) / 10);
    }, 18);
    return () => clearInterval(iv);
  }, [value]);
  return (
    <span style={{ fontSize: size, fontWeight: 800, letterSpacing: -2 }}>
      {Number.isInteger(d) ? d : d.toFixed(1)}{suffix}
    </span>
  );
}

/* ===== Glass Card ===== */
export function GC({ children, style, glow, hover }) {
  const [h, setH] = useState(false);
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        position: "relative",
        background: "rgba(255,255,255,0.78)",
        backdropFilter: "blur(16px)",
        borderRadius: 20,
        padding: 24,
        border: "1px solid rgba(255,255,255,0.6)",
        boxShadow: h && hover ? `0 12px 40px ${glow || T.glow}` : "0 2px 12px rgba(0,0,0,0.03)",
        transform: h && hover ? "translateY(-3px)" : "none",
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        cursor: hover ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}