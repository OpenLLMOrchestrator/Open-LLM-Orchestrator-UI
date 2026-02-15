/**
 * Persist UI state in localStorage (session/cookie-like). Restored on load.
 */
const KEY = 'open-llm-orchestrator-ui';

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveSession(updates) {
  try {
    const current = loadSession();
    const next = { ...current, ...updates };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('session save failed', e);
  }
}
