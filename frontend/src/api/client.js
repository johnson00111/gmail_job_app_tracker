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

// Sync — fetch Gmail + analyze
export const syncEmails = ({ after, before, maxResults } = {}) => {
  const body = {};
  if (after) body.after = after;
  if (before) body.before = before;
  if (maxResults) body.max_results = maxResults;

  return request("/api/sync", {
    method: "POST",
    body: JSON.stringify(body),
  });
};

// Application emails (for expanded row detail)
export const getApplicationEmails = (appId) => request(`/api/applications/${appId}/emails`);

// Toggle action done
export const toggleActionDone = (appId) =>
  request(`/api/applications/${appId}/action-done`, { method: "PATCH" });

// Update application status
export const updateApplicationStatus = (appId, status) =>
  request(`/api/applications/${appId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

// AI Chat — blocking (fallback)
export const chatAI = (message) =>
  request("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });

/**
 * AI Chat — streaming via SSE.
 * Calls onToken(text, provider) for each chunk, onDone() when complete.
 * Returns an abort controller so the caller can cancel the stream.
 */
export function chatAIStream(message, { onToken, onDone, onError }) {
  const controller = new AbortController();

  fetch(`${BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) {
              onError?.(new Error(data.error));
              return;
            }
            if (data.done) {
              onDone?.();
              return;
            }
            if (data.token) {
              onToken?.(data.token, data.provider);
            }
          } catch {
            // skip malformed JSON lines
          }
        }
      }
      // Stream ended without explicit done event
      onDone?.();
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        onError?.(err);
      }
    });

  return controller;
}