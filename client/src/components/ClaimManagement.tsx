import React, { useState, useEffect } from 'react';
import { Ticket, Clock, CheckCircle, XCircle, AlertTriangle, TrendingUp, User } from 'lucide-react';
import Badge from './Badge';
import ClaimsTable from './ClaimsTable';
import ClaimDetails from './ClaimDetails';
import ClaimsTracker from './ClaimsTracker';

type Claim = {
  id: string;
  order_id: string;
  marketplace: string;
  issue: string;
  claim_amount: number;
  status: 'Filed' | 'Awaiting Marketplace' | 'Resolved' | 'Rejected';
  last_updated: string;
};

const mockClaims: Claim[] = [
  {
    id: 'CLM1023',
    order_id: 'ORD12345',
    marketplace: 'Amazon',
    issue: 'Short Payment',
    claim_amount: 250,
    status: 'Awaiting Marketplace',
    last_updated: '2025-07-26',
  },
  {
    id: 'CLM1024',
    order_id: 'ORD12346',
    marketplace: 'Flipkart',
    issue: 'Damaged Return',
    claim_amount: 499,
    status: 'Filed',
    last_updated: '2025-07-25',
  },
  {
    id: 'CLM1025',
    order_id: 'ORD12347',
    marketplace: 'Myntra',
    issue: 'Missing Settlement',
    claim_amount: 1250,
    status: 'Resolved',
    last_updated: '2025-07-24',
  },
  {
    id: 'CLM1026',
    order_id: 'ORD12348',
    marketplace: 'Amazon',
    issue: 'Incorrect Commission',
    claim_amount: 75,
    status: 'Rejected',
    last_updated: '2025-07-23',
  },
  {
    id: 'CLM1027',
    order_id: 'ORD12349',
    marketplace: 'Flipkart',
    issue: 'Late Settlement',
    claim_amount: 1850,
    status: 'Awaiting Marketplace',
    last_updated: '2025-07-18',
  },
];

const ClaimManagement: React.FC = () => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [activeTab, setActiveTab] = useState<'returns' | 'payments'>('returns');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    // Simulate data fetch
    setClaims(mockClaims);
  }, []);

  const getStatusBadge = (status: Claim['status']) => {
    switch (status) {
      case 'Filed':
        return <Badge label="📄 Filed" variant="neutral" />;
      case 'Awaiting Marketplace':
        return <Badge label="⏳ Awaiting Marketplace" variant="purple" />;
      case 'Resolved':
        return <Badge label="🟢 Resolved" variant="positive" />;
      case 'Rejected':
        return <Badge label="❌ Rejected" variant="negative" />;
      default:
        return <Badge label={status} variant="neutral" />;
    }
  };

  const handleOrderClick = (orderId: string) => {
    // Navigate to claim detail page (placeholder for now)
    console.log(`Navigate to /claims/${orderId}`);
    // In a real app: navigate(`/claims/${orderId}`);
  };

  const getDaysAgo = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredClaims = claims.filter(claim => {
    if (activeTab === 'returns') {
      return ['Damaged Return', 'Missing Settlement'].includes(claim.issue);
    }
    return ['Short Payment', 'Incorrect Commission', 'Late Settlement'].includes(claim.issue);
  });

  const totalClaimAmount = filteredClaims.reduce((sum, claim) => sum + claim.claim_amount, 0);
  const resolvedCount = filteredClaims.filter(claim => claim.status === 'Resolved').length;
  const pendingCount = filteredClaims.filter(claim => claim.status !== 'Resolved' && claim.status !== 'Rejected').length;
  const awaitingLongTime = filteredClaims.filter(claim => 
    claim.status === 'Awaiting Marketplace' && getDaysAgo(claim.last_updated) > 7
  ).length;

  // If an order is selected, show claim details
  if (selectedOrderId) {
    return (
      <ClaimDetails 
        orderId={selectedOrderId} 
        onBack={() => setSelectedOrderId(null)} 
      />
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-teal-700 dark:to-cyan-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center space-x-2">
              <Ticket className="w-6 h-6" />
              <span>Claims Tracker</span>
            </h2>
            <p className="text-teal-100">Manage marketplace dispute claims</p>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-right">
              <p className="text-lg font-semibold">{filteredClaims.length}</p>
              <p className="text-teal-100 text-sm">Total Claims</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">₹{totalClaimAmount.toLocaleString()}</p>
              <p className="text-teal-100 text-sm">Claim Value</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Pending</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{pendingCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Resolved</p>
              <p className="text-xl font-bold positive-value">{resolvedCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-100 dark:bg-teal-900/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Success Rate</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {filteredClaims.length > 0 ? Math.round((resolvedCount / filteredClaims.length) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="border-b border-slate-200 dark:border-slate-700">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('returns')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'returns'
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              Returns Claims
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'payments'
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              Payment Claims
            </button>
          </nav>
        </div>

        {/* Claims Content */}
        <div className="p-6">
          <ClaimsTracker onClaimClick={setSelectedOrderId} />
        </div>
      </div>
    </div>
  );
};

export default ClaimManagement;