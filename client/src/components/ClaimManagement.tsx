import React, { useState, useEffect } from 'react';
import { Ticket, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
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
];

const ClaimManagement: React.FC = () => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [activeTab, setActiveTab] = useState<'returns' | 'payments'>('returns');

  useEffect(() => {
    // Simulate data fetch
    setClaims(mockClaims);
  }, []);

  const getStatusBadgeVariant = (status: Claim['status']) => {
    switch (status) {
      case 'Filed':
        return 'neutral';
      case 'Awaiting Marketplace':
        return 'purple';
      case 'Resolved':
        return 'positive';
      case 'Rejected':
        return 'negative';
      default:
        return 'neutral';
    }
  };

  const getStatusIcon = (status: Claim['status']) => {
    switch (status) {
      case 'Filed':
        return <Clock className="w-4 h-4" />;
      case 'Awaiting Marketplace':
        return <AlertTriangle className="w-4 h-4" />;
      case 'Resolved':
        return <CheckCircle className="w-4 h-4" />;
      case 'Rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const filteredClaims = claims.filter(claim => {
    if (activeTab === 'returns') {
      return ['Damaged Return', 'Missing Settlement'].includes(claim.issue);
    }
    return ['Short Payment', 'Incorrect Commission'].includes(claim.issue);
  });

  const totalClaimAmount = filteredClaims.reduce((sum, claim) => sum + claim.claim_amount, 0);
  const resolvedCount = filteredClaims.filter(claim => claim.status === 'Resolved').length;
  const pendingCount = filteredClaims.filter(claim => claim.status !== 'Resolved' && claim.status !== 'Rejected').length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="reconeasy-primary-gradient rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center space-x-2">
              <Ticket className="w-6 h-6" />
              <span>Claims Tracker</span>
            </h2>
            <p className="text-blue-100">Track and manage marketplace dispute claims</p>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-right">
              <p className="text-lg font-semibold">{filteredClaims.length}</p>
              <p className="text-blue-100 text-sm">Total Claims</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">₹{totalClaimAmount.toLocaleString()}</p>
              <p className="text-blue-100 text-sm">Claim Value</p>
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
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Ticket className="w-5 h-5 text-blue-600 dark:text-blue-400" />
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
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              Returns Claims
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'payments'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Claim ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Order ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Marketplace</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Issue</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Last Updated</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredClaims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{claim.id}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{claim.order_id}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{claim.marketplace}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{claim.issue}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">₹{claim.claim_amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(claim.status)}
                        <Badge 
                          label={claim.status}
                          variant={getStatusBadgeVariant(claim.status)}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{new Date(claim.last_updated).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex space-x-2">
                        <button className="text-[var(--primary)] hover:underline font-medium">Update</button>
                        <button className="text-green-600 dark:text-green-400 hover:underline font-medium">Resolve</button>
                      </div>
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
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">🔔 Tip:</p>
            <p className="text-blue-700 dark:text-blue-300">
              Claims with status "Awaiting Marketplace" for more than 7 days will show a reminder to follow up.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimManagement;