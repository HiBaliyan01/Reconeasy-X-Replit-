import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, FileText, Clock, CheckCircle, XCircle, AlertTriangle, ChevronDown, CheckSquare, Square, HelpCircle } from 'lucide-react';
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
  claimType: 'Returns' | 'Payments';
}

interface ClaimsTrackerTableProps {
  activeTab: 'Returns' | 'Payments';
  onClaimClick?: (orderId: string) => void;
}

const mockClaims: Claim[] = [
  {
    claimId: 'CLM12345',
    orderId: 'ORD001234',
    marketplace: 'Amazon',
    issue: 'Short Payment',
    claimValue: 2500,
    status: 'Awaiting Marketplace',
    age: 12,
    lastUpdated: '2025-07-16',
    priority: 'high',
    claimType: 'Payments'
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
    priority: 'medium',
    claimType: 'Payments'
  },
  {
    claimId: 'CLM12347',
    orderId: 'ORD001236',
    marketplace: 'Myntra',
    issue: 'Refund Discrepancy',
    claimValue: 750,
    status: 'Resolved',
    age: 18,
    lastUpdated: '2025-07-10',
    priority: 'low',
    claimType: 'Returns'
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
    priority: 'high',
    claimType: 'Payments'
  },
  {
    claimId: 'CLM12349',
    orderId: 'ORD001238',
    marketplace: 'Flipkart',
    issue: 'Return Processing Delay',
    claimValue: 890,
    status: 'Filed',
    age: 3,
    lastUpdated: '2025-07-25',
    priority: 'medium',
    claimType: 'Returns'
  },
  {
    claimId: 'CLM12350',
    orderId: 'ORD001239',
    marketplace: 'Myntra',
    issue: 'Incomplete Refund',
    claimValue: 150,
    status: 'Pending',
    age: 14,
    lastUpdated: '2025-07-15',
    priority: 'medium',
    claimType: 'Returns'
  }
];

const getStatusBadgeStyle = (status: string) => {
  const baseStyles = "inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border";
  
  switch (status) {
    case 'Resolved':
      return `${baseStyles} bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700`;
    case 'Rejected':
      return `${baseStyles} bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700`;
    case 'In Progress':
      return `${baseStyles} bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700`;
    case 'Awaiting Marketplace':
      return `${baseStyles} bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-700`;
    case 'Filed':
      return `${baseStyles} bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-700`;
    default:
      return `${baseStyles} bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600`;
  }
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

const getAgeDisplay = (age: number, status: string) => {
  let ageClass = "inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium";
  
  if (status === 'Resolved' || status === 'Rejected') {
    ageClass += " bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";
  } else if (age > 15) {
    ageClass += " bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300";
  } else if (age > 7) {
    ageClass += " bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300";
  } else {
    ageClass += " bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";
  }
  
  return (
    <span className={ageClass}>
      <Clock className="w-3 h-3" />
      <span>{age}d</span>
    </span>
  );
};

const ClaimsTrackerTable: React.FC<ClaimsTrackerTableProps> = ({ activeTab, onClaimClick }) => {
  const [claims, setClaims] = useState<Claim[]>(mockClaims);
  const [selectedClaims, setSelectedClaims] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [marketplaceFilter, setMarketplaceFilter] = useState('all');
  const [sortField, setSortField] = useState<keyof Claim>('age');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  // Filter claims by active tab
  const filteredClaims = claims.filter(claim => {
    const matchesTab = claim.claimType === activeTab;
    const matchesSearch = 
      claim.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.issue.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.claimId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
    const matchesMarketplace = marketplaceFilter === 'all' || claim.marketplace === marketplaceFilter;
    
    return matchesTab && matchesSearch && matchesStatus && matchesMarketplace;
  });

  // Sort claims
  const sortedClaims = [...filteredClaims].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    return 0;
  });

  const uniqueStatuses = Array.from(new Set(claims.filter(c => c.claimType === activeTab).map(c => c.status)));
  const uniqueMarketplaces = Array.from(new Set(claims.filter(c => c.claimType === activeTab).map(c => c.marketplace)));

  const handleSort = (field: keyof Claim) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClaims(sortedClaims.map(claim => claim.claimId));
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
    setShowBulkActions(false);
    // Reset selections after action
    setSelectedClaims([]);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Header with brand styling
    doc.setFontSize(18);
    doc.setTextColor(20, 184, 166); // Teal color
    doc.text(`${activeTab} Claims Report`, 20, 20);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 20, 30);
    
    const dataToExport = selectedClaims.length > 0 
      ? sortedClaims.filter(claim => selectedClaims.includes(claim.claimId))
      : sortedClaims;
      
    const totalValue = dataToExport.reduce((sum, claim) => sum + claim.claimValue, 0);
    const criticalClaims = dataToExport.filter(claim => claim.age > 15).length;
    
    doc.text(`Total Claims: ${dataToExport.length}`, 20, 40);
    doc.text(`Total Value: ₹${totalValue.toLocaleString()}`, 120, 30);
    doc.text(`Critical Claims (>15 days): ${criticalClaims}`, 120, 40);
    
    // Table data
    const tableData = dataToExport.map(claim => [
      claim.orderId,
      claim.marketplace,
      claim.issue,
      claim.status,
      `₹${claim.claimValue.toLocaleString()}`,
      `${claim.age} days`,
      claim.lastUpdated
    ]);
    
    autoTable(doc, {
      head: [['Order ID', 'Marketplace', 'Issue', 'Status', 'Value', 'Age', 'Updated']],
      body: tableData,
      startY: 55,
      headStyles: { 
        fillColor: [20, 184, 166],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      styles: { 
        fontSize: 9,
        cellPadding: 3
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      }
    });
    
    doc.save(`${activeTab.toLowerCase()}-claims-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportToExcel = () => {
    const dataToExport = selectedClaims.length > 0 
      ? sortedClaims.filter(claim => selectedClaims.includes(claim.claimId))
      : sortedClaims;
      
    const headers = ['Order ID', 'Marketplace', 'Issue', 'Claim Value', 'Status', 'Age (Days)', 'Last Updated'];
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(claim => [
        claim.orderId,
        claim.marketplace,
        `"${claim.issue}"`,
        claim.claimValue,
        claim.status,
        claim.age,
        claim.lastUpdated
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${activeTab.toLowerCase()}-claims-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const totalValue = sortedClaims.reduce((sum, claim) => sum + claim.claimValue, 0);
  const criticalCount = sortedClaims.filter(claim => claim.age > 15 && claim.status !== 'Resolved').length;
  const activeCount = sortedClaims.filter(claim => claim.status !== 'Resolved' && claim.status !== 'Rejected').length;

  return (
    <div className="space-y-6">
      {/* Header with Statistics */}
      <div className={`rounded-xl p-6 text-white ${activeTab === 'Returns' ? 'bg-gradient-to-r from-teal-600 to-cyan-600' : 'bg-gradient-to-r from-orange-500 to-red-500'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{activeTab} Claims Tracker</h2>
            <p className="opacity-90 mt-1">Monitor and manage marketplace {activeTab.toLowerCase()} disputes</p>
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <button
                onClick={exportToExcel}
                className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg transition-colors text-sm"
              >
                <FileText className="w-4 h-4" />
                <span>Excel</span>
              </button>
              <button
                onClick={exportToPDF}
                className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                <span>PDF</span>
              </button>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">₹{totalValue.toLocaleString()}</p>
              <p className="opacity-90 text-sm">Total Value</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{activeCount}</p>
              <p className="opacity-90 text-sm">Active</p>
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
              placeholder="Search Order ID or Issue..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:border-transparent w-72"
              style={{ '--tw-ring-color': activeTab === 'Returns' ? '#14b8a6' : '#f97316' } as React.CSSProperties}
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            <ChevronDown className={`w-4 h-4 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {selectedClaims.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowBulkActions(!showBulkActions)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-white transition-colors ${activeTab === 'Returns' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-orange-600 hover:bg-orange-700'}`}
            >
              <span>Bulk Actions ({selectedClaims.length})</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {showBulkActions && (
              <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 min-w-48">
                <button
                  onClick={() => handleBulkAction('update_status')}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-2"
                >
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Update Status</span>
                </button>
                <button
                  onClick={() => handleBulkAction('send_reminder')}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-2"
                >
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  <span>Send Reminder</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="all">All Statuses</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Marketplace</label>
              <select
                value={marketplaceFilter}
                onChange={(e) => setMarketplaceFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="all">All Marketplaces</option>
                {uniqueMarketplaces.map(marketplace => (
                  <option key={marketplace} value={marketplace}>{marketplace}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="w-10 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedClaims.length === sortedClaims.length && sortedClaims.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600"
                  onClick={() => handleSort('orderId')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Order ID</span>
                    <HelpCircle 
                      className="w-3 h-3 text-slate-400"
                      onMouseEnter={() => setShowTooltip('orderId')}
                      onMouseLeave={() => setShowTooltip(null)}
                    />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600"
                  onClick={() => handleSort('marketplace')}
                >
                  Marketplace
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Claim Type
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600"
                  onClick={() => handleSort('status')}
                >
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Raised On
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600"
                  onClick={() => handleSort('age')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Aging</span>
                    <HelpCircle 
                      className="w-3 h-3 text-slate-400"
                      onMouseEnter={() => setShowTooltip('aging')}
                      onMouseLeave={() => setShowTooltip(null)}
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {sortedClaims.map((claim, index) => (
                <tr 
                  key={claim.claimId}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                    selectedClaims.includes(claim.claimId) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onClaimClick?.(claim.orderId);
                    }
                  }}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedClaims.includes(claim.claimId)}
                      onChange={(e) => handleSelectClaim(claim.claimId, e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onClaimClick?.(claim.orderId)}
                      className={`font-medium hover:underline ${activeTab === 'Returns' ? 'text-teal-600' : 'text-orange-600'}`}
                    >
                      {claim.orderId}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                    {claim.marketplace}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                    {claim.issue}
                  </td>
                  <td className="px-4 py-3">
                    <span className={getStatusBadgeStyle(claim.status)}>
                      {getStatusIcon(claim.status)}
                      <span>{claim.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                    {claim.lastUpdated}
                  </td>
                  <td className="px-4 py-3">
                    {getAgeDisplay(claim.age, claim.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedClaims.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No {activeTab} Claims Found</h3>
            <p className="text-slate-600 dark:text-slate-400">
              No {activeTab.toLowerCase()} claims match your current search and filter criteria.
            </p>
          </div>
        )}
      </div>

      {/* Critical Claims Alert */}
      {criticalCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-800 dark:text-red-200">
              <p className="font-medium mb-1">Critical Claims Alert</p>
              <p className="text-red-700 dark:text-red-300">
                {criticalCount} {activeTab.toLowerCase()} claim(s) are over 15 days old and require immediate attention.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tooltips */}
      {showTooltip === 'orderId' && (
        <div className="fixed z-50 bg-black text-white text-xs px-2 py-1 rounded pointer-events-none">
          Click to view claim details and reconciliation snapshot
        </div>
      )}
      {showTooltip === 'aging' && (
        <div className="fixed z-50 bg-black text-white text-xs px-2 py-1 rounded pointer-events-none">
          Gray: &lt;7 days, Orange: 7+ days, Red: 15+ days (critical)
        </div>
      )}
    </div>
  );
};

export default ClaimsTrackerTable;