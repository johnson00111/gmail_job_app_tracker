import { useState } from "react";
import { GC, T, statusConfig, STATUS_ORDER } from "./ui";

/* ===== Filter Button ===== */
function FBtn({ label, active, color, onClick }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        padding: "6px 16px", borderRadius: 99, fontSize: 12, cursor: "pointer", fontWeight: 600,
        border: active ? "none" : "1.5px solid rgba(214,211,209,0.6)",
        background: active ? color : h ? "rgba(250,250,249,0.9)" : "rgba(255,255,255,0.7)",
        color: active ? "#fff" : "#78716c",
        transform: h && !active ? "translateY(-1px)" : "none",
        transition: "all 0.2s",
      }}
    >
      {label}
    </button>
  );
}

/* ===== Expandable Row ===== */
function ERow({ row, cfg, isOpen, toggle }) {
  const [h, setH] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid rgba(245,245,244,0.8)" }}>
      <div
        onClick={toggle}
        onMouseEnter={() => setH(true)}
        onMouseLeave={() => setH(false)}
        style={{
          display: "grid",
          gridTemplateColumns: "90px 1.2fr 130px 100px 1fr 36px",
          alignItems: "center",
          padding: "14px 20px",
          cursor: "pointer",
          background: isOpen || h ? "rgba(255,251,245,0.9)" : "rgba(255,255,255,0.6)",
          transition: "background 0.15s",
        }}
      >
        <span style={{ fontSize: 12, color: "#a8a29e" }}>{row.date}</span>
        <span style={{ color: "#1c1917", fontWeight: 700, fontSize: 14 }}>{row.company}</span>
        <span style={{ color: "#78716c", fontSize: 13 }}>{row.role || "—"}</span>
        <span>
          <span
            style={{
              background: cfg.bg, color: cfg.color,
              padding: "3px 12px", borderRadius: 99, fontSize: 11, fontWeight: 600,
              border: `1px solid ${cfg.border}`,
            }}
          >
            {cfg.label}
          </span>
        </span>
        <span style={{ color: row.action ? "#dc2626" : "#d6d3d1", fontWeight: row.action ? 600 : 400, fontSize: 12 }}>
          {row.action || "—"}
        </span>
        <span style={{ color: "#d6d3d1", fontSize: 16, transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.3s", textAlign: "center" }}>
          ▾
        </span>
      </div>
      <div
        style={{
          maxHeight: isOpen ? 130 : 0,
          overflow: "hidden",
          opacity: isOpen ? 1 : 0,
          transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.3s, padding 0.3s",
          padding: isOpen ? "0 20px 16px" : "0 20px",
          background: "rgba(255,251,245,0.9)",
        }}
      >
        <div style={{ background: "rgba(245,245,244,0.7)", borderRadius: 12, padding: "14px 18px", fontSize: 13, color: "#57534e", lineHeight: 1.7 }}>
          {row.summary || "No additional details."}
        </div>
      </div>
    </div>
  );
}

/* ===== Main Table ===== */
export default function ApplicationTable({ data, total, statusFilter, onStatusFilter }) {
  const [openRows, setOpenRows] = useState({});

  return (
    <GC style={{ padding: "28px 28px 20px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: T.primary, textTransform: "uppercase", letterSpacing: 3, fontWeight: 700 }}>Details</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1c1917", marginTop: 4 }}>All Applications</div>
      </div>

      {/* Status filter pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {["all", ...STATUS_ORDER].map((s) => (
          <FBtn
            key={s}
            label={s === "all" ? `All ${total}` : statusConfig[s]?.label || s}
            active={statusFilter === s}
            color={s === "all" ? T.primary : statusConfig[s]?.color || "#999"}
            onClick={() => onStatusFilter(s)}
          />
        ))}
      </div>

      {/* Table */}
      <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(245,245,244,0.8)" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "90px 1.2fr 130px 100px 1fr 36px", padding: "12px 20px", background: "rgba(250,250,249,0.8)" }}>
          {["Date", "Company", "Role", "Status", "Action Item", ""].map((h) => (
            <span key={h} style={{ fontSize: 11, color: "#a8a29e", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {data.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#d6d3d1", background: "rgba(255,255,255,0.6)" }}>
            No results
          </div>
        ) : (
          data.map((row) => {
            const cfg = statusConfig[row.status] || { label: row.status || "—", color: "#9ca3af", bg: "#f9fafb", border: "#e5e7eb" };
            return (
              <ERow
                key={row.id}
                row={row}
                cfg={cfg}
                isOpen={!!openRows[row.id]}
                toggle={() => setOpenRows((p) => ({ ...p, [row.id]: !p[row.id] }))}
              />
            );
          })
        )}
      </div>
    </GC>
  );
}