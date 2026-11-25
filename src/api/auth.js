import { api, setToken, clearToken, setStoredOrgId } from './client';

export async function login(email, password) {
  const data = await api.post('/auth/login', { email, password });
  setToken(data.token);
  setStoredOrgId(data.organizationId);
  return data;
}

export async function register(email, password, fullName, orgName) {
  const data = await api.post('/auth/register', { email, password, fullName, orgName });
  setToken(data.token);
  setStoredOrgId(data.organizationId);
  return data;
}

export async function getMe() {
  return api.get('/auth/me');
}

export async function getOrganization(orgId) {
  return api.get(`/organizations/${orgId}`);
}

export function logout() {
  clearToken();
}
