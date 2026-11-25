import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, ArrowRightCircle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useDoc } from '../../hooks/useOrgCollection';
import { COLLECTIONS } from '../../firebase/collections';
import { PageHeader, Card, Badge, Button, EmptyState } from '../../components/ui';
import PageTransition from '../../components/layout/PageTransition';
import { formatDate, formatDateTime, formatCurrency } from '../../utils/dateHelpers';
import { downloadQuotationPdf } from '../../utils/pdfExport';

const CONVERTIBLE_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED'];

const QuotationDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentOrg } = useAuth();
  const { data: quotation, loading } = useDoc(COLLECTIONS.QUOTATIONS, id);
  const [isExporting, setIsExporting] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-app-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <PageTransition>
        <PageHeader
          title="Quotation"
          actions={
            <Button variant="secondary" onClick={() => navigate('/quotations')} leftIcon={<ArrowLeft size={16} />}>
              Back
            </Button>
          }
        />
        <Card>
          <EmptyState title="Quotation not found" description="This quotation may have been deleted." />
        </Card>
      </PageTransition>
    );
  }

  const lineItems = quotation.lineItems || [];
  const canConvert =
    CONVERTIBLE_STATUSES.includes(quotation.status) && !quotation.convertedToInvoiceId;

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      await downloadQuotationPdf(quotation, currentOrg);
      toast.success('Quotation PDF downloaded');
    } catch (err) {
      toast.error(err.message || 'Failed to download the PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const showDiscount = (quotation.discountPercent || 0) > 0 || (quotation.discountAmount || 0) > 0;
  const showTax = (quotation.taxPercent || 0) > 0 || (quotation.taxAmount || 0) > 0;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title={quotation.quotationNumber}
          subtitle="Quotation preview"
          actions={
            <>
              <Button variant="secondary" onClick={() => navigate('/quotations')} leftIcon={<ArrowLeft size={16} />}>
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
              {canConvert && (
                <Button
                  variant="primary"
                  onClick={() => navigate(`/invoices/new?fromQuotation=${id}`)}
                  leftIcon={<ArrowRightCircle size={16} />}
                >
                  Convert to Invoice
                </Button>
              )}
              <Button variant="secondary" onClick={() => navigate(`/quotations/${id}/edit`)} leftIcon={<Pencil size={16} />}>
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
              <p className="text-sm text-app-text-secondary mt-1">Quotation</p>
            </div>
            <div className="sm:text-right space-y-1">
              <Badge status={quotation.status} />
              <p className="text-xs text-app-text-muted">
                Issued {formatDateTime(quotation.createdAt)}
              </p>
              {quotation.validUntil && (
                <p className="text-xs text-app-text-muted">
                  Valid until {formatDate(quotation.validUntil)}
                </p>
              )}
            </div>
          </div>

          {/* Client + related event */}
          <div className="grid sm:grid-cols-2 gap-6 py-6 border-b border-app-border">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-app-text-muted mb-2">
                Billed To
              </p>
              <p className="font-medium">{quotation.clientName}</p>
              {quotation.clientEmail && (
                <p className="text-sm text-app-text-secondary">{quotation.clientEmail}</p>
              )}
              {quotation.clientPhone && (
                <p className="text-sm text-app-text-secondary">{quotation.clientPhone}</p>
              )}
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-app-text-muted mb-2">
                Related Event
              </p>
              {quotation.eventId ? (
                <Link to={`/events/${quotation.eventId}`} className="text-sm text-app-accent hover:underline">
                  View event
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
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-app-text-secondary whitespace-nowrap">Item</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-app-text-secondary whitespace-nowrap">Size</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-app-text-secondary whitespace-nowrap">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-app-text-secondary whitespace-nowrap">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-app-text-secondary whitespace-nowrap">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-app-text-muted">
                        No line items.
                      </td>
                    </tr>
                  ) : (
                    lineItems.map((li) => (
                      <tr key={li.id} className="border-t border-app-border">
                        <td className="px-4 py-3 text-left font-medium">{li.snapshotName}</td>
                        <td className="px-4 py-3 text-left text-app-text-secondary">{li.snapshotSize || '—'}</td>
                        <td className="px-4 py-3 text-right">{li.quantity}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(li.snapshotPrice)}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatCurrency((li.snapshotPrice || 0) * (li.quantity || 0))}
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
                <span className="font-mono">{formatCurrency(quotation.subtotal)}</span>
              </div>
              {showDiscount && (
                <div className="flex justify-between text-sm">
                  <span className="text-app-text-secondary">
                    Discount{quotation.discountPercent > 0 ? ` (${quotation.discountPercent}%)` : ''}
                  </span>
                  <span className="font-mono">-{formatCurrency(quotation.discountAmount)}</span>
                </div>
              )}
              {showTax && (
                <div className="flex justify-between text-sm">
                  <span className="text-app-text-secondary">
                    Tax{quotation.taxPercent > 0 ? ` (${quotation.taxPercent}%)` : ''}
                  </span>
                  <span className="font-mono">{formatCurrency(quotation.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-app-border pt-2 text-base font-semibold">
                <span>Total</span>
                <span className="font-mono">{formatCurrency(quotation.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Notes + conversion status */}
          {quotation.notes && (
            <div className="pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-app-text-muted mb-2">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{quotation.notes}</p>
            </div>
          )}
          {quotation.convertedToInvoiceId && (
            <div className="mt-6 text-sm text-app-text-secondary">
              This quotation has been converted to an invoice.{' '}
              <Link to={`/invoices/${quotation.convertedToInvoiceId}`} className="text-app-accent hover:underline">
                View invoice
              </Link>
            </div>
          )}
        </Card>
      </div>
    </PageTransition>
  );
};

export default QuotationDetailPage;
