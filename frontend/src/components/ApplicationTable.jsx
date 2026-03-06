import { useState, useEffect, useMemo } from "react";
import { GC, T, statusConfig, STATUS_ORDER } from "./ui";
import { getApplicationEmails } from "../api/client";

/* ===== Sort Config ===== */
const statusRank = (s) => {
  const i = STATUS_ORDER.indexOf(s);
  return i === -1 ? 999 : i;
};

const SORT_COLS = {
  date:    { label: "Date",        w: "90px",  fn: (a, b) => (a.date ?? "").localeCompare(b.date ?? "") },
  company: { label: "Company",     w: "1.2fr", fn: (a, b) => (a.company ?? "").localeCompare(b.company ?? "") },
  role:    { label: "Role",        w: "130px", fn: (a, b) => (a.role ?? "").localeCompare(b.role ?? "") },
  status:  { label: "Status",      w: "100px", fn: (a, b) => statusRank(a.status) - statusRank(b.status) },
  action:  { label: "Action Item", w: "1fr",   fn: (a, b) => {
    // 未完成(0) → 無action(1) → 已完成(2)
    const rank = (r) => r.action && r.action.trim() ? (r.action_done ? 2 : 0) : 1;
    return rank(a) - rank(b);
  }},
};

const GRID_COLS = "90px 1.2fr 130px 100px 1fr 36px";

const SortArrow = ({ active, dir }) => (
  <span style={{ marginLeft: 4, fontSize: 10, opacity: active ? 1 : 0.35 }}>
    {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
  </span>
);

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
function ERow({ row, cfg, isOpen, toggle, onToggle, onStatusUpdate }) {
  const [h, setH] = useState(false);
  const [emails, setEmails] = useState(null);
  const [loadingEmails, setLoadingEmails] = useState(false);

  const [showStatusMenu, setShowStatusMenu] = useState(false);

  useEffect(() => {
    if (isOpen && emails === null && !loadingEmails) {
      setLoadingEmails(true);
      getApplicationEmails(row.id)
        .then((data) => setEmails(data))
        .catch(() => setEmails([]))
        .finally(() => setLoadingEmails(false));
    }
  }, [isOpen, emails, loadingEmails, row.id]);

  const hasEmails = emails && emails.length > 0;

  return (
    <div style={{ borderBottom: "1px solid rgba(245,245,244,0.8)" }}>
      <div
        onClick={toggle}
        onMouseEnter={() => setH(true)}
        onMouseLeave={() => setH(false)}
        style={{
          display: "grid", gridTemplateColumns: GRID_COLS, alignItems: "center",
          padding: "14px 20px", cursor: "pointer",
          background: isOpen || h ? "rgba(255,251,245,0.9)" : "rgba(255,255,255,0.6)",
          transition: "background 0.15s",
        }}
      >
        <span style={{ fontSize: 12, color: "#a8a29e" }}>{row.date?.slice(0, 10)}</span>
        <span style={{ color: "#1c1917", fontWeight: 700, fontSize: 14 }}>{row.company}</span>
        <span style={{ color: "#78716c", fontSize: 13 }}>{row.role || "—"}</span>
        <span style={{ position: "relative" }}>
          <span
            onClick={(e) => { e.stopPropagation(); setShowStatusMenu((v) => !v); }}
            style={{
              background: cfg.bg, color: cfg.color,
              padding: "3px 12px", borderRadius: 99, fontSize: 11, fontWeight: 600,
              border: `1px solid ${cfg.border}`,
              cursor: "pointer", userSelect: "none",
              transition: "all 0.15s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)"; }}
            onMouseOut={(e) => { e.currentTarget.style.boxShadow = "none"; }}
          >
            {cfg.label} ▾
          </span>
          {showStatusMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
                background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)",
                borderRadius: 12, padding: 6, minWidth: 150,
                border: "1.5px solid rgba(214,211,209,0.5)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
              }}
            >
              {STATUS_ORDER.map((s) => {
                const sc = statusConfig[s];
                if (!sc) return null;
                const isActive = row.status === s;
                return (
                  <div
                    key={s}
                    onClick={() => {
                      if (!isActive && onStatusUpdate) onStatusUpdate(row.id, s);
                      setShowStatusMenu(false);
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 12px", borderRadius: 8, cursor: isActive ? "default" : "pointer",
                      background: isActive ? "rgba(245,245,244,0.8)" : "transparent",
                      transition: "background 0.15s",
                    }}
                    onMouseOver={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(245,245,244,0.6)"; }}
                    onMouseOut={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: 99,
                      background: sc.color, flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: 12, fontWeight: isActive ? 700 : 500,
                      color: isActive ? sc.color : "#44403c",
                    }}>
                      {sc.label}
                    </span>
                    {isActive && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={sc.color} strokeWidth="3" strokeLinecap="round" style={{ marginLeft: "auto" }}>
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {row.action && onToggle && (
            <div
              onClick={(e) => { e.stopPropagation(); onToggle(row.id); }}
              style={{
                width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: "pointer",
                border: row.action_done ? "none" : "2px solid rgba(214,211,209,0.8)",
                background: row.action_done
                  ? "linear-gradient(135deg, #22c55e, #16a34a)"
                  : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
              }}
            >
              {row.action_done ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              ) : null}
            </div>
          )}
          <span style={{
            color: row.action
              ? (row.action_done ? "#22c55e" : "#dc2626")
              : "#d6d3d1",
            fontWeight: row.action ? 600 : 400,
            fontSize: 12,
            textDecoration: row.action_done ? "line-through" : "none",
          }}>
            {row.action || "—"}
          </span>
        </span>
        <span style={{ color: "#d6d3d1", fontSize: 16, transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.3s", textAlign: "center" }}>
          ▾
        </span>
      </div>

      {/* Expanded detail */}
      <div style={{
        maxHeight: isOpen ? 300 : 0, overflow: "hidden",
        opacity: isOpen ? 1 : 0,
        transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.3s, padding 0.3s",
        padding: isOpen ? "0 20px 16px" : "0 20px",
        background: "rgba(255,251,245,0.9)",
      }}>
        <div style={{ background: "rgba(245,245,244,0.7)", borderRadius: 12, padding: "14px 18px", fontSize: 13, color: "#57534e", lineHeight: 1.7 }}>
          <div style={{ marginBottom: hasEmails ? 12 : 0 }}>
            {row.summary || "No additional details."}
          </div>
          {loadingEmails && (
            <div style={{ fontSize: 12, color: "#a8a29e" }}>Loading emails...</div>
          )}
          {hasEmails && (
            <div style={{ borderTop: "1px solid rgba(214,211,209,0.4)", paddingTop: 10 }}>
              <div style={{ fontSize: 11, color: "#a8a29e", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
                Related Emails ({emails.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {emails.map((e, i) => (
                  <div key={e.gmail_id || i} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12 }}>
                    <span style={{ color: "#a8a29e", flexShrink: 0 }}>{e.date?.slice(0, 10)}</span>
                    <span style={{ color: "#44403c" }}>{e.subject || "(no subject)"}</span>
                    {e.email_type && (
                      <span style={{ fontSize: 10, color: "#a8a29e", background: "rgba(245,245,244,0.9)", padding: "1px 6px", borderRadius: 4, flexShrink: 0 }}>
                        {e.email_type}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== Main Table ===== */
export default function ApplicationTable({ data, total, statusFilter, onStatusFilter, onToggle, onStatusUpdate }) {
  const [openRows, setOpenRows] = useState({});
  const [sortCol, setSortCol] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  /* sort toggle */
  const handleSort = (col) => {
    if (col === sortCol) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  /* filter + sort */
  const rows = useMemo(() => {
    let list = data;

    /* text search */
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) => (r.company ?? "").toLowerCase().includes(q) || (r.role ?? "").toLowerCase().includes(q)
      );
    }

    /* action item filter */
    if (actionFilter === "has") {
      list = list.filter((r) => r.action && r.action.trim());
    } else if (actionFilter === "none") {
      list = list.filter((r) => !r.action || !r.action.trim());
    } else if (actionFilter === "pending") {
      list = list.filter((r) => r.action && r.action.trim() && !r.action_done);
    }

    /* sort */
    const cmp = SORT_COLS[sortCol]?.fn ?? SORT_COLS.date.fn;
    const sorted = [...list].sort(cmp);
    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [data, query, actionFilter, sortCol, sortDir]);

  return (
    <GC style={{ padding: "28px 28px 20px" }}>
      {/* Title */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: T.primary, textTransform: "uppercase", letterSpacing: 3, fontWeight: 700 }}>Details</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1c1917", marginTop: 4 }}>
          All Applications{(query || actionFilter !== "all") && ` — ${rows.length} match${rows.length !== 1 ? "es" : ""}`}
        </div>
      </div>

      {/* Status filter pills + Action filter + Search */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {["all", ...STATUS_ORDER].map((s) => (
          <FBtn
            key={s}
            label={s === "all" ? `All ${total}` : statusConfig[s]?.label || s}
            active={statusFilter === s}
            color={s === "all" ? T.primary : statusConfig[s]?.color || "#999"}
            onClick={() => onStatusFilter(s)}
          />
        ))}

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: "rgba(214,211,209,0.5)", margin: "0 4px" }} />

        {/* Action item filter pills */}
        <FBtn
          label="Has Action"
          active={actionFilter === "has"}
          color="#dc2626"
          onClick={() => setActionFilter((f) => f === "has" ? "all" : "has")}
        />
        <FBtn
          label="Pending"
          active={actionFilter === "pending"}
          color="#f59e0b"
          onClick={() => setActionFilter((f) => f === "pending" ? "all" : "pending")}
        />
        <FBtn
          label="No Action"
          active={actionFilter === "none"}
          color="#a8a29e"
          onClick={() => setActionFilter((f) => f === "none" ? "all" : "none")}
        />

        <div style={{ flex: 1 }} />
        <input
          type="text"
          placeholder="Search company / role…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            padding: "7px 14px", borderRadius: 99, fontSize: 12, width: 260,
            border: `2px solid ${T.primary}`,
            background: "rgba(255,255,255,0.7)",
            outline: "none", transition: "box-shadow 0.2s",
            color: "#1c1917",
          }}
          onFocus={(e) => { e.target.style.boxShadow = `0 0 0 3px ${T.primary}22`; }}
          onBlur={(e) => { e.target.style.boxShadow = "none"; }}
        />
      </div>

      {/* Table */}
      <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(245,245,244,0.8)" }}>
        {/* Sortable Header */}
        <div style={{ display: "grid", gridTemplateColumns: GRID_COLS, padding: "12px 20px", background: "rgba(250,250,249,0.8)" }}>
          {Object.entries(SORT_COLS).filter(([key]) => key !== "action").map(([key, { label }]) => (
            <span
              key={key}
              onClick={() => handleSort(key)}
              style={{
                fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8,
                cursor: "pointer", userSelect: "none",
                color: sortCol === key ? T.primary : "#a8a29e",
                transition: "color 0.15s",
              }}
            >
              {label}<SortArrow active={sortCol === key} dir={sortDir} />
            </span>
          ))}
          {/* Action Item — now sortable */}
          <span
            onClick={() => handleSort("action")}
            style={{
              fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8,
              cursor: "pointer", userSelect: "none",
              color: sortCol === "action" ? T.primary : "#a8a29e",
              transition: "color 0.15s",
            }}
          >
            Action Item<SortArrow active={sortCol === "action"} dir={sortDir} />
          </span>
          <span />
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#d6d3d1", background: "rgba(255,255,255,0.6)" }}>
            {query || actionFilter !== "all" ? "No matching applications" : "No results"}
          </div>
        ) : (
          rows.map((row) => {
            const cfg = statusConfig[row.status] || { label: row.status || "—", color: "#9ca3af", bg: "#f9fafb", border: "#e5e7eb" };
            return (
              <ERow
                key={row.id}
                row={row}
                cfg={cfg}
                isOpen={!!openRows[row.id]}
                toggle={() => setOpenRows((p) => ({ ...p, [row.id]: !p[row.id] }))}
                onToggle={onToggle}
                onStatusUpdate={onStatusUpdate}
              />
            );
          })
        )}
      </div>
    </GC>
  );
}
