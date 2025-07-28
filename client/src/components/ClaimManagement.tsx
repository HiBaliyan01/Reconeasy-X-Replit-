import React, { useState, useEffect } from 'react';
import { Ticket, Clock, CheckCircle, XCircle, AlertTriangle, TrendingUp, User } from 'lucide-react';
import Badge from './Badge';

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

        {/* Claims Table */}
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--secondary)] dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Order ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Marketplace</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Issue</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredClaims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3 text-sm">
                      <button 
                        onClick={() => handleOrderClick(claim.order_id)}
                        className="font-medium text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                      >
                        {claim.order_id}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{claim.marketplace}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{claim.issue}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">₹{claim.claim_amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">
                      {getStatusBadge(claim.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {new Date(claim.last_updated).toLocaleDateString()}
                      {claim.status === 'Awaiting Marketplace' && getDaysAgo(claim.last_updated) > 7 && (
                        <span className="ml-2 text-xs text-orange-600 dark:text-orange-400 font-medium">
                          ({getDaysAgo(claim.last_updated)} days)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {filteredClaims.length === 0 && (
            <div className="text-center py-12">
              <Ticket className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No Claims Found</h3>
              <p className="text-slate-600 dark:text-slate-400">
                No {activeTab} claims are currently active.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tip Banner */}
      <div className={`border rounded-lg p-4 ${awaitingLongTime > 0 ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' : 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800'}`}>
        <div className="flex items-start space-x-3">
          {awaitingLongTime > 0 ? (
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
          ) : (
            <User className="w-5 h-5 text-teal-600 dark:text-teal-400 mt-0.5 flex-shrink-0" />
          )}
          <div className={`text-sm ${awaitingLongTime > 0 ? 'text-yellow-800 dark:text-yellow-200' : 'text-teal-800 dark:text-teal-200'}`}>
            <p className="font-medium mb-1">
              {awaitingLongTime > 0 ? '⚠️ Action Required:' : '💡 Tip:'}
            </p>
            <p className={awaitingLongTime > 0 ? 'text-yellow-700 dark:text-yellow-300' : 'text-teal-700 dark:text-teal-300'}>
              {awaitingLongTime > 0 
                ? `${awaitingLongTime} claim(s) awaiting marketplace response for more than 7 days. Consider following up for faster resolution.`
                : 'Claims with status "Awaiting Marketplace" for more than 7 days will show a reminder to follow up.'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimManagement;