import { useState, useEffect, useMemo, useCallback } from "react";
import { getStats, getApplications, getFunnel, getWeekly, getActions, getFilters } from "./api/client";
import { T, GC } from "./components/ui";
import StatsCards from "./components/StatsCards";
import SankeyFunnel from "./components/SankeyFunnel";
import WeeklyTrend from "./components/WeeklyTrend";
import ActionItems from "./components/ActionItems";
import { ByRole } from "./components/ActionItems";
import ApplicationTable from "./components/ApplicationTable";
import AiInsight from "./components/AiInsight";
import "./styles/theme.css";

export default function App() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  // Filters
  const [statusFilter, setSf] = useState("all");
  const [roleFilter, setRf] = useState("all");
  const [search, setSearch] = useState("");
  const [dateQuery, setDq] = useState("");
  const [dateFrom, setDf] = useState("");
  const [dateTo, setDt] = useState("");

  // Data
  const [applications, setApplications] = useState([]);
  const [allRoles, setAllRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await getApplications();
      // Normalize API field names to match frontend expectations
      const apps = raw.map((r) => ({
        ...r,
        date: r.first_seen?.slice(0, 10) || "",
        status: r.current_status || "applied",
        action: r.action_item || null,
        summary: r.notes || "",
      }));
      setApplications(apps);
      const roles = [...new Set(apps.map((a) => a.role).filter(Boolean))].sort();
      setAllRoles(roles);
      setLastSync(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Client-side filtering
  const filtered = useMemo(() => {
    const now = new Date();
    return applications
      .filter((d) => statusFilter === "all" || d.status === statusFilter)
      .filter((d) => roleFilter === "all" || d.role === roleFilter)
      .filter((d) => !search || d.company?.toLowerCase().includes(search.toLowerCase()))
      .filter((d) => {
        if (!d.date) return true;
        if (dateQuery === "custom") return (!dateFrom || d.date >= dateFrom) && (!dateTo || d.date <= dateTo);
        if (dateQuery === "7d" || dateQuery === "30d") {
          const days = dateQuery === "7d" ? 7 : 30;
          const co = new Date(now);
          co.setDate(now.getDate() - days);
          return new Date(d.date) >= co;
        }
        return true;
      });
  }, [applications, statusFilter, roleFilter, search, dateQuery, dateFrom, dateTo]);

  const hasFilter = statusFilter !== "all" || roleFilter !== "all" || search || dateQuery;
  const clearFilters = () => { setSf("all"); setRf("all"); setSearch(""); setDq(""); setDf(""); setDt(""); };

  const inp = {
    background: "rgba(250,250,249,0.8)",
    border: "1.5px solid rgba(214,211,209,0.6)",
    borderRadius: 12,
    padding: "8px 14px",
    color: "#44403c",
    fontSize: 13,
    outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", width: "100%", maxWidth: 1400, margin: "0 auto", position: "relative", fontFamily: "'Inter', -apple-system, sans-serif", padding: "28px 32px", opacity: mounted ? 1 : 0, transition: "opacity 0.6s" }}>
      {/* Background */}
      <div className="app-bg">
        <div className="app-bg-orb1" />
        <div className="app-bg-orb2" />
        <div className="app-bg-orb3" />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 26, position: "relative" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1c1917", margin: 0, letterSpacing: -0.8 }}>Gmail JobTracker</h1>
            <p style={{ color: "#a8a29e", fontSize: 12, margin: 0, marginTop: 2 }}>Gmail × Ollama — Automated application insights</p>
          </div>
          <img
            src="https://i.imgur.com/3ZOTxcn.png"
            alt="Logo"
            style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", width: 150, height: 95, objectFit: "contain" }}
          />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {lastSync && <span style={{ fontSize: 12, color: "#a8a29e" }}>Synced {lastSync}</span>}
            <button
              onClick={fetchData}
              style={{ background: T.grad, color: "#fff", border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600, boxShadow: "0 4px 16px rgba(217,119,6,0.3)", transition: "transform 0.15s" }}
              onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
              onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              Sync Now
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <GC style={{ padding: "12px 20px", marginBottom: 16, border: "1.5px solid #fecaca" }}>
            <span style={{ color: "#dc2626", fontSize: 13, fontWeight: 600 }}>⚠️ {error}</span>
            <span style={{ color: "#a8a29e", fontSize: 12, marginLeft: 8 }}>— Make sure FastAPI is running on :8000</span>
          </GC>
        )}

        {/* Filters */}
        <GC style={{ padding: "12px 20px", marginBottom: 22, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input type="text" placeholder="Company..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inp, width: 140 }} />
          <select value={roleFilter} onChange={(e) => setRf(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
            <option value="all">All Roles</option>
            {allRoles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <div style={{ display: "flex", gap: 3, background: "rgba(245,245,244,0.7)", borderRadius: 10, padding: 3 }}>
            {[["", "All Time"], ["7d", "7D"], ["30d", "30D"], ["custom", "Custom"]].map(([v, l]) => (
              <button
                key={v}
                onClick={() => { setDq(v); if (v !== "custom") { setDf(""); setDt(""); } }}
                style={{
                  padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                  background: dateQuery === v ? "rgba(255,255,255,0.9)" : "transparent",
                  color: dateQuery === v ? T.primary : "#a8a29e",
                  boxShadow: dateQuery === v ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.2s",
                }}
              >
                {l}
              </button>
            ))}
          </div>
          {dateQuery === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="date" value={dateFrom} onChange={(e) => setDf(e.target.value)} style={{ ...inp, width: 136, padding: "5px 10px", fontSize: 12 }} />
              <span style={{ fontSize: 12, color: "#a8a29e" }}>—</span>
              <input type="date" value={dateTo} onChange={(e) => setDt(e.target.value)} style={{ ...inp, width: 136, padding: "5px 10px", fontSize: 12 }} />
            </div>
          )}
          {hasFilter && (
            <button onClick={clearFilters} style={{ background: "rgba(214,211,209,0.4)", color: "#78716c", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 12, cursor: "pointer" }}>
              Clear
            </button>
          )}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#a8a29e" }}>{filtered.length} of {applications.length}</span>
        </GC>

        {/* AI Insight */}
        <AiInsight data={filtered} />

        {/* Stats Cards */}
        <StatsCards data={filtered} />

        {/* Sankey Funnel */}
        <SankeyFunnel data={filtered} />

        {/* Weekly Trend */}
        <WeeklyTrend data={filtered} />

        {/* Action Items + By Role */}
        <div className="two-col-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22 }}>
          <ActionItems data={filtered} />
          <ByRole data={filtered} />
        </div>

        {/* Application Table */}
        <ApplicationTable
          data={filtered}
          total={applications.length}
          statusFilter={statusFilter}
          onStatusFilter={setSf}
        />
      </div>
    </div>
  );
}