const BASE = "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

// Dashboard data
export const getStats = () => request("/api/stats");
export const getApplications = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request(`/api/applications${q ? `?${q}` : ""}`);
};
export const getFunnel = () => request("/api/funnel");
export const getWeekly = () => request("/api/weekly");
export const getActions = () => request("/api/actions");
export const getFilters = () => request("/api/filters");

// AI Insight - chat with Ollama via backend
export const chatAI = (message) =>
  request("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });