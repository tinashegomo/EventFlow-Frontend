// Override with VITE_API_BASE_URL in a .env file; defaults to the local backend.
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/eventflow';

const TOKEN_KEY = 'ef_jwt_token';
const ORG_KEY = 'ef_org_id';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ORG_KEY);
}

export function getStoredOrgId() {
  return localStorage.getItem(ORG_KEY);
}

export function setStoredOrgId(id) {
  localStorage.setItem(ORG_KEY, id);
}

async function request(method, path, body) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body !== undefined) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, options);

  // 401 means the JWT is missing, expired or invalid: drop the session and send the
  // user to the login page. 403 is an authorisation failure and must NOT clear the
  // session — the caller shows an access-denied state instead.
  if (res.status === 401) {
    clearToken();
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const errBody = await res.text();
    let msg;
    try {
      const parsed = JSON.parse(errBody);
      msg = parsed.errorMessage || parsed.message || errBody;
    } catch {
      msg = errBody || `Request failed (${res.status})`;
    }
    throw new Error(msg);
  }

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return res.json();
  }
  return res;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
};
