import { markInvoiceAsPaid as apiMarkPaid } from '../api/invoices';

// OVERDUE status is maintained by the backend scheduler (DocumentStatusScheduler), so the
// client only needs to trigger explicit user actions such as marking an invoice paid.
export const markInvoiceAsPaid = async (orgId, invoiceId) => {
  await apiMarkPaid(orgId, invoiceId);
};
