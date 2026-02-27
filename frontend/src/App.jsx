import { useState, useEffect, useMemo, useCallback } from "react";
import { getApplications, syncEmails, toggleActionDone } from "./api/client";
import { T, GC } from "./components/ui";
import StatsCards from "./components/StatsCards";
import SankeyFunnel from "./components/SankeyFunnel";
import Trend from "./components/Trend";
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

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [syncAfter, setSyncAfter] = useState("");
  const [syncBefore, setSyncBefore] = useState("");
  const [syncMax, setSyncMax] = useState(100);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await getApplications();
      const apps = raw.map((r) => ({
        ...r,
        date: r.first_seen?.slice(0, 10) || "",
        status: r.current_status || "applied",
        action: r.action_item || null,
        action_done: r.action_done || 0,
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

  // Auto-refresh: re-fetch data every 60 seconds to pick up auto-sync results
  useEffect(() => {
    const interval = setInterval(fetchData, 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const params = { maxResults: syncMax };
      if (syncAfter) params.after = syncAfter;
      if (syncBefore) params.before = syncBefore;
      const result = await syncEmails(params);
      setSyncResult(result);
      setShowSyncPanel(false);
      // Refresh dashboard data after sync
      await fetchData();
    } catch (err) {
      console.error("Sync error:", err);
      setError(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Auto-hide sync result after 8 seconds
  useEffect(() => {
    if (!syncResult) return;
    const t = setTimeout(() => setSyncResult(null), 8000);
    return () => clearTimeout(t);
  }, [syncResult]);

  const handleToggleAction = async (appId) => {
    try {
      await toggleActionDone(appId);
      await fetchData();
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

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
          <div style={{ display: "flex", gap: 10, alignItems: "center", position: "relative" }}>
            {lastSync && <span style={{ fontSize: 12, color: "#a8a29e" }}>Synced {lastSync}</span>}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowSyncPanel(!showSyncPanel)}
                disabled={syncing}
                style={{
                  background: syncing ? "#d6d3d1" : T.grad,
                  color: "#fff", border: "none", borderRadius: 12, padding: "10px 20px",
                  fontSize: 13, cursor: syncing ? "not-allowed" : "pointer", fontWeight: 600,
                  boxShadow: syncing ? "none" : "0 4px 16px rgba(217,119,6,0.3)",
                  transition: "all 0.15s", display: "flex", alignItems: "center", gap: 8,
                }}
                onMouseOver={(e) => !syncing && (e.currentTarget.style.transform = "scale(1.03)")}
                onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                {syncing && (
                  <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}>
                    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                  </svg>
                )}
                {syncing ? "Syncing..." : "Sync Now"}
              </button>

              {/* Sync Settings Panel */}
              {showSyncPanel && !syncing && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 100,
                  background: "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)",
                  borderRadius: 16, padding: 20, minWidth: 300,
                  border: "1.5px solid rgba(214,211,209,0.5)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1c1917", marginBottom: 14 }}>
                    Sync Settings
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <label style={{ fontSize: 12, color: "#78716c", fontWeight: 600 }}>
                      After
                      <input
                        type="date" value={syncAfter}
                        onChange={(e) => setSyncAfter(e.target.value)}
                        style={{ ...inp, width: "100%", marginTop: 4, display: "block" }}
                      />
                    </label>

                    <label style={{ fontSize: 12, color: "#78716c", fontWeight: 600 }}>
                      Before
                      <input
                        type="date" value={syncBefore}
                        onChange={(e) => setSyncBefore(e.target.value)}
                        style={{ ...inp, width: "100%", marginTop: 4, display: "block" }}
                      />
                    </label>

                    <label style={{ fontSize: 12, color: "#78716c", fontWeight: 600 }}>
                      Max Emails
                      <input
                        type="number" value={syncMax} min={1} max={500}
                        onChange={(e) => setSyncMax(Number(e.target.value))}
                        style={{ ...inp, width: "100%", marginTop: 4, display: "block" }}
                      />
                    </label>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button
                      onClick={handleSync}
                      style={{
                        flex: 1, background: T.grad, color: "#fff", border: "none",
                        borderRadius: 10, padding: "10px 0", fontSize: 13,
                        fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      Start Sync
                    </button>
                    <button
                      onClick={() => setShowSyncPanel(false)}
                      style={{
                        background: "rgba(214,211,209,0.4)", color: "#78716c",
                        border: "none", borderRadius: 10, padding: "10px 16px",
                        fontSize: 13, cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sync Result Banner */}
        {syncResult && (
          <GC style={{ padding: "12px 20px", marginBottom: 16, border: "1.5px solid rgba(217,119,6,0.3)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "#44403c" }}>
              <span style={{ fontWeight: 700, color: T.primary }}>Sync complete</span>
              {" — "}
              {syncResult.new_emails} new fetched, {syncResult.analyzed} analyzed, {syncResult.skipped} skipped
            </span>
            <button
              onClick={() => setSyncResult(null)}
              style={{ background: "none", border: "none", color: "#a8a29e", cursor: "pointer", fontSize: 16, padding: "0 4px" }}
            >
              ×
            </button>
          </GC>
        )}

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
        <Trend data={filtered} />

        {/* Action Items + By Role */}
        <div className="two-col-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22 }}>
          <ActionItems data={filtered} onToggle={handleToggleAction} />
          <ByRole data={filtered} />
        </div>

        {/* Application Table */}
        <ApplicationTable
          data={filtered}
          total={applications.length}
          statusFilter={statusFilter}
          onStatusFilter={setSf}
          onToggle={handleToggleAction}
        />
      </div>

      {/* Spinner animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}