import React from 'react';
import { Ticket, Clock, CheckCircle, XCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import Badge from './Badge';

const claimsData = [
  {
    orderId: "ORD12345",
    marketplace: "Amazon",
    issue: "Short Payment",
    amount: 250,
    status: "Awaiting Marketplace",
    lastUpdated: "2025-07-26",
    statusVariant: "purple",
  },
  {
    orderId: "ORD12348",
    marketplace: "Amazon",
    issue: "Incorrect Commission",
    amount: 75,
    status: "Rejected",
    lastUpdated: "2025-07-23",
    statusVariant: "negative",
  },
  {
    orderId: "ORD12349",
    marketplace: "Flipkart",
    issue: "Late Settlement",
    amount: 1850,
    status: "Awaiting Marketplace",
    lastUpdated: "2025-07-18",
    statusVariant: "purple",
  },
  {
    orderId: "ORD12347",
    marketplace: "Myntra",
    issue: "Missing Settlement",
    amount: 1250,
    status: "Resolved",
    lastUpdated: "2025-07-24",
    statusVariant: "positive",
  },
];

interface ClaimsTableProps {
  onOrderClick?: (orderId: string) => void;
}

export default function ClaimsTable({ onOrderClick }: ClaimsTableProps) {
  const handleOrderClick = (orderId: string) => {
    if (onOrderClick) {
      onOrderClick(orderId);
    } else {
      // Fallback logging
      console.log(`Navigate to /claims/${orderId}`);
    }
  };

  const getDaysAgo = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusBadge = (status: string, variant: string) => {
    const statusMap: Record<string, string> = {
      'Awaiting Marketplace': '⏳ Awaiting Marketplace',
      'Rejected': '❌ Rejected',
      'Resolved': '🟢 Resolved',
      'Filed': '📄 Filed'
    };
    
    return (
      <Badge 
        label={statusMap[status] || status} 
        variant={variant as 'neutral' | 'purple' | 'positive' | 'negative'} 
      />
    );
  };

  const pendingCount = claimsData.filter(claim => 
    claim.status !== 'Resolved' && claim.status !== 'Rejected'
  ).length;
  
  const resolvedCount = claimsData.filter(claim => claim.status === 'Resolved').length;
  
  const successRate = claimsData.length > 0 ? 
    Math.round((resolvedCount / claimsData.length) * 100) : 0;

  const awaitingLongTime = claimsData.filter(claim => 
    claim.status === 'Awaiting Marketplace' && getDaysAgo(claim.lastUpdated) > 7
  ).length;

  return (
    <div className="space-y-6">
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
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{successRate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Claims Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="bg-[var(--secondary)] dark:bg-slate-700 px-4 py-3 text-sm font-semibold grid grid-cols-6 gap-4">
          <div className="text-slate-600 dark:text-slate-400 uppercase tracking-wider">Order ID</div>
          <div className="text-slate-600 dark:text-slate-400 uppercase tracking-wider">Marketplace</div>
          <div className="text-slate-600 dark:text-slate-400 uppercase tracking-wider">Issue</div>
          <div className="text-slate-600 dark:text-slate-400 uppercase tracking-wider">Amount</div>
          <div className="text-slate-600 dark:text-slate-400 uppercase tracking-wider">Status</div>
          <div className="text-slate-600 dark:text-slate-400 uppercase tracking-wider">Last Updated</div>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {claimsData.map((claim) => (
            <div
              key={claim.orderId}
              className="grid grid-cols-6 gap-4 items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
              onClick={() => handleOrderClick(claim.orderId)}
            >
              <div className="font-medium text-teal-600 dark:text-teal-400 hover:underline">
                {claim.orderId}
              </div>
              <div className="text-slate-900 dark:text-slate-100">{claim.marketplace}</div>
              <div className="text-slate-600 dark:text-slate-400">{claim.issue}</div>
              <div className="font-medium text-slate-900 dark:text-slate-100">₹{claim.amount.toLocaleString()}</div>
              <div>
                {getStatusBadge(claim.status, claim.statusVariant)}
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                {new Date(claim.lastUpdated).toLocaleDateString()}
                {claim.status === 'Awaiting Marketplace' && getDaysAgo(claim.lastUpdated) > 7 && (
                  <span className="ml-2 text-xs text-orange-600 dark:text-orange-400 font-medium">
                    ({getDaysAgo(claim.lastUpdated)} days)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tip Banner */}
      <div className={`border rounded-lg p-4 ${awaitingLongTime > 0 ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' : 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800'}`}>
        <div className="flex items-start space-x-3">
          {awaitingLongTime > 0 ? (
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
          ) : (
            <Ticket className="w-5 h-5 text-teal-600 dark:text-teal-400 mt-0.5 flex-shrink-0" />
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
}