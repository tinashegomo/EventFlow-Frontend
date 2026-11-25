import { api } from './client';

export const getUsers = (orgId) => api.get(`/organizations/${orgId}/users`);

export const getUser = (orgId, userId) => api.get(`/organizations/${orgId}/users/${userId}`);

export const updateUserRole = (orgId, userId, role) =>
  api.put(`/organizations/${orgId}/users/${userId}/role`, { role });

export const updateMyFcmToken = (fcmToken) =>
  api.put('/users/me/fcm-token', { fcmToken });
