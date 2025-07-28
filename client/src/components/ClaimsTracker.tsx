import React, { useState, useEffect } from 'react';
import { Search, Filter, HelpCircle, CheckSquare, Square, ChevronDown, AlertTriangle, Clock, CheckCircle, XCircle, FileText, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Claim {
  claimId: string;
  orderId: string;
  marketplace: string;
  issue: string;
  claimValue: number;
  status: string;
  age: number;
  lastUpdated: string;
  priority: 'low' | 'medium' | 'high';
}

interface ClaimsTrackerProps {
  onClaimClick?: (orderId: string) => void;
}

const mockData: Claim[] = [
  {
    claimId: 'CLM12345',
    orderId: 'ORD001234',
    marketplace: 'Amazon',
    issue: 'Short Payment',
    claimValue: 2500,
    status: 'Awaiting Marketplace',
    age: 12,
    lastUpdated: '2025-07-16',
    priority: 'high'
  },
  {
    claimId: 'CLM12346', 
    orderId: 'ORD001235',
    marketplace: 'Flipkart',
    issue: 'Missing Settlement',
    claimValue: 1850,
    status: 'In Progress',
    age: 5,
    lastUpdated: '2025-07-23',
    priority: 'medium'
  },
  {
    claimId: 'CLM12347',
    orderId: 'ORD001236', 
    marketplace: 'Myntra',
    issue: 'Incorrect Commission',
    claimValue: 750,
    status: 'Resolved',
    age: 18,
    lastUpdated: '2025-07-10',
    priority: 'low'
  },
  {
    claimId: 'CLM12348',
    orderId: 'ORD001237',
    marketplace: 'Amazon',
    issue: 'Late Settlement',
    claimValue: 3200,
    status: 'Awaiting Marketplace',
    age: 20,
    lastUpdated: '2025-07-08',
    priority: 'high'
  },
  {
    claimId: 'CLM12349',
    orderId: 'ORD001238',
    marketplace: 'Flipkart',
    issue: 'Refund Discrepancy',
    claimValue: 890,
    status: 'Filed',
    age: 3,
    lastUpdated: '2025-07-25',
    priority: 'medium'
  },
  {
    claimId: 'CLM12350',
    orderId: 'ORD001239',
    marketplace: 'Myntra',
    issue: 'Short Refund',
    claimValue: 150,
    status: 'Pending',
    age: 14,
    lastUpdated: '2025-07-15',
    priority: 'medium'
  },
  {
    claimId: 'CLM12351',
    orderId: 'ORD001240',
    marketplace: 'Flipkart',
    issue: 'Logistics Overcharge',
    claimValue: 90,
    status: 'Rejected',
    age: 19,
    lastUpdated: '2025-07-10',
    priority: 'low'
  }
];

const statusColor = (status: string, age: number): string => {
  if (status === 'Resolved') return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700';
  if (status === 'Rejected') return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700';
  if (age > 15) return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700';
  if (age > 7) return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-700';
  return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600';
};

const statusColorMap: Record<string, string> = {
  'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700',
  'In Progress': 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700',
  'Awaiting Marketplace': 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-700',
  'Resolved': 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700',
  'Rejected': 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700',
  'Filed': 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'Resolved': return <CheckCircle className="w-3 h-3" />;
    case 'Rejected': return <XCircle className="w-3 h-3" />;
    case 'In Progress': return <Clock className="w-3 h-3" />;
    case 'Awaiting Marketplace': return <AlertTriangle className="w-3 h-3" />;
    case 'Filed': return <FileText className="w-3 h-3" />;
    default: return <Clock className="w-3 h-3" />;
  }
};

const ClaimsTracker: React.FC<ClaimsTrackerProps> = ({ onClaimClick }) => {
  const [claims, setClaims] = useState<Claim[]>(mockData);
  const [selectedClaims, setSelectedClaims] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [marketplaceFilter, setMarketplaceFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [bulkStatusUpdate, setBulkStatusUpdate] = useState('');

  const filteredClaims = claims.filter(claim => {
    const matchesSearch = 
      claim.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.issue.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.claimId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
    const matchesMarketplace = marketplaceFilter === 'all' || claim.marketplace === marketplaceFilter;
    
    return matchesSearch && matchesStatus && matchesMarketplace;
  });

  const uniqueStatuses = Array.from(new Set(claims.map(claim => claim.status)));
  const uniqueMarketplaces = Array.from(new Set(claims.map(claim => claim.marketplace)));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClaims(filteredClaims.map(claim => claim.claimId));
    } else {
      setSelectedClaims([]);
    }
  };

  const handleSelectClaim = (claimId: string, checked: boolean) => {
    if (checked) {
      setSelectedClaims([...selectedClaims, claimId]);
    } else {
      setSelectedClaims(selectedClaims.filter(id => id !== claimId));
    }
  };

  const handleBulkAction = (action: string) => {
    console.log(`Bulk action: ${action} for claims:`, selectedClaims);
    
    if (action === 'update_status' && bulkStatusUpdate) {
      setClaims(prevClaims =>
        prevClaims.map(claim =>
          selectedClaims.includes(claim.claimId) 
            ? { ...claim, status: bulkStatusUpdate } 
            : claim
        )
      );
      setSelectedClaims([]);
      setBulkStatusUpdate('');
    }
    
    setShowBulkActions(false);
    // In a real app, you would call an API here
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text('Claims Summary Report', 20, 20);
    
    // Add generated date
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
    
    // Create table data
    const tableData = filteredClaims.map(claim => [
      claim.orderId,
      claim.marketplace,
      claim.issue,
      claim.status,
      `₹${claim.claimValue.toLocaleString()}`,
      `${claim.age} days`
    ]);
    
    // Add table
    autoTable(doc, {
      head: [['Order ID', 'Marketplace', 'Issue', 'Status', 'Claim Value', 'Age']],
      body: tableData,
      startY: 40,
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [59, 130, 246], // Blue color matching our theme
        textColor: 255,
      },
    });
    
    doc.save('claims_summary.pdf');
  };

  const handleRowClick = (orderId: string) => {
    if (onClaimClick) {
      onClaimClick(orderId);
    }
  };

  // Calculate statistics
  const totalValue = filteredClaims.reduce((sum, claim) => sum + claim.claimValue, 0);
  const overdueCount = filteredClaims.filter(claim => claim.age > 7 && claim.status !== 'Resolved').length;
  const criticalCount = filteredClaims.filter(claim => claim.age > 15 && claim.status !== 'Resolved').length;

  return (
    <div className="space-y-6">
      {/* Header with Statistics */}
      <div style={{ background: 'var(--primary)' }} className="rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Claims Tracker</h2>
            <p className="opacity-90 mt-1">Monitor and manage marketplace dispute claims</p>
          </div>
          <div className="flex items-center space-x-6">
            <button
              onClick={exportToPDF}
              className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            <div className="text-center">
              <p className="text-lg font-semibold">₹{totalValue.toLocaleString()}</p>
              <p className="opacity-90 text-sm">Total Value</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{overdueCount}</p>
              <p className="opacity-90 text-sm">Overdue</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{criticalCount}</p>
              <p className="opacity-90 text-sm">Critical</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Order ID, Issue, or Claim ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:border-transparent w-80"
            style={{ '--tw-ring-color': 'var(--primary)' } as React.CSSProperties}
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
              showFilters 
                ? 'border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
            style={{ 
              backgroundColor: showFilters ? 'var(--secondary)' : 'transparent',
              borderColor: showFilters ? 'var(--primary)' : undefined
            }}
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>

          {selectedClaims.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowBulkActions(!showBulkActions)}
                className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <span>Bulk Actions ({selectedClaims.length})</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {showBulkActions && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 min-w-64">
                  <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center space-x-2">
                      <select
                        value={bulkStatusUpdate}
                        onChange={(e) => setBulkStatusUpdate(e.target.value)}
                        className="flex-1 px-3 py-1 text-sm border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      >
                        <option value="">Update Status</option>
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                      <button
                        onClick={() => handleBulkAction('update_status')}
                        disabled={!bulkStatusUpdate}
                        className="px-3 py-1 text-sm text-white rounded transition-colors disabled:opacity-50"
                        style={{ backgroundColor: 'var(--primary)' }}
                      >
                        Update
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => handleBulkAction('remind')}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-2"
                  >
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <span>Send Reminder</span>
                  </button>
                  <button
                    onClick={() => handleBulkAction('export')}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-2"
                  >
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Export Selected</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Marketplace</label>
              <select
                value={marketplaceFilter}
                onChange={(e) => setMarketplaceFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:border-transparent"
              >
                <option value="all">All Marketplaces</option>
                {uniqueMarketplaces.map(marketplace => (
                  <option key={marketplace} value={marketplace}>{marketplace}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Age Filter</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:border-transparent"
                onChange={(e) => {
                  const value = e.target.value;
                  // Add age filtering logic here if needed
                }}
              >
                <option value="all">All Ages</option>
                <option value="recent">Recent (&lt; 7 days)</option>
                <option value="overdue">Overdue (&gt; 7 days)</option>
                <option value="critical">Critical (&gt; 15 days)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Claims Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full table-auto text-sm text-left">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
              <th className="p-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedClaims.length === filteredClaims.length && filteredClaims.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 bg-white border-slate-300 rounded"
                    style={{ 
                      accentColor: 'var(--primary)',
                      '--tw-ring-color': 'var(--primary)'
                    }}
                  />
                  <span className="uppercase tracking-wider text-xs font-semibold">Select</span>
                </div>
              </th>
              <th className="p-3">
                <div className="flex items-center space-x-1">
                  <span className="uppercase tracking-wider text-xs font-semibold">Order ID</span>
                  <div className="relative">
                    <HelpCircle 
                      className="w-4 h-4 text-slate-400 cursor-help"
                      onMouseEnter={() => setShowTooltip('orderId')}
                      onMouseLeave={() => setShowTooltip(null)}
                    />
                    {showTooltip === 'orderId' && (
                      <div className="absolute bottom-full left-0 mb-2 p-2 bg-slate-900 text-white text-xs rounded shadow-lg whitespace-nowrap z-10">
                        Click to view full claim details
                      </div>
                    )}
                  </div>
                </div>
              </th>
              <th className="p-3 uppercase tracking-wider text-xs font-semibold">Marketplace</th>
              <th className="p-3 uppercase tracking-wider text-xs font-semibold">Claim Type</th>
              <th className="p-3">
                <div className="flex items-center space-x-1">
                  <span className="uppercase tracking-wider text-xs font-semibold">Status</span>
                  <div className="relative">
                    <HelpCircle 
                      className="w-4 h-4 text-slate-400 cursor-help"
                      onMouseEnter={() => setShowTooltip('status')}
                      onMouseLeave={() => setShowTooltip(null)}
                    />
                    {showTooltip === 'status' && (
                      <div className="absolute bottom-full left-0 mb-2 p-2 bg-slate-900 text-white text-xs rounded shadow-lg whitespace-nowrap z-10">
                        Color coding: Gray &lt; 7 days, Orange &gt; 7 days, Red &gt; 15 days
                      </div>
                    )}
                  </div>
                </div>
              </th>
              <th className="p-3 uppercase tracking-wider text-xs font-semibold">Raised On</th>
              <th className="p-3">
                <div className="flex items-center space-x-1">
                  <span className="uppercase tracking-wider text-xs font-semibold">Aging</span>
                  <div className="relative">
                    <HelpCircle 
                      className="w-4 h-4 text-slate-400 cursor-help"
                      onMouseEnter={() => setShowTooltip('age')}
                      onMouseLeave={() => setShowTooltip(null)}
                    />
                    {showTooltip === 'age' && (
                      <div className="absolute bottom-full left-0 mb-2 p-2 bg-slate-900 text-white text-xs rounded shadow-lg whitespace-nowrap z-10">
                        Days since claim was created
                      </div>
                    )}
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {filteredClaims.map((claim) => (
              <tr
                key={claim.claimId}
                className="hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                style={{ backgroundColor: 'var(--secondary-light)' }}
                onClick={() => handleRowClick(claim.orderId)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRowClick(claim.orderId);
                  }
                }}
              >
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedClaims.includes(claim.claimId)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleSelectClaim(claim.claimId, e.target.checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 bg-white border-slate-300 rounded"
                    style={{ 
                      accentColor: 'var(--primary)',
                      '--tw-ring-color': 'var(--primary)'
                    }}
                  />
                </td>
                <td className="p-3 font-medium" style={{ color: 'var(--primary)' }}>
                  {claim.orderId}
                </td>
                <td className="p-3 text-slate-900 dark:text-slate-100">{claim.marketplace}</td>
                <td className="p-3 text-slate-600 dark:text-slate-400">{claim.issue}</td>
                <td className="p-3">
                  <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                    claim.status === 'Resolved' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300' :
                    claim.age > 15 ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300' :
                    claim.age > 7 ? 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300' :
                    'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    {getStatusIcon(claim.status)}
                    <span>{claim.status}</span>
                  </span>
                </td>
                <td className="p-3 text-slate-600 dark:text-slate-400">{claim.lastUpdated}</td>
                <td className="p-3">
                  <div className={`flex items-center space-x-1 ${
                    claim.age > 15 ? 'text-red-600 dark:text-red-400' :
                    claim.age > 7 ? 'text-orange-600 dark:text-orange-400' :
                    'text-slate-600 dark:text-slate-400'
                  }`}>
                    <span className="font-medium">{claim.age} days</span>
                    {claim.age > 7 && claim.status !== 'Resolved' && (
                      <div className="relative">
                        <Clock 
                          className="w-3 h-3 cursor-help"
                          onMouseEnter={() => setShowTooltip(`aging-${claim.claimId}`)}
                          onMouseLeave={() => setShowTooltip(null)}
                        />
                        {showTooltip === `aging-${claim.claimId}` && (
                          <div className="absolute bottom-full left-0 mb-2 p-2 bg-slate-900 text-white text-xs rounded shadow-lg whitespace-nowrap z-10">
                            {claim.age > 15 ? 'Follow up urgently with marketplace' : 'Consider following up'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredClaims.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No Claims Found</h3>
            <p className="text-slate-600 dark:text-slate-400">
              No claims match your current search and filter criteria.
            </p>
          </div>
        )}
      </div>

      {/* Action Required Alert */}
      {criticalCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-800 dark:text-red-200">
              <p className="font-medium mb-1">🚨 Critical Claims Alert</p>
              <p className="text-red-700 dark:text-red-300">
                {criticalCount} claim(s) are over 15 days old and require immediate attention for resolution.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaimsTracker;