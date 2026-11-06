const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const KEYS = { access: "lib_access", refresh: "lib_refresh", user: "lib_user" };

export class ApiError extends Error {
  constructor(status, data) {
    super("API error");
    this.status = status;
    this.data = data;
  }
}

export function saveSession({ access, refresh, user }) {
  localStorage.setItem(KEYS.access, access);
  localStorage.setItem(KEYS.refresh, refresh);
  localStorage.setItem(KEYS.user, JSON.stringify(user));
}

export function loadUser() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.user));
  } catch {
    return null;
  }
}

export function clearSession() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}

async function refreshAccess() {
  const refresh = localStorage.getItem(KEYS.refresh);
  if (!refresh) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem(KEYS.access, data.access);
    if (data.refresh) localStorage.setItem(KEYS.refresh, data.refresh);
    return true;
  } catch {
    return false;
  }
}

export async function api(path, { method = "GET", body, auth = true } = {}, canRetry = true) {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem(KEYS.access);
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth) {
    if (canRetry && (await refreshAccess())) {
      return api(path, { method, body, auth }, false);
    }
    clearSession();
    window.dispatchEvent(new Event("lib:logout"));
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

// Turns whatever the server (or the network) returned into one readable sentence.
export function errorMessage(err) {
  if (!(err instanceof ApiError)) {
    return "Can't reach the server. Check that the backend is running.";
  }
  const d = err.data;
  if (!d) return "Something went wrong. Try again.";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.join(" ");
  if (d.detail) return d.detail;
  return Object.entries(d)
    .map(([field, msgs]) => (Array.isArray(msgs) ? msgs.join(" ") : String(msgs)))
    .join(" ");
}
