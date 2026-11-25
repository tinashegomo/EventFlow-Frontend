import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Receipt, Search, CheckCircle2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useOrgCollection } from '../../hooks/useOrgCollection';
import { COLLECTIONS } from '../../firebase/collections';
import { INVOICE_STATUSES } from '../../utils/business';
import { markInvoiceAsPaid } from '../../utils/invoiceHelpers';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  ConfirmDialog,
  Input,
  Select,
  EmptyState,
} from '../../components/ui';
import PageTransition from '../../components/layout/PageTransition';
import { deleteDocById, fetchDoc } from '../../firebase/db';
import { writeAuditLog } from '../../utils/audit';
import { formatDate, formatCurrency } from '../../utils/dateHelpers';

const InvoicesPage = () => {
  const { currentOrg, user } = useAuth();
  const navigate = useNavigate();
  const { items: invoices } = useOrgCollection(COLLECTIONS.INVOICES);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [confirm, setConfirm] = useState(null);

  const filtered = useMemo(() => {
    return invoices
      .filter((i) => {
        const matchSearch =
          !search ||
          (i.clientName || '').toLowerCase().includes(search.toLowerCase()) ||
          (i.invoiceNumber || '').toLowerCase().includes(search.toLowerCase());
        const matchStatus = !statusFilter || i.status === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => (b.invoiceNumber || '').localeCompare(a.invoiceNumber || ''));
  }, [invoices, search, statusFilter]);

  const handleDelete = async (item) => {
    if (!currentOrg) return;
    // The backend resets the source quotation (ACCEPTED, convertedToInvoiceId=null)
    // inside InvoiceService.delete, so no follow-up quotation update is needed here.
    await deleteDocById(COLLECTIONS.INVOICES, item.id);
    await writeAuditLog({
      organizationId: currentOrg.id,
      userId: user?.uid,
      userName: user?.displayName,
      action: 'DELETED',
      entityType: 'INVOICE',
      entityId: item.id,
      entityName: item.invoiceNumber,
      details: `Deleted invoice ${item.invoiceNumber}`,
    });
    toast.success('Invoice deleted');
  };

  const handleMarkPaid = async (item) => {
    if (!currentOrg) return;
    await markInvoiceAsPaid(currentOrg.id, item.id);
    await writeAuditLog({
      organizationId: currentOrg.id,
      userId: user?.uid,
      userName: user?.displayName,
      action: 'STATUS_CHANGED',
      entityType: 'INVOICE',
      entityId: item.id,
      entityName: item.invoiceNumber,
      details: `Marked invoice ${item.invoiceNumber} as paid`,
    });
    toast.success('Invoice marked as paid');
  };

  const SourceLabel = ({ invoice }) => {
    const [label, setLabel] = useState('Direct');
    const quotationId = invoice?.quotationId;
    useEffect(() => {
      if (!quotationId) { setLabel('Direct'); return; }
      fetchDoc(COLLECTIONS.QUOTATIONS, quotationId).then((q) => {
        setLabel(`From ${q?.quotationNumber || 'QUO'}`);
      });
    }, [quotationId]);
    return <>{label}</>;
  };

  return (
    <PageTransition>
      <PageHeader
        title="Invoices"
        subtitle="Manage and track invoices sent to clients."
        actions={
          <Link to="/invoices/new">
            <Button leftIcon={<Plus size={16} />}>New Invoice</Button>
          </Link>
        }
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            placeholder="Search by client or #"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={16} />}
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="All statuses"
            options={INVOICE_STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </div>
      </Card>

      {invoices.length === 0 ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title="No invoices yet"
            description="Create your first invoice to bill a client."
            action={{ label: 'New Invoice', onClick: () => navigate('/invoices/new') }}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((i) => {
            return (
              <Card
                key={i.id}
                className="hover:border-app-accent"
                onClick={() => navigate(`/invoices/${i.id}`)}
              >
                <div className="flex items-center gap-x-4 gap-y-3 flex-wrap">
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-semibold text-app-text-primary truncate">{i.clientName}</p>
                    <p className="text-xs text-app-text-muted mt-0.5 font-mono truncate">
                      {i.invoiceNumber} · Due {formatDate(i.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    <Badge status={i.status} />
                    <span className="text-xs text-app-text-muted hidden md:inline px-2 py-0.5 rounded-md bg-app-bg-tertiary whitespace-nowrap">
                      <SourceLabel invoice={i} />
                    </span>
                    <span className="font-mono text-sm font-semibold text-app-text-primary whitespace-nowrap">
                      {formatCurrency(i.totalAmount)}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-1 pl-3 sm:pl-4 border-l border-app-border shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => navigate(`/invoices/${i.id}`)}
                      className="p-2 rounded-lg hover:bg-app-bg-tertiary text-app-text-muted"
                      title="Preview"
                      aria-label="Preview invoice"
                    >
                      <Eye size={16} />
                    </button>
                    {i.status === 'SENT' && (
                      <button
                        onClick={() => handleMarkPaid(i)}
                        className="p-2 rounded-lg hover:bg-app-bg-tertiary text-app-success"
                        title="Mark as Paid"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                    <Link to={`/invoices/${i.id}/edit`}>
                      <button className="p-2 rounded-lg hover:bg-app-bg-tertiary text-app-text-muted">
                        <Pencil size={16} />
                      </button>
                    </Link>
                    <button
                      onClick={() => setConfirm(i)}
                      className="p-2 rounded-lg hover:bg-app-bg-tertiary text-app-text-muted hover:text-app-danger"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <Card>
              <p className="text-center text-sm text-app-text-muted py-8">
                No invoices match your filters.
              </p>
            </Card>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => handleDelete(confirm)}
        title={`Delete ${confirm?.invoiceNumber}?`}
        message="This action cannot be undone."
        confirmLabel="Delete"
      />
    </PageTransition>
  );
};

export default InvoicesPage;
