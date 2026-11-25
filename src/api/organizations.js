import { api } from './client';

export const getOrganization = (orgId) => api.get(`/organizations/${orgId}`);

export const updateOrganization = (orgId, data) => api.put(`/organizations/${orgId}`, data);
