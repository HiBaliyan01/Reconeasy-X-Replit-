import React, { useState, useMemo } from 'react';
import {
  CheckCircle, Clock, AlertTriangle, Eye, Search
} from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { SettlementUploader } from './SettlementUploader';
import SettlementTable from './SettlementTable';
import { queryClient } from '../lib/queryClient';
import PaymentsHead from './subtabs/PaymentsHead';

interface PaymentData {
  id: string;
  utr: string;
  order_id: string;
  marketplace: 'Amazon' | 'Flipkart' | 'Myntra';
  expected_amount: number;
  received_amount: number;
  discrepancy: number;
  status: 'reconciled' | 'overdue' | 'discrepancy';
  settlement_date: string;
  commission: number;
  tds: number;
  net_amount: number;
  days_overdue?: number;
  created_at: string;
}

const mockPaymentData: PaymentData[] = [
  {
    id: 'PAY001',
    utr: 'UTR202401001',
    order_id: 'MYN-ORD-001',
    marketplace: 'Myntra',
    expected_amount: 2500,
    received_amount: 2500,
    discrepancy: 0,
    status: 'reconciled',
    settlement_date: '2024-01-15',
    commission: 250,
    tds: 25,
    net_amount: 2225,
    created_at: '2024-01-10T10:00:00Z'
  },
  {
    id: 'PAY002',
    utr: 'UTR202401002',
    order_id: 'AMZ-ORD-002',
    marketplace: 'Amazon',
    expected_amount: 1800,
    received_amount: 1650,
    discrepancy: -150,
    status: 'discrepancy',
    settlement_date: '2024-01-14',
    commission: 180,
    tds: 18,
    net_amount: 1452,
    created_at: '2024-01-11T14:30:00Z'
  },
  {
    id: 'PAY003',
    utr: 'UTR202401003',
    order_id: 'FLP-ORD-003',
    marketplace: 'Flipkart',
    expected_amount: 3200,
    received_amount: 0,
    discrepancy: -3200,
    status: 'overdue',
    settlement_date: '2024-01-05',
    commission: 320,
    tds: 32,
    net_amount: 2848,
    days_overdue: 18,
    created_at: '2024-01-05T09:15:00Z'
  }
];

export default function PaymentReconciliation() {
  const [payments] = useState<PaymentData[]>(mockPaymentData);
  const [activeSubTab, setActiveSubTab] =
    useState<'reconciled' | 'overdue' | 'discrepancy'>('reconciled');
  const [selectedPayment, setSelectedPayment] = useState<PaymentData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [marketplaceFilter, setMarketplaceFilter] = useState('all');
  const [selectedMarketplace, setSelectedMarketplace] =
    useState<'all' | 'Amazon' | 'Flipkart' | 'Myntra'>('all');

  const { data: allSettlements = [], isLoading: settlementsLoading, refetch: refetchSettlements } = useQuery({
    queryKey: ['/api/settlements'],
    queryFn: async () => {
      const response = await fetch('/api/settlements');
      return response.json();
    }
  });

  const recentSettlements = useMemo(() => {
    if (selectedMarketplace === 'all') return allSettlements;
    return allSettlements.filter((s: any) => s.marketplace === selectedMarketplace);
  }, [allSettlements, selectedMarketplace]);

  const handleUploadComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/settlements'] });
    refetchSettlements();
  };

  const marketplaceLogos = {
    Amazon: '/logos/amazon.png',
    Flipkart: '/logos/flipkart.png',
    Myntra: '/logos/myntra.png'
  };

  const filteredPayments = useMemo(() => {
    let filtered = payments.filter(p => p.status === activeSubTab);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.utr.toLowerCase().includes(q) || p.order_id.toLowerCase().includes(q)
      );
    }
    if (marketplaceFilter !== 'all') {
      filtered = filtered.filter(p => p.marketplace === marketplaceFilter);
    }
    return filtered;
  }, [payments, activeSubTab, searchTerm, marketplaceFilter]);

  const metrics = useMemo(() => {
    const reconciled = payments.filter(p => p.status === 'reconciled');
    const overdue = payments.filter(p => p.status === 'overdue');
    const discrepancy = payments.filter(p => p.status === 'discrepancy');
    return {
      reconciledCount: reconciled.length,
      reconciledAmount: reconciled.reduce((s, p) => s + p.received_amount, 0),
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((s, p) => s + p.expected_amount, 0),
      discrepancyCount: discrepancy.length,
      discrepancyAmount: discrepancy.reduce((s, p) => s + Math.abs(p.discrepancy), 0)
    };
  }, [payments]);

  const getMarketplaceBadge = (marketplace: string) => {
    const base = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    switch (marketplace) {
      case 'Amazon': return `${base} bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400`;
      case 'Flipkart': return `${base} bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400`;
      case 'Myntra': return `${base} bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400`;
      default: return `${base} bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300`;
    }
  };

  const renderTable = () => {
    if (filteredPayments.length === 0) {
      return (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-foreground mb-2">No Payments Found</h3>
          <p className="text-muted-foreground">
            {activeSubTab === 'reconciled' && 'No reconciled payments in this period.'}
            {activeSubTab === 'overdue' && 'No overdue payments found.'}
            {activeSubTab === 'discrepancy' && 'No payment discrepancies detected.'}
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              {['Payment Details','Marketplace','Expected','Received',
                ...(activeSubTab === 'discrepancy' ? ['Discrepancy'] : []),
                ...(activeSubTab === 'overdue' ? ['Days Overdue'] : []),
                'Settlement Date','Actions'
              ].map((h) => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {filteredPayments.map((payment) => (
              <tr key={payment.id} className="hover:bg-muted/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-foreground">{payment.utr}</div>
                    <div className="text-sm text-muted-foreground">{payment.order_id}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <img src={marketplaceLogos[payment.marketplace]} alt={payment.marketplace} className="w-5 h-5" />
                    <span className={getMarketplaceBadge(payment.marketplace)}>{payment.marketplace}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                  ₹{payment.expected_amount.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                  ₹{payment.received_amount.toLocaleString()}
                </td>

                {activeSubTab === 'discrepancy' && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-destructive">
                    ₹{Math.abs(payment.discrepancy).toLocaleString()}
                  </td>
                )}

                {activeSubTab === 'overdue' && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                      {payment.days_overdue} days
                    </span>
                  </td>
                )}

                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {format(new Date(payment.settlement_date), 'MMM dd, yyyy')}
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => setSelectedPayment(payment)}
                    className="text-primary hover:text-primary/80 hover:bg-primary/10 text-sm font-medium flex items-center gap-1 px-2 py-1 rounded transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Details</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (selectedPayment) {
    const renderCostBreakdown = (payment: PaymentData) => (
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-foreground mb-2">Expected Breakdown</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gross Amount:</span>
              <span className="text-foreground">₹{payment.expected_amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Commission:</span>
              <span className="text-destructive">-₹{payment.commission.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TDS:</span>
              <span className="text-destructive">-₹{payment.tds.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-medium pt-1 border-t border-border">
              <span className="text-foreground">Net Expected:</span>
              <span className="text-foreground">₹{payment.net_amount.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-foreground mb-2">Actual Settlement</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Received Amount:</span>
              <span className="text-foreground">₹{payment.received_amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-medium pt-1 border-t border-border">
              <span className="text-foreground">Discrepancy:</span>
              <span className={payment.discrepancy >= 0 ? 'text-success' : 'text-destructive'}>
                {payment.discrepancy >= 0 ? '+' : ''}₹{payment.discrepancy.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedPayment(null)}
            className="text-primary hover:text-primary/80 text-sm font-medium"
          >
            ← Back to Payments
          </button>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">{selectedPayment.utr}</h2>
              <p className="text-muted-foreground">{selectedPayment.order_id}</p>
            </div>
            <span className={getMarketplaceBadge(selectedPayment.marketplace)}>
              {selectedPayment.marketplace}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-foreground">₹{selectedPayment.expected_amount.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Expected Amount</div>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-foreground">₹{selectedPayment.received_amount.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Received Amount</div>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className={`text-2xl font-bold ${selectedPayment.discrepancy >= 0 ? 'text-success' : 'text-destructive'}`}>
                {selectedPayment.discrepancy >= 0 ? '+' : ''}₹{selectedPayment.discrepancy.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Discrepancy</div>
            </div>
          </div>

          {renderCostBreakdown(selectedPayment)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Standardized header */}
      <PaymentsHead />

      {/* Marketplace Tabs */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="border-b border-border">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'all', label: 'All Marketplaces' },
              { key: 'Amazon', label: 'Amazon' },
              { key: 'Flipkart', label: 'Flipkart' },
              { key: 'Myntra', label: 'Myntra' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSelectedMarketplace(key as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  selectedMarketplace === key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* CSV Upload */}
        <div className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              {selectedMarketplace === 'all' ? 'Upload Settlements' : `Upload ${selectedMarketplace} Settlements`}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedMarketplace === 'all'
                ? 'Upload CSV files from any marketplace. Data will be automatically categorized.'
                : `Upload settlement CSV specifically for ${selectedMarketplace}.`}
            </p>
          </div>
          <SettlementUploader
            onUploadComplete={handleUploadComplete}
            marketplace={selectedMarketplace === 'all' ? undefined : selectedMarketplace.toLowerCase()}
          />
        </div>
      </div>

      {/* Recent Settlements */}
      {recentSettlements.length > 0 && (
        <div className="bg-card rounded-xl shadow-sm border border-border">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">
              {selectedMarketplace === 'all' ? 'All Settlement Uploads' : `${selectedMarketplace} Settlements`}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {recentSettlements.length} settlements {selectedMarketplace === 'all' ? 'from all marketplaces' : `from ${selectedMarketplace}`}
            </p>
          </div>
          <SettlementTable settlements={recentSettlements} loading={settlementsLoading} />
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Reconciled Payments</p>
              <p className="text-2xl font-bold text-foreground">{metrics.reconciledCount}</p>
              <p className="text-sm text-muted-foreground">₹{metrics.reconciledAmount.toLocaleString()}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Overdue Payments</p>
              <p className="text-2xl font-bold text-foreground">{metrics.overdueCount}</p>
              <p className="text-sm text-muted-foreground">₹{metrics.overdueAmount.toLocaleString()}</p>
            </div>
            <Clock className="w-8 h-8 text-destructive" />
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Payment Discrepancies</p>
              <p className="text-2xl font-bold text-foreground">{metrics.discrepancyCount}</p>
              <p className="text-sm text-muted-foreground">₹{metrics.discrepancyAmount.toLocaleString()}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-warning" />
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Payment Records</h3>
            <p className="text-sm text-muted-foreground">
              {filteredPayments.length} payments in {activeSubTab} status
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search UTR or Order ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm bg-card text-foreground placeholder-muted-foreground"
              />
            </div>

            <select
              value={marketplaceFilter}
              onChange={(e) => setMarketplaceFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm bg-card text-foreground"
            >
              <option value="all">All Marketplaces</option>
              <option value="Amazon">Amazon</option>
              <option value="Flipkart">Flipkart</option>
              <option value="Myntra">Myntra</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sub-tabs + Table */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="border-b border-border">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'reconciled', label: 'Reconciled', Icon: CheckCircle, badge: metrics.reconciledCount, badgeClass: 'bg-emerald-100 text-emerald-800' },
              { key: 'overdue', label: 'Payment Overdue', Icon: Clock, badge: metrics.overdueCount, badgeClass: 'bg-destructive/10 text-destructive' },
              { key: 'discrepancy', label: 'Payment Discrepancy', Icon: AlertTriangle, badge: metrics.discrepancyCount, badgeClass: 'bg-amber-100 text-amber-800' },
            ].map(({ key, label, Icon, badge, badgeClass }) => (
              <button
                key={key}
                onClick={() => setActiveSubTab(key as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeSubTab === key
                    ? 'border-primary text-primary'
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
    </div>
  );
}