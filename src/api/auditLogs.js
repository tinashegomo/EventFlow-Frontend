import { api } from './client';

export const getAuditLogs = (orgId, params = {}) => {
  const query = new URLSearchParams();
  if (params.userId) query.set('userId', params.userId);
  if (params.entityType) query.set('entityType', params.entityType);
  if (params.entityId) query.set('entityId', params.entityId);
  if (params.action) query.set('action', params.action);
  if (params.page != null) query.set('page', params.page);
  if (params.size != null) query.set('size', params.size);
  const qs = query.toString();
  return api.get(`/organizations/${orgId}/audit-logs${qs ? '?' + qs : ''}`);
};
