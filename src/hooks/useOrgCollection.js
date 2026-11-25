import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const orgApi = {
  users: (orgId) => import('../api/users').then((m) => m.getUsers(orgId)),
  eventTypes: (orgId) => import('../api/eventTypes').then((m) => m.getEventTypes(orgId)),
  inventory: (orgId) => import('../api/inventory').then((m) => m.getInventory(orgId)),
  events: (orgId) => import('../api/events').then((m) => m.getEvents(orgId)),
  quotations: (orgId) => import('../api/quotations').then((m) => m.getQuotations(orgId)),
  invoices: (orgId) => import('../api/invoices').then((m) => m.getInvoices(orgId)),
};

export const useOrgCollection = (collectionName) => {
  const { currentOrg } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchItems = useCallback(async () => {
    const orgId = currentOrg?.id;
    if (!orgId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fetcher = orgApi[collectionName];
      if (!fetcher) {
        setItems([]);
        setLoading(false);
        return;
      }
      const data = await fetcher(orgId);
      setItems(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [collectionName, currentOrg?.id]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return { items, loading, error, refresh: fetchItems, setItems };
};

export const useDoc = (collectionName, docId) => {
  const { currentOrg } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDoc = useCallback(async () => {
    const orgId = currentOrg?.id;
    if (!docId || !orgId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const fetcher = {
      users: () => import('../api/users').then((m) => m.getUser(orgId, docId)),
      eventTypes: () => import('../api/eventTypes').then((m) => m.getEventType(orgId, docId)),
      inventory: () => import('../api/inventory').then((m) => m.getInventoryItem(orgId, docId)),
      events: () => import('../api/events').then((m) => m.getEvent(orgId, docId)),
      quotations: () => import('../api/quotations').then((m) => m.getQuotation(orgId, docId)),
      invoices: () => import('../api/invoices').then((m) => m.getInvoice(orgId, docId)),
    }[collectionName];
    if (!fetcher) {
      setData(null);
      setLoading(false);
      return;
    }
    try {
      setData(await fetcher());
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [collectionName, docId, currentOrg?.id]);

  useEffect(() => {
    fetchDoc();
  }, [fetchDoc]);

  return { data, loading, error, refresh: fetchDoc };
};
