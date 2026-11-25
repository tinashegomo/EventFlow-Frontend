import { useEffect, useState, useCallback } from 'react';
import { getAuditLogs } from '../api/auditLogs';

export const useAuditLogs = ({ orgId, userId, entityType, entityId, max = 50 } = {}) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLogs = useCallback(async () => {
    if (!orgId && !userId) {
      setLogs([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getAuditLogs(orgId, {
        userId,
        entityType,
        entityId,
        page: 0,
        size: max,
      });
      setLogs(result.content || result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [orgId, userId, entityType, entityId, max]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, loading, error, refresh: fetchLogs };
};
