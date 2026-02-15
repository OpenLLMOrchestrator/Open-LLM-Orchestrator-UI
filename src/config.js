/**
 * API base URL. The backend runs on port 8002 by default (see .env or PORT).
 *
 * - In development: defaults to http://localhost:8002 so the app calls the backend
 *   directly (no proxy). Run start.bat or "npm run dev" so the backend is up.
 *
 * - Override with VITE_API_URL in .env if your backend uses another URL/port.
 *
 * - In production: uses relative /api (same origin; backend serves the app).
 */
const envUrl = import.meta.env.VITE_API_URL;
const defaultDev = import.meta.env.DEV ? 'http://localhost:8002' : '';
const base = (envUrl != null && envUrl !== '') ? envUrl : defaultDev;
export const API_BASE = base.endsWith('/') ? base.slice(0, -1) : base;
export const API = API_BASE ? `${API_BASE}/api` : '/api';
