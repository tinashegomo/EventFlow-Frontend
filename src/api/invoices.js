import { api } from './client';

export const getInvoices = (orgId) =>
  api.get(`/organizations/${orgId}/invoices`);

export const getInvoice = (orgId, id) =>
  api.get(`/organizations/${orgId}/invoices/${id}`);

export const createInvoice = (orgId, data) =>
  api.post(`/organizations/${orgId}/invoices`, data);

export const updateInvoice = (orgId, id, data) =>
  api.put(`/organizations/${orgId}/invoices/${id}`, data);

export const deleteInvoice = (orgId, id) =>
  api.delete(`/organizations/${orgId}/invoices/${id}`);

export const markInvoiceAsPaid = (orgId, id) =>
  api.post(`/organizations/${orgId}/invoices/${id}/mark-paid`);
