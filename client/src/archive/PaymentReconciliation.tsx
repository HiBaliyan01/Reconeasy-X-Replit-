import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle, Clock, Loader2, X } from 'lucide-react';
import { fetchReconciliations, ReconciliationRow, fetchSettlements } from '../services/reconciliations';
import { SettlementUploader } from './SettlementUploader';
import { queryClient } from '../lib/queryClient';

type ReconciliationState = 'RECONCILED' | 'OVERDUE' | 'DISCREPANCY';
type OperationalStatus = '' | 'PENDING' | 'DELAYED' | 'SETTLED';

const perPage = 20;

export default function PaymentReconciliation() {
  const [activeTab, setActiveTab] = useState<ReconciliationState>('RECONCILED');
  const [selectedRow, setSelectedRow] = useState<ReconciliationRow | null>(null);
  const [settlementPreview, setSettlementPreview] = useState<any[]>([]);
  const [settlementPreviewLoading, setSettlementPreviewLoading] = useState(false);
  const [marketplace, setMarketplace] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<OperationalStatus>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [slaDelayMin, setSlaDelayMin] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Debounce filter changes
  const [debouncedFilters, setDebouncedFilters] = useState({
    marketplace: '',
    statusFilter: '' as OperationalStatus,
    dateFrom: '',
    dateTo: '',
    slaDelayMin: '',
    offset: 0,
    sortBy: 'created_at',
    sortOrder: 'desc' as 'asc' | 'desc',
  });

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedFilters({
        marketplace,
        statusFilter,
        dateFrom,
        dateTo,
        slaDelayMin,
        offset,
        sortBy,
        sortOrder,
      });
    }, 300);
    return () => clearTimeout(t);
  }, [marketplace, statusFilter, dateFrom, dateTo, slaDelayMin, offset, sortBy, sortOrder]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      'reconciliations',
      activeTab,
      debouncedFilters.marketplace,
      debouncedFilters.statusFilter,
      debouncedFilters.dateFrom,
      debouncedFilters.dateTo,
      debouncedFilters.slaDelayMin,
      debouncedFilters.offset,
      debouncedFilters.sortBy,
      debouncedFilters.sortOrder,
    ],
    queryFn: () =>
      fetchReconciliations({
        reconciliation_state: activeTab,
        operational_status: debouncedFilters.statusFilter || undefined,
        marketplace: debouncedFilters.marketplace || undefined,
        date_from: debouncedFilters.dateFrom || undefined,
        date_to: debouncedFilters.dateTo || undefined,
        limit: perPage,
        offset: debouncedFilters.offset,
        sort_by: debouncedFilters.sortBy,
        sort_order: debouncedFilters.sortOrder,
        sla_delay_min: debouncedFilters.slaDelayMin || undefined,
      }),
    placeholderData: (previousData: any) => previousData,
  });

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const currentPage = Math.floor((debouncedFilters.offset || 0) / perPage) + 1;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const onSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setOffset(0);
  };

  const getStatusChipClass = (status?: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-slate-100 text-slate-700';
      case 'DELAYED':
        return 'bg-amber-100 text-amber-700';
      case 'SETTLED':
        return 'bg-emerald-100 text-emerald-700';
      case 'DISCREPANCY':
        return 'bg-rose-100 text-rose-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const handleUploadComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/settlements'] });
    refetch();
    setShowUploadModal(false);
  };

  const marketplaceOptions = [
    { key: '', label: 'All Marketplaces' },
    { key: 'Amazon', label: 'Amazon' },
    { key: 'Flipkart', label: 'Flipkart' },
    { key: 'Myntra', label: 'Myntra' },
  ];

  const reconciledCount = useMemo(
    () => (activeTab === 'RECONCILED' ? total : 0),
    [activeTab, total],
  );
  const overdueCount = useMemo(
    () => (activeTab === 'OVERDUE' ? total : 0),
    [activeTab, total],
  );
  const discrepancyCount = useMemo(
    () => (activeTab === 'DISCREPANCY' ? total : 0),
    [activeTab, total],
  );

  useEffect(() => {
    const loadSettlements = async () => {
      if (!selectedRow?.order_id) {
        setSettlementPreview([]);
        return;
      }
      try {
        setSettlementPreviewLoading(true);
        const data = await fetchSettlements({
          order_id: selectedRow.order_id,
          marketplace: selectedRow.marketplace,
          limit: 3,
        });
        setSettlementPreview(data?.rows ?? []);
      } catch (err) {
        setSettlementPreview([]);
      } finally {
        setSettlementPreviewLoading(false);
      }
    };
    loadSettlements();
  }, [selectedRow]);

  const renderTable = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading reconciliation records…</span>
        </div>
      );
    }

    if (isError) {
      return (
        <div className="text-center py-12 text-destructive">
          Failed to load reconciliation records. Please try again.
        </div>
      );
    }

    if (!rows.length) {
      return (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-foreground mb-2">No reconciliation records found for current filters.</h3>
          <p className="text-muted-foreground">Adjust filters to view more results.</p>
        </div>
      );
    }

    const columns = [
      { key: 'order_id', label: 'Order ID' },
      { key: 'marketplace', label: 'Marketplace' },
      { key: 'order_date', label: 'Activity Date' },
      { key: 'expected_net_payout', label: 'Expected Net Payout' },
      { key: 'actual_payout_amount', label: 'Actual Payout' },
      { key: 'discrepancy_amount', label: 'Discrepancy' },
      { key: 'operational_status', label: 'Status' },
      { key: 'sla_delay', label: 'SLA Delay' },
      { key: 'rate_card_id', label: 'Applied Rate Card' },
      { key: 'actions', label: 'Actions' },
    ];

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => onSort(col.key === 'actions' ? 'created_at' : col.key)}
                >
                  {col.label}
                  {sortBy === col.key && (
                    <span className="ml-1 text-[10px]">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {rows.map((row) => {
              const activityDate = row.order_date ? format(new Date(row.order_date), 'MMM dd, yyyy') : '—';
              const expectedNet = (row as any).expected_net_payout ?? null;
              const actualNet = (row as any).actual_payout_amount ?? null;
              const discrepancy =
                typeof expectedNet === 'number' && typeof actualNet === 'number'
                  ? expectedNet - actualNet
                  : null;
              const slaDelay = (() => {
                const expected = row.expected_payout_date ? new Date(row.expected_payout_date) : null;
                const actual = row.actual_payout_date ? new Date(row.actual_payout_date) : null;
                const today = new Date();
                if (!expected) return null;
                const baseline = actual || today;
                const diffDays = Math.floor((baseline.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24));
                return diffDays <= 0 ? 0 : diffDays;
              })();

              return (
                <tr key={row.id ?? row.order_id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => setSelectedRow(row)}
                      className="text-sm font-semibold text-foreground hover:text-emerald-700"
                    >
                      {row.order_id ?? '—'}
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                    {row.marketplace ?? '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">{activityDate}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-foreground">
                    {typeof expectedNet === 'number' ? `₹${Math.round(expectedNet).toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-foreground">
                    {typeof actualNet === 'number' ? `₹${Math.round(actualNet).toLocaleString()}` : '—'}
                  </td>
                  <td
                    className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${
                      discrepancy == null
                        ? 'text-slate-700'
                        : discrepancy < 0
                        ? 'text-rose-600'
                        : discrepancy > 0
                        ? 'text-emerald-700'
                        : 'text-slate-700'
                    }`}
                  >
                    {discrepancy == null ? '—' : `₹${Math.abs(Math.round(discrepancy)).toLocaleString()}`}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusChipClass(
                        row.operational_status,
                      )}`}
                    >
                      {row.operational_status ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                    {slaDelay == null ? '—' : slaDelay === 0 ? 'On time' : `${slaDelay} days`}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                    {row.rate_card_id ? `${row.marketplace ?? ''}-${row.category ?? ''}`.trim() || row.rate_card_id : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedRow(row)}
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded transition"
                      >
                        Details
                      </button>
                      <button className="text-slate-700 hover:text-slate-900 hover:bg-slate-100 px-2 py-1 rounded transition">
                        Raise Claim
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 gap-3 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} · Showing {rows.length} of {total} records
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={debouncedFilters.offset <= 0}
              onClick={() => setOffset(Math.max(0, debouncedFilters.offset - perPage))}
              className="px-3 py-1.5 text-sm rounded border border-border disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={debouncedFilters.offset + perPage >= total}
              onClick={() => setOffset(debouncedFilters.offset + perPage)}
              className="px-3 py-1.5 text-sm rounded border border-border disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDetailPanel = (row: ReconciliationRow) => {
    const activityDate = row.order_date ? format(new Date(row.order_date), 'MMM dd, yyyy') : '—';
    const expectedPayout = row.expected_payout_date ? format(new Date(row.expected_payout_date), 'MMM dd, yyyy') : '—';
    const delayThreshold = row.delay_threshold_date ? format(new Date(row.delay_threshold_date), 'MMM dd, yyyy') : '—';
    const lastPayoutDate = row.last_payout_date ? format(new Date(row.last_payout_date), 'MMM dd, yyyy') : '—';
    const expectedNet = row.expected_net_payout ?? 0;
    const actualNet = row.actual_payout_amount ?? 0;
    const discrepancy = expectedNet - actualNet;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedRow(null)}
            className="text-primary hover:text-primary/80 text-sm font-medium"
          >
            ← Back to Payments
          </button>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">{row.order_id ?? 'Order'}</h2>
              <p className="text-muted-foreground">{row.marketplace ?? '—'}</p>
            </div>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusChipClass(row.operational_status)}`}>
              {row.operational_status ?? '—'}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <h4 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Payout Timing</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Activity Date</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{activityDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Expected Payout Date</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{expectedPayout}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Delay Threshold</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{delayThreshold}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Last Payout Date</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{lastPayoutDate}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <h4 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Metadata</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Rate Card</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{row.rate_card_id ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Settlement Anchor</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{row.settlement_anchor ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Settlement Cycle</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{row.settlement_cycle ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Settlement Rows</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{row.settlement_rows_count ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <h4 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Expected vs Actual</h4>
            <div className="grid gap-3 md:grid-cols-3 text-sm">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Expected Net Payout</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">₹{Math.round(expectedNet).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Actual Payout</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">₹{Math.round(actualNet).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Discrepancy</p>
                <p className={`font-semibold ${discrepancy === 0 ? 'text-slate-900 dark:text-slate-100' : discrepancy > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  ₹{Math.abs(Math.round(discrepancy)).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent Settlement Rows</h4>
              {settlementPreviewLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
            </div>
            {settlementPreview.length === 0 && !settlementPreviewLoading && (
              <p className="text-sm text-muted-foreground">No settlements available.</p>
            )}
            {settlementPreview.length > 0 && (
              <div className="space-y-2">
                {settlementPreview.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded border border-slate-100 px-3 py-2 text-sm dark:border-slate-700">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{s.utr_number || 'UTR —'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {s.payout_date ? format(new Date(s.payout_date), 'MMM dd, yyyy') : '—'}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      ₹{Math.round(s.actual_settlement_amount ?? 0).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (selectedRow) {
    return renderDetailPanel(selectedRow);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border pb-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Payments Reconciliation</h1>
            <p className="text-sm text-muted-foreground">Monitor settlement accuracy and payout delays.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowUploadModal(true)}
              className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Import Settlement
            </button>
            <button className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-slate-50 dark:hover:bg-slate-800">
              Export
            </button>
            <button className="rounded-lg bg-emerald-500 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-600 shadow-sm">
              Reconcile Now
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: 'EXPECTED TOTAL', value: '—' },
              { label: 'RECEIVED TOTAL', value: '—' },
              { label: 'OUTSTANDING', value: '—' },
              { label: 'DELAYED', value: activeTab === 'OVERDUE' ? total : '—' },
              { label: 'DISCREPANCIES', value: activeTab === 'DISCREPANCY' ? total : '—' },
            ].map((item, idx) => (
              <div
                key={item.label}
                className={`flex flex-col gap-1 ${idx !== 0 ? 'sm:border-l sm:border-slate-200 sm:pl-4 dark:sm:border-slate-700' : ''}`}
              >
                <p className="text-[11px] font-semibold tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Action required */}
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-3 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm font-semibold text-foreground">Action Required</p>
          <div className="grid gap-2 sm:grid-cols-1">
            {['4 payments past SLA threshold', '2 high value discrepancies detected', '1 marketplace showing delayed trend'].map(
              (alert) => (
                <button
                  key={alert}
                  className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-900/20 dark:text-slate-100 dark:hover:bg-amber-900/30"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="font-semibold">{alert}</span>
                </button>
              ),
            )}
          </div>
        </div>

        {/* Marketplace quick filter buttons */}
        <div className="bg-card rounded-lg border border-border px-4 py-3">
          <nav className="flex flex-wrap gap-4">
            {marketplaceOptions.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => {
                  setMarketplace(key);
                  setOffset(0);
                }}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  marketplace === key
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Filters Row */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="grid gap-3 md:grid-cols-4 items-center">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">Marketplace</label>
            <select
              value={marketplace}
              onChange={(e) => {
                setMarketplace(e.target.value);
                setOffset(0);
              }}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-emerald-100 focus:border-emerald-200"
            >
              {marketplaceOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-xs font-semibold text-slate-500">Operational Status</label>
            <div className="flex flex-wrap gap-2">
              {['', 'PENDING', 'DELAYED', 'SETTLED', 'DISCREPANCY'].map((s) => (
                <button
                  key={s || 'ALL'}
                  onClick={() => {
                    setStatusFilter(s as OperationalStatus);
                    setOffset(0);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                    statusFilter === s
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'border border-slate-200 text-slate-600 hover:text-foreground hover:border-slate-300'
                  }`}
                >
                  {s || 'All'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 md:col-span-1">
            <label className="text-xs font-semibold text-slate-500">Date Range</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setOffset(0);
                }}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
              <span className="text-xs text-slate-500">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setOffset(0);
                }}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">SLA Delay (min days)</label>
            <input
              type="number"
              min={0}
              value={slaDelayMin}
              onChange={(e) => {
                setSlaDelayMin(e.target.value);
                setOffset(0);
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="e.g. 3"
            />
          </div>
        </div>
      </div>

      {/* Tabs + Table */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="border-b border-border">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'RECONCILED', label: 'Reconciled', Icon: CheckCircle, badge: reconciledCount, badgeClass: 'bg-emerald-100 text-emerald-800' },
              { key: 'OVERDUE', label: 'Payment Overdue', Icon: Clock, badge: overdueCount, badgeClass: 'bg-destructive/10 text-destructive' },
              { key: 'DISCREPANCY', label: 'Payment Discrepancy', Icon: AlertTriangle, badge: discrepancyCount, badgeClass: 'bg-amber-100 text-amber-800' },
            ].map(({ key, label, Icon, badge, badgeClass }) => (
              <button
                key={key}
                onClick={() => {
                  setActiveTab(key as ReconciliationState);
                  setOffset(0);
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === key
                    ? 'border-subheader-payments text-subheader-payments'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${badgeClass}`}>{badge}</span>
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">{renderTable()}</div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowUploadModal(false)}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-3xl rounded-2xl bg-white border border-border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Import Settlement</h3>
                <p className="text-sm text-muted-foreground">Upload settlement CSVs for reconciliation.</p>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <SettlementUploader
                onUploadComplete={handleUploadComplete}
                marketplace={marketplace || undefined}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
