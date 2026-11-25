import { api } from './client';

export const getInventory = (orgId) => api.get(`/organizations/${orgId}/inventory`);

export const getInventoryItem = (orgId, id) =>
  api.get(`/organizations/${orgId}/inventory/${id}`);

export const createInventoryItem = (orgId, data) =>
  api.post(`/organizations/${orgId}/inventory`, data);

export const updateInventoryItem = (orgId, id, data) =>
  api.put(`/organizations/${orgId}/inventory/${id}`, data);

export const deleteInventoryItem = (orgId, id) =>
  api.delete(`/organizations/${orgId}/inventory/${id}`);
