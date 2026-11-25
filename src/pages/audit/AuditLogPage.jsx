import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowDownWideNarrow,
  ArrowRightLeft,
  ArrowUpNarrowWide,
  ArrowUpRight,
  Banknote,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useOrgCollection } from '../../hooks/useOrgCollection';
import { useAuditLogs } from '../../hooks/useAuditLogs';
import { COLLECTIONS } from '../../firebase/collections';
import { PageHeader, Button, Input, Select, EmptyState } from '../../components/ui';
import PageTransition from '../../components/layout/PageTransition';
import { formatDateTime, formatRelative, formatDate, isToday, daysUntil } from '../../utils/dateHelpers';

const ENTITY_TYPES = ['EVENT', 'EVENT_TYPE', 'INVENTORY_ITEM', 'QUOTATION', 'INVOICE', 'USER', 'ORGANIZATION'];
const ACTIONS = ['CREATED', 'UPDATED', 'DELETED', 'PROMOTED', 'DEMOTED', 'CONVERTED', 'STATUS_CHANGED', 'PAYMENT_RECORDED', 'PAYMENT_REMOVED'];

/** Per-action icon + tint used by the row marker and the action verb. */
const ACTION_META = {
  CREATED: { icon: Plus, tone: 'green' },
  UPDATED: { icon: Pencil, tone: 'blue' },
  DELETED: { icon: Trash2, tone: 'red' },
  PROMOTED: { icon: ArrowUpRight, tone: 'green' },
  DEMOTED: { icon: ArrowDownRight, tone: 'amber' },
  CONVERTED: { icon: ArrowRightLeft, tone: 'purple' },
  STATUS_CHANGED: { icon: RefreshCw, tone: 'amber' },
  PAYMENT_RECORDED: { icon: Banknote, tone: 'emerald' },
  PAYMENT_REMOVED: { icon: Undo2, tone: 'red' },
};

/** Reads as one sentence: "<actor> <verb> <entity>". */
const ACTION_VERB = {
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
  PROMOTED: 'promoted',
  DEMOTED: 'demoted',
  CONVERTED: 'converted',
  STATUS_CHANGED: 'changed the status of',
  PAYMENT_RECORDED: 'recorded a payment on',
  PAYMENT_REMOVED: 'removed a payment from',
};

// Static class strings so Tailwind can see them at build time.
const TONE_ICON = {
  green: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  purple: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

const TONE_TEXT = {
  green: 'text-green-700 dark:text-green-400',
  blue: 'text-blue-700 dark:text-blue-400',
  red: 'text-red-700 dark:text-red-400',
  amber: 'text-amber-700 dark:text-amber-400',
  purple: 'text-purple-700 dark:text-purple-400',
  emerald: 'text-emerald-700 dark:text-emerald-400',
};

const label = (v) => String(v || '').replace(/_/g, ' ');

const getActionMeta = (action) => ACTION_META[action] || { icon: ClipboardList, tone: 'gray' };
const toneIconClass = (tone) => TONE_ICON[tone] || 'bg-app-bg-tertiary text-app-text-secondary';
const toneTextClass = (tone) => TONE_TEXT[tone] || 'text-app-text-secondary';
const actionVerb = (action) => ACTION_VERB[action] || label(action).toLowerCase();

/** Parses a timestamp defensively — one malformed record must not blank the page. */
const parsedDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Local calendar day (YYYY-MM-DD), so grouping and the date filters agree. */
const dateKey = (value) => {
  const d = parsedDate(value);
  if (!d) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const dayLabel = (key) => {
  const d = key && key !== 'unknown' ? parsedDate(`${key}T00:00:00`) : null;
  if (!d) return 'Unknown date';
  if (isToday(d)) return 'Today';
  if (daysUntil(d) === -1) return 'Yesterday';
  return formatDate(d);
};

const plural = (n, word, pluralWord = `${word}s`) => `${n} ${n === 1 ? word : pluralWord}`;

const AuditLogPage = () => {
  const { currentOrg } = useAuth();
  const { logs, loading: logsLoading, error: logsError, refresh } = useAuditLogs({ orgId: currentOrg?.id, max: 200 });
  const { items: users } = useOrgCollection(COLLECTIONS.USERS);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [entityTypes, setEntityTypes] = useState([]);
  const [actions, setActions] = useState([]);
  const [userFilter, setUserFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const userOptions = users.map((u) => ({ value: u.id, label: u.displayName || u.email }));
  const userById = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u.displayName || u.email])),
    [users]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs
      .filter((l) => {
        const date = dateKey(l.createdAt);
        const matchFrom = !fromDate || (date && date >= fromDate);
        const matchTo = !toDate || (date && date <= toDate);
        const matchType = entityTypes.length === 0 || entityTypes.includes(l.entityType);
        const matchAction = actions.length === 0 || actions.includes(l.action);
        const matchUser = !userFilter || l.userId === userFilter;
        if (!matchFrom || !matchTo || !matchType || !matchAction || !matchUser) return false;
        if (!q) return true;
        const haystack = [l.entityName, l.details, l.userName, label(l.action), label(l.entityType)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const ta = parsedDate(a.createdAt)?.getTime() ?? 0;
        const tb = parsedDate(b.createdAt)?.getTime() ?? 0;
        return sortDir === 'desc' ? tb - ta : ta - tb;
      });
  }, [logs, search, fromDate, toDate, entityTypes, actions, userFilter, sortDir]);

  const grouped = useMemo(() => {
    const groups = [];
    const index = new Map();
    for (const log of filtered) {
      const key = dateKey(log.createdAt) || 'unknown';
      if (!index.has(key)) {
        index.set(key, { key, logs: [] });
        groups.push(index.get(key));
      }
      index.get(key).logs.push(log);
    }
    return groups;
  }, [filtered]);

  const activeCount =
    (fromDate ? 1 : 0) +
    (toDate ? 1 : 0) +
    (userFilter ? 1 : 0) +
    (search ? 1 : 0) +
    entityTypes.length +
    actions.length;

  const stats = useMemo(
    () => ({
      today: filtered.filter((l) => isToday(parsedDate(l.createdAt))).length,
      actors: new Set(filtered.map((l) => l.userId).filter(Boolean)).size,
    }),
    [filtered]
  );

  const toggleEntity = (t) => {
    setEntityTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };
  const toggleAction = (a) => {
    setActions((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };
  const clearAll = () => {
    setFromDate('');
    setToDate('');
    setEntityTypes([]);
    setActions([]);
    setUserFilter('');
    setSearch('');
  };

  const copyDetails = async (log) => {
    const text = [
      `${label(log.action)} · ${label(log.entityType)} — ${log.entityName || '—'}`,
      `By: ${log.userName || userById[log.userId] || 'Unknown'}`,
      `At: ${formatDateTime(log.createdAt)}`,
      log.details ? `Details: ${log.details}` : null,
      log.entityId ? `Entity ID: ${log.entityId}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(log.id);
      setTimeout(() => setCopiedId((id) => (id === log.id ? null : id)), 1500);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const filterChips = [
    search && { label: `“${search}”`, onRemove: () => setSearch('') },
    fromDate && { label: `From ${fromDate}`, onRemove: () => setFromDate('') },
    toDate && { label: `To ${toDate}`, onRemove: () => setToDate('') },
    userFilter && { label: userById[userFilter] || 'User', onRemove: () => setUserFilter('') },
    ...entityTypes.map((t) => ({ label: label(t), onRemove: () => toggleEntity(t) })),
    ...actions.map((a) => ({ label: label(a), onRemove: () => toggleAction(a) })),
  ].filter(Boolean);

  const hasLogs = logs.length > 0;

  return (
    <PageTransition>
      <PageHeader
        title="Audit Log"
        subtitle="Every change made across your organization, newest activity first."
        actions={
          <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={14} />} onClick={refresh}>
            Refresh
          </Button>
        }
      />

      {!logsError && (
        <p className="mb-3 text-xs text-app-text-muted">
          Showing <span className="font-medium text-app-text-secondary">{filtered.length}</span> of{' '}
          {plural(logs.length, 'entry', 'entries')}
          {stats.actors > 0 && <> · {plural(stats.actors, 'actor')}</>}
          {stats.today > 0 && <> · {stats.today} today</>}
          {activeCount > 0 && (
            <>
              {' '}
              · <span className="text-app-accent-dark dark:text-app-accent">{plural(activeCount, 'filter')} active</span>
            </>
          )}
        </p>
      )}

      <div className="rounded-2xl border border-app-border bg-app-bg-secondary overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-app-border px-3 py-2.5">
          <div className="flex-1 min-w-[180px]">
            <Input
              placeholder="Search entity, details or person…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search size={15} />}
              className="!py-1.5 !rounded-lg"
            />
          </div>
          <Button
            variant={activeCount > 0 ? 'primary' : 'secondary'}
            size="sm"
            leftIcon={<SlidersHorizontal size={14} />}
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            rightIcon={
              <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            }
          >
            Filters{activeCount > 0 ? ` · ${activeCount}` : ''}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={sortDir === 'desc' ? <ArrowDownWideNarrow size={14} /> : <ArrowUpNarrowWide size={14} />}
            onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
            title={sortDir === 'desc' ? 'Newest first — click for oldest first' : 'Oldest first — click for newest first'}
          >
            {sortDir === 'desc' ? 'Newest' : 'Oldest'}
          </Button>
        </div>

        {/* Filters */}
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-app-border bg-app-bg-primary/40"
            >
              <div className="space-y-3 px-3 py-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input label="From" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  <Input label="To" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                  <Select
                    label="Performed by"
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    placeholder="All users"
                    options={userOptions}
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold text-app-text-secondary mb-1.5">Entity type</p>
                  <ChipGroup options={ENTITY_TYPES} selected={entityTypes} onToggle={toggleEntity} />
                </div>

                <div>
                  <p className="text-xs font-semibold text-app-text-secondary mb-1.5">Action</p>
                  <ChipGroup options={ACTIONS} selected={actions} onToggle={toggleAction} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {filterChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-app-border bg-app-bg-primary/40 px-3 py-2">
            {filterChips.map((chip, i) => (
              <button
                key={`${chip.label}-${i}`}
                onClick={chip.onRemove}
                className="inline-flex items-center gap-1 rounded-full bg-app-accent-light px-2.5 py-0.5 text-[11px] font-medium text-app-accent-dark transition hover:opacity-80"
                title="Remove filter"
              >
                {chip.label}
                <X size={11} />
              </button>
            ))}
            <button
              onClick={clearAll}
              className="ml-1 text-[11px] text-app-text-muted hover:text-app-danger hover:underline"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Body */}
        {logsError ? (
          <div className="flex items-start gap-3 px-4 py-6">
            <AlertTriangle className="mt-0.5 flex-shrink-0 text-app-danger" size={18} />
            <div className="flex-1">
              <p className="mb-1 text-sm font-medium text-app-danger">Couldn&apos;t load the audit log</p>
              <p className="mb-3 text-xs text-app-text-secondary">
                {logsError.message || 'An unknown error occurred.'}
              </p>
              <button onClick={refresh} className="text-xs font-medium text-app-accent hover:underline">
                Try again
              </button>
            </div>
          </div>
        ) : logsLoading ? (
          <div className="divide-y divide-app-border">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-7 w-7 flex-shrink-0 animate-pulse rounded-lg bg-app-bg-tertiary" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-app-bg-tertiary" />
                  <div className="h-2.5 w-1/3 animate-pulse rounded bg-app-bg-tertiary" />
                </div>
              </div>
            ))}
          </div>
        ) : !hasLogs ? (
          <EmptyState
            icon={ClipboardList}
            title="No audit entries yet"
            description="Actions taken in your organization — creating events, converting quotations, recording payments — will appear here."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching entries"
            description="No activity matches the current filters. Try widening the date range or clearing a filter."
            action={{ label: 'Clear all filters', onClick: clearAll }}
          />
        ) : (
          <div>
            {grouped.map((group) => (
                <section key={group.key} aria-label={dayLabel(group.key)}>
                  <div className="flex items-center gap-2 border-b border-app-border bg-app-bg-tertiary/60 px-4 py-1.5">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-app-text-secondary">
                      {dayLabel(group.key)}
                    </h2>
                    <span className="text-[11px] text-app-text-muted">{group.logs.length}</span>
                    <div className="h-px flex-1 bg-app-border" />
                  </div>

                  <ul className="divide-y divide-app-border">
                    {group.logs.map((log) => {
                      const meta = getActionMeta(log.action);
                      const Icon = meta.icon;
                      const isExpanded = expandedId === log.id;
                      const actorName = log.userName || userById[log.userId] || 'Unknown';
                      const entityIdShort = log.entityId ? String(log.entityId).slice(0, 8) : null;
                      return (
                        <li key={log.id} className={isExpanded ? 'bg-app-bg-tertiary/40' : ''}>
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            aria-expanded={isExpanded}
                            className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-app-bg-tertiary/60"
                          >
                            <span className={`mt-0.5 flex-shrink-0 rounded-lg p-1.5 ${toneIconClass(meta.tone)}`}>
                              <Icon size={14} />
                            </span>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm leading-5 text-app-text-primary">
                                <span className="font-medium">{actorName}</span>{' '}
                                <span className={toneTextClass(meta.tone)}>{actionVerb(log.action)}</span>{' '}
                                <span className="font-medium">{log.entityName || 'untitled record'}</span>
                              </p>
                              <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-app-text-muted">
                                <span className="flex-shrink-0 rounded border border-app-border px-1.5 py-px font-mono text-[10px] uppercase tracking-wide text-app-text-secondary">
                                  {label(log.entityType)}
                                </span>
                                {log.details ? (
                                  <span className="truncate">{log.details}</span>
                                ) : (
                                  entityIdShort && <span className="truncate font-mono">#{entityIdShort}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-shrink-0 items-center gap-2 pt-0.5">
                              <time
                                dateTime={log.createdAt || undefined}
                                title={formatDateTime(log.createdAt)}
                                className="hidden whitespace-nowrap text-xs text-app-text-muted sm:block"
                              >
                                {formatRelative(log.createdAt)}
                              </time>
                              <ChevronDown
                                size={14}
                                className={`text-app-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            </div>
                          </button>

                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="space-y-2.5 px-4 pb-3.5 pl-14">
                                  {log.details && (
                                    <div className="flex items-start gap-2">
                                      <p className="flex-1 text-xs text-app-text-primary">{log.details}</p>
                                      <button
                                        onClick={() => copyDetails(log)}
                                        className="flex-shrink-0 rounded-lg p-1.5 text-app-text-muted hover:bg-app-bg-tertiary"
                                        title="Copy entry"
                                        aria-label="Copy entry details"
                                      >
                                        {copiedId === log.id ? (
                                          <Check size={14} className="text-app-success" />
                                        ) : (
                                          <Copy size={14} />
                                        )}
                                      </button>
                                    </div>
                                  )}

                                  <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                                    <DetailRow term="Performed by" value={actorName} />
                                    <DetailRow term="Timestamp" value={formatDateTime(log.createdAt)} />
                                    <DetailRow term="Entity type" value={label(log.entityType)} />
                                    {log.entityId && <DetailRow term="Entity ID" value={log.entityId} mono />}
                                  </dl>

                                  <div className="flex flex-wrap gap-1.5">
                                    <QuickFilterButton
                                      active={userFilter === log.userId}
                                      onClick={() => setUserFilter(userFilter === log.userId ? '' : (log.userId || ''))}
                                    >
                                      Only {actorName}&apos;s actions
                                    </QuickFilterButton>
                                    <QuickFilterButton
                                      active={entityTypes.length === 1 && entityTypes[0] === log.entityType}
                                      onClick={() => toggleEntity(log.entityType)}
                                    >
                                      Only {label(log.entityType)}
                                    </QuickFilterButton>
                                    <QuickFilterButton
                                      active={actions.length === 1 && actions[0] === log.action}
                                      onClick={() => toggleAction(log.action)}
                                    >
                                      Only {label(log.action)}
                                    </QuickFilterButton>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </li>
                      );
                    })}
                  </ul>
                </section>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
};

const ChipGroup = ({ options, selected, onToggle }) => (
  <div className="flex flex-wrap gap-1">
    {options.map((t) => {
      const active = selected.includes(t);
      return (
        <button
          key={t}
          onClick={() => onToggle(t)}
          aria-pressed={active}
          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
            active
              ? 'border-app-accent bg-app-accent-light text-app-accent-dark'
              : 'border-app-border text-app-text-secondary hover:bg-app-bg-tertiary hover:text-app-text-primary'
          }`}
        >
          {label(t)}
        </button>
      );
    })}
  </div>
);

const DetailRow = ({ term, value, mono = false }) => (
  <div className="flex min-w-0 gap-2">
    <dt className="flex-shrink-0 text-app-text-muted">{term}:</dt>
    <dd className={`truncate text-app-text-primary ${mono ? 'font-mono' : ''}`}>{value}</dd>
  </div>
);

const QuickFilterButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium transition ${
      active
        ? 'border-app-accent bg-app-accent text-white'
        : 'border-app-border text-app-text-secondary hover:bg-app-bg-tertiary hover:text-app-text-primary'
    }`}
  >
    {children}
  </button>
);

export default AuditLogPage;
