/**
 * Safe fetch + JSON parse. Avoids "Unexpected non-whitespace character after JSON"
 * when the server returns HTML (e.g. 404/502) or other non-JSON.
 */
export async function apiJson(url, options = {}) {
  const r = await fetch(url, options);
  const text = await r.text();
  let data = null;
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.warn('Response was not JSON:', text.slice(0, 100));
      return { ok: r.ok, data: null, error: 'Invalid response from server' };
    }
  }
  return { ok: r.ok, data, error: null };
}
