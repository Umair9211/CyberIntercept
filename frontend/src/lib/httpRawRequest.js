/**
 * Build raw HTTP text for editors (Request inspector / Payload).
 * @param {object} request — shape from normalizeTrafficItem / decoded query
 */
export function buildRequestText(request) {
  return (
    `${request.method} ${request.url} ${request.protocol ?? "HTTP/1.1"}\n` +
    `Host: ${request.headers?.Host ?? request.headers?.host ?? ""}\n` +
    Object.entries(request.headers ?? {})
      .filter(([key]) => key.toLowerCase() !== "host")
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n") +
    "\n\n" +
    (request.body || "")
  );
}

/**
 * Parse raw HTTP message into repeater payload.
 * Expects: `METHOD URL [HTTP/x.x]` then headers, blank line, optional body.
 */
export function parseRawHttpMessage(raw) {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const first = (lines[0] || "").trim();
  if (!first) {
    throw new Error("Request line is empty.");
  }

  const parts = first.split(/\s+/);
  const method = parts[0];
  if (!method) {
    throw new Error("Missing HTTP method.");
  }

  let url = "";
  if (parts.length >= 3 && /^HTTP\/\d/i.test(parts[parts.length - 1])) {
    url = parts.slice(1, -1).join(" ");
  } else {
    url = parts.slice(1).join(" ");
  }
  if (!url) {
    throw new Error("Missing URL.");
  }

  const headers = {};
  let lineIdx = 1;
  for (; lineIdx < lines.length; lineIdx += 1) {
    const line = lines[lineIdx];
    if (line.trim() === "") break;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const name = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (name) headers[name] = value;
  }

  while (lineIdx < lines.length && lines[lineIdx].trim() === "") {
    lineIdx += 1;
  }
  const body = lines.slice(lineIdx).join("\n");
  const bodyOut = body.length ? body : undefined;

  let finalUrl = url;
  if (!/^https?:\/\//i.test(finalUrl)) {
    const hostEntry = Object.entries(headers).find(([k]) => k.toLowerCase() === "host");
    const host = hostEntry?.[1];
    if (!host) {
      throw new Error("Relative URL requires a Host header.");
    }
    const path = finalUrl.startsWith("/") ? finalUrl : `/${finalUrl}`;
    finalUrl = `http://${host}${path}`;
  }

  return { method, url: finalUrl, headers, body: bodyOut };
}
