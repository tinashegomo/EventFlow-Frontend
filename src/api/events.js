import { api } from './client';

export const getEvents = (orgId) => api.get(`/organizations/${orgId}/events`);

export const getEvent = (orgId, id) =>
  api.get(`/organizations/${orgId}/events/${id}`);

export const createEvent = (orgId, data) =>
  api.post(`/organizations/${orgId}/events`, data);

export const updateEvent = (orgId, id, data) =>
  api.put(`/organizations/${orgId}/events/${id}`, data);

export const deleteEvent = (orgId, id) =>
  api.delete(`/organizations/${orgId}/events/${id}`);

export const recordPayment = (orgId, eventId, data) =>
  api.post(`/organizations/${orgId}/events/${eventId}/payments`, data);

export const removePayment = (orgId, eventId, paymentId) =>
  api.delete(`/organizations/${orgId}/events/${eventId}/payments/${paymentId}`);
