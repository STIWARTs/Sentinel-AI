const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8888';
const AUTH_DISABLED = import.meta.env.VITE_DISABLE_AUTH === 'true';

// Retrieve JWT token from localStorage
const getToken = () => localStorage.getItem('sentinel_token');

const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function requestError(response, method, path) {
  let detail = '';
  try {
    const body = await response.json();
    detail = body?.detail ? `: ${body.detail}` : '';
  } catch {
    // Keep the status-only error when the server did not return JSON.
  }
  return new Error(`${method} ${path} failed (${response.status})${detail}`);
}

export async function apiGet(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...authHeaders(),
    },
  });
  if (!response.ok) {
    throw await requestError(response, 'GET', path);
  }
  return response.json();
}

export async function apiPost(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await requestError(response, 'POST', path);
  }
  return response.json();
}

export async function apiPatch(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await requestError(response, 'PATCH', path);
  }
  return response.json();
}

// WebSocket URL (switch http(s) to ws(s))
export const WS_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8888').replace(/^http/, 'ws');

export function getWebSocketUrl(path) {
  const token = getToken();
  if (!AUTH_DISABLED && !token) return null;
  if (AUTH_DISABLED) return `${WS_URL}${path}`;
  const separator = path.includes('?') ? '&' : '?';
  return `${WS_URL}${path}${separator}token=${encodeURIComponent(token ?? '')}`;
}
