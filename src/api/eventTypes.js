import { api } from './client';

export const getEventTypes = (orgId) => api.get(`/organizations/${orgId}/event-types`);

export const getEventType = (orgId, id) => api.get(`/organizations/${orgId}/event-types/${id}`);

export const createEventType = (orgId, data) =>
  api.post(`/organizations/${orgId}/event-types`, data);

export const updateEventType = (orgId, id, data) =>
  api.put(`/organizations/${orgId}/event-types/${id}`, data);

export const deleteEventType = (orgId, id) =>
  api.delete(`/organizations/${orgId}/event-types/${id}`);
