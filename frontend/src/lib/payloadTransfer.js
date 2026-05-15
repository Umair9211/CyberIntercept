const KEY_PREFIX = "ci-payload:";

/** Store request text for the payload page (avoids huge ?data= URLs → 431). */
export function stashPayloadRequest(requestText) {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    sessionStorage.setItem(`${KEY_PREFIX}${id}`, requestText);
    return id;
  } catch {
    return null;
  }
}

/** Read and remove stashed request text (one-time handoff). */
export function consumePayloadRequest(id) {
  if (!id) return null;
  const key = `${KEY_PREFIX}${id}`;
  try {
    const text = sessionStorage.getItem(key);
    if (text != null) sessionStorage.removeItem(key);
    return text;
  } catch {
    return null;
  }
}

/** Legacy URL param decode — only for small payloads; large URLs trigger 431. */
export function decodePayloadFromQueryParam(encoded) {
  if (!encoded) return null;
  try {
    const request = JSON.parse(decodeURIComponent(atob(encoded)));
    return request;
  } catch {
    return null;
  }
}
