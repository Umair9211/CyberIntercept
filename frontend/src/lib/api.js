// lib/api.js
// Central API client — all backend calls live here.
// Base URL reads from an env var so you can override it per environment.

export const BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8000";

async function request(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Proxy lifecycle ──────────────────────────────────────────────────────────

/** Start mitmproxy on the given port. */
export const startProxy = (port = 8080) =>
  request("GET", `/proxy/start?port=${port}`);

/** Stop mitmproxy. Pass the port it was started on. */
export const stopProxy = (port = 8080) =>
  request("GET", `/proxy/stop?port=${port}`);

/** Current capture / intercept state (shared across all dashboard tabs). */
export const getProxyStatus = (port = 8080) =>
  request("GET", `/proxy/status?port=${port}`);

// ── Intercept mode ───────────────────────────────────────────────────────────

/** Enable intercept mode — incoming requests will be paused. */
export const enableIntercept = () =>
  request("POST", "/proxy/intercept/on");

/**
 * Disable intercept mode.
 * The backend auto-forwards every pending request when this is called.
 */
export const disableIntercept = () =>
  request("POST", "/proxy/intercept/off");

// ── Pending (intercepted) requests ──────────────────────────────────────────

/**
 * Returns requests currently paused by the intercept engine.
 * Shape: [{ id, method, url, host, status }]
 */
export const getPendingRequests = () =>
  request("GET", "/proxy/intercept/pending");

/** Forward a single pending request, or pass "all" to forward every one. */
export const forwardRequest = (id) =>
  request("POST", `/proxy/intercept/forward/${id}`);

/** Drop a single pending request, or pass "all" to drop every one. */
export const dropRequest = (id) =>
  request("POST", `/proxy/intercept/drop/${id}`);

// ── Captured traffic log ─────────────────────────────────────────────────────

/**
 * Returns all traffic that has already passed through (not pending).
 * Shape: [{ method, url, host, headers, body }]
 * NOTE: The backend doesn't return HTTP response data (status, body, headers)
 * because mitmproxy only captures the request side in the current
 * implementation. Fields missing from the backend are filled with defaults
 * by normalizeTrafficItem() below.
 */
export const getCapturedTraffic = () =>
  request("GET", "/api/requests");

/** Clear captured log and pending intercept queue on the backend. */
export const clearTraffic = () => request("DELETE", "/api/requests");

// ── Repeater ─────────────────────────────────────────────────────────────────

/**
 * Send an arbitrary HTTP request via the repeater.
 * @param {{ method: string, url: string, headers?: object, body?: string }} data
 */
export const sendRepeaterRequest = (data) =>
  request("POST", "/api/repeater/send", data);

// ── Data normalisation ────────────────────────────────────────────────────────

let _counter = 0;

/**
 * Normalise a raw backend item into the shape the frontend components expect.
 *
 * Backend (captured)  → { method, url, host, headers, body }
 * Backend (pending)   → { id, method, url, host, status:"pending" }
 * Frontend expects    → { id, method, url, host, headers, body,
 *                         status (HTTP int), time, protocol,
 *                         response: { status, headers, body } }
 */
export function normalizeTrafficItem(raw, source = "captured") {
  _counter += 1;
  return {
    // identity
    id: raw.id ?? `req-${_counter}-${Date.now()}`,
    // request fields
    method:   raw.method  ?? "GET",
    url:      raw.url     ?? "",
    host:     raw.host    ?? "",
    headers:  raw.headers ?? {},
    body:     raw.body    ?? "",
    protocol: "HTTP/1.1",
    // HTTP response — backend doesn't capture this yet; placeholders used
    status:   typeof raw.status === "number" ? raw.status : 0,
    time:     new Date().toLocaleTimeString(),
    response: {
      status:  "—",
      headers: { "content-type": "—", "cache-control": "—" },
      body:    source === "pending"
        ? "(Request is pending — response not yet available)"
        : "(Response data not captured by proxy)",
    },
    // track where it came from so the UI can colour-code if needed
    _source: source,
  };
}