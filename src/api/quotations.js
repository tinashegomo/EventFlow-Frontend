import { api } from './client';

export const getQuotations = (orgId) =>
  api.get(`/organizations/${orgId}/quotations`);

export const getQuotation = (orgId, id) =>
  api.get(`/organizations/${orgId}/quotations/${id}`);

export const createQuotation = (orgId, data) =>
  api.post(`/organizations/${orgId}/quotations`, data);

export const updateQuotation = (orgId, id, data) =>
  api.put(`/organizations/${orgId}/quotations/${id}`, data);

export const deleteQuotation = (orgId, id) =>
  api.delete(`/organizations/${orgId}/quotations/${id}`);
