import { getStoredOrgId } from '../api/client';

const orgId = () => getStoredOrgId();
const clean = (data) => {
  if (!data || typeof data !== 'object') return data;
  const rest = { ...data };
  delete rest.id;
  delete rest.createdAt;
  delete rest.updatedAt;
  delete rest.organizationId;
  return rest;
};

export const coll = () => { throw new Error('Direct collection reference removed — use the API layer'); };
export const orgQuery = () => { throw new Error('Direct query reference removed — use the API layer'); };

export const fetchOrgCollection = async (collectionName) => {
  switch (collectionName) {
    case 'eventTypes': return import('../api/eventTypes').then((m) => m.getEventTypes(orgId()));
    case 'inventory': return import('../api/inventory').then((m) => m.getInventory(orgId()));
    case 'events': return import('../api/events').then((m) => m.getEvents(orgId()));
    case 'quotations': return import('../api/quotations').then((m) => m.getQuotations(orgId()));
    case 'invoices': return import('../api/invoices').then((m) => m.getInvoices(orgId()));
    case 'users': return import('../api/users').then((m) => m.getUsers(orgId()));
    default: return [];
  }
};

export const fetchDoc = async (collectionName, id) => {
  switch (collectionName) {
    case 'eventTypes': return import('../api/eventTypes').then((m) => m.getEventType(orgId(), id));
    case 'inventory': return import('../api/inventory').then((m) => m.getInventoryItem(orgId(), id));
    case 'events': return import('../api/events').then((m) => m.getEvent(orgId(), id));
    case 'quotations': return import('../api/quotations').then((m) => m.getQuotation(orgId(), id));
    case 'invoices': return import('../api/invoices').then((m) => m.getInvoice(orgId(), id));
    default: return null;
  }
};

export const createDoc = async (collectionName, data) => {
  const payload = clean(data);
  switch (collectionName) {
    case 'eventTypes': {
      const res = await import('../api/eventTypes').then((m) => m.createEventType(orgId(), payload));
      return res.id;
    }
    case 'inventory': {
      const res = await import('../api/inventory').then((m) => m.createInventoryItem(orgId(), payload));
      return res.id;
    }
    case 'events': {
      const res = await import('../api/events').then((m) => m.createEvent(orgId(), payload));
      return res.id;
    }
    case 'quotations': {
      const res = await import('../api/quotations').then((m) => m.createQuotation(orgId(), payload));
      return res.id;
    }
    case 'invoices': {
      const res = await import('../api/invoices').then((m) => m.createInvoice(orgId(), payload));
      return res.id;
    }
    default: throw new Error(`No API creator for ${collectionName}`);
  }
};

export const setDocWithId = async () => { throw new Error('setDocWithId removed — use API create endpoints'); };

export const updateDocFields = async (collectionName, id, data) => {
  const payload = clean(data);
  switch (collectionName) {
    case 'eventTypes': return import('../api/eventTypes').then((m) => m.updateEventType(orgId(), id, payload));
    case 'inventory': return import('../api/inventory').then((m) => m.updateInventoryItem(orgId(), id, payload));
    case 'events': return import('../api/events').then((m) => m.updateEvent(orgId(), id, payload));
    case 'quotations': return import('../api/quotations').then((m) => m.updateQuotation(orgId(), id, payload));
    case 'invoices': return import('../api/invoices').then((m) => m.updateInvoice(orgId(), id, payload));
    case 'users': return import('../api/users').then((m) => m.updateUserRole(orgId(), id, data.role));
    case 'organizations': return import('../api/organizations').then((m) => m.updateOrganization(orgId(), payload));
    default: throw new Error(`No API updater for ${collectionName}`);
  }
};

export const deleteDocById = async (collectionName, id) => {
  switch (collectionName) {
    case 'eventTypes': return import('../api/eventTypes').then((m) => m.deleteEventType(orgId(), id));
    case 'inventory': return import('../api/inventory').then((m) => m.deleteInventoryItem(orgId(), id));
    case 'events': return import('../api/events').then((m) => m.deleteEvent(orgId(), id));
    case 'quotations': return import('../api/quotations').then((m) => m.deleteQuotation(orgId(), id));
    case 'invoices': return import('../api/invoices').then((m) => m.deleteInvoice(orgId(), id));
    default: throw new Error(`No API deleter for ${collectionName}`);
  }
};

export const subscribeToOrgCollection = () => { throw new Error('Real-time subscriptions removed — use useOrgCollection hook with refresh'); };
export const subscribeToDoc = () => { throw new Error('Real-time subscriptions removed — use useDoc hook'); };

