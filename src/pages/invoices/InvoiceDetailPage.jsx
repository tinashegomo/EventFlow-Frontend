import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useDoc } from '../../hooks/useOrgCollection';
import { COLLECTIONS } from '../../firebase/collections';
import { PageHeader, Card, Badge, Button, EmptyState } from '../../components/ui';
import PageTransition from '../../components/layout/PageTransition';
import { formatDate, formatDateTime, formatCurrency } from '../../utils/dateHelpers';
import { downloadInvoicePdf } from '../../utils/pdfExport';

const InvoiceDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentOrg } = useAuth();
  const { data: invoice, loading } = useDoc(COLLECTIONS.INVOICES, id);
  const [isExporting, setIsExporting] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-app-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <PageTransition>
        <PageHeader
          title="Invoice"
          actions={
            <Button variant="secondary" onClick={() => navigate('/invoices')} leftIcon={<ArrowLeft size={16} />}>
              Back
            </Button>
          }
        />
        <Card>
          <EmptyState title="Invoice not found" description="This invoice may have been deleted." />
        </Card>
      </PageTransition>
    );
  }

  const lineItems = invoice.lineItems || [];
  const showDiscount = (invoice.discountPercent || 0) > 0 || (invoice.discountAmount || 0) > 0;
  const showTax = (invoice.taxPercent || 0) > 0 || (invoice.taxAmount || 0) > 0;

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      await downloadInvoicePdf(invoice, currentOrg);
      toast.success('Invoice PDF downloaded');
    } catch (err) {
      toast.error(err.message || 'Failed to download the PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title={invoice.invoiceNumber}
          subtitle="Invoice preview"
          actions={
            <>
              <Button variant="secondary" onClick={() => navigate('/invoices')} leftIcon={<ArrowLeft size={16} />}>
                Back
              </Button>
              <Button
                variant="secondary"
                onClick={handleDownloadPdf}
                loading={isExporting}
                leftIcon={<Download size={16} />}
              >
                Download PDF
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/invoices/${id}/edit`)} leftIcon={<Pencil size={16} />}>
                Edit
              </Button>
            </>
          }
        />

        <Card>
          {/* Document header */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 pb-6 border-b border-app-border">
            <div>
              <h2 className="text-xl font-display font-semibold text-app-text-primary">
                {currentOrg?.name || 'Your Organization'}
              </h2>
              <p className="text-sm text-app-text-secondary mt-1">Invoice</p>
            </div>
            <div className="sm:text-right space-y-1">
              <Badge status={invoice.status} />
              <p className="text-xs text-app-text-muted">
                Issued {formatDateTime(invoice.createdAt)}
              </p>
              {invoice.dueDate && (
                <p className="text-xs text-app-text-muted">Due {formatDate(invoice.dueDate)}</p>
              )}
              {invoice.status === 'PAID' && invoice.paidAt && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Paid on {formatDate(invoice.paidAt)}
                </p>
              )}
            </div>
          </div>

          {/* Client + related quotation */}
          <div className="grid sm:grid-cols-2 gap-6 py-6 border-b border-app-border">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-app-text-muted mb-2">
                Billed To
              </p>
              <p className="font-medium">{invoice.clientName}</p>
              {invoice.clientEmail && (
                <p className="text-sm text-app-text-secondary">{invoice.clientEmail}</p>
              )}
              {invoice.clientPhone && (
                <p className="text-sm text-app-text-secondary">{invoice.clientPhone}</p>
              )}
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-app-text-muted mb-2">
                Source Quotation
              </p>
              {invoice.quotationId ? (
                <Link to={`/quotations/${invoice.quotationId}`} className="text-sm text-app-accent hover:underline">
                  View quotation
                </Link>
              ) : (
                <p className="text-sm text-app-text-muted">None</p>
              )}
            </div>
          </div>

          {/* Line items */}
          <div className="py-6 border-b border-app-border">
            <div className="rounded-xl border border-app-border overflow-x-auto">
              {/* Auto layout: each column is sized to its content, so a
                  header always sits above its values and spare width is
                  shared evenly rather than pooling in one column. */}
              <table className="w-full table-auto text-sm">
                <thead className="bg-app-bg-tertiary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-app-text-secondary whitespace-nowrap">Description</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-app-text-secondary whitespace-nowrap">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-app-text-secondary whitespace-nowrap">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-app-text-secondary whitespace-nowrap">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-app-text-muted">
                        No line items.
                      </td>
                    </tr>
                  ) : (
                    lineItems.map((li) => (
                      <tr key={li.id} className="border-t border-app-border">
                        <td className="px-4 py-3 text-left font-medium">{li.description}</td>
                        <td className="px-4 py-3 text-right">{li.quantity}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(li.unitPrice)}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatCurrency(li.total ?? (li.unitPrice || 0) * (li.quantity || 0))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="py-6 border-b border-app-border flex justify-end">
            <div className="w-full sm:w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-app-text-secondary">Subtotal</span>
                <span className="font-mono">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {showDiscount && (
                <div className="flex justify-between text-sm">
                  <span className="text-app-text-secondary">
                    Discount{invoice.discountPercent > 0 ? ` (${invoice.discountPercent}%)` : ''}
                  </span>
                  <span className="font-mono">-{formatCurrency(invoice.discountAmount)}</span>
                </div>
              )}
              {showTax && (
                <div className="flex justify-between text-sm">
                  <span className="text-app-text-secondary">
                    Tax{invoice.taxPercent > 0 ? ` (${invoice.taxPercent}%)` : ''}
                  </span>
                  <span className="font-mono">{formatCurrency(invoice.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-app-border pt-2 text-base font-semibold">
                <span>Total</span>
                <span className="font-mono">{formatCurrency(invoice.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-app-text-muted mb-2">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </Card>
      </div>
    </PageTransition>
  );
};

export default InvoiceDetailPage;
