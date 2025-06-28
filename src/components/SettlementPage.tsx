import React, { useState, useMemo } from 'react';
import { 
  CreditCard, AlertTriangle, CheckCircle, Clock, Filter, Search, 
  Download, Eye, Calendar, IndianRupee, TrendingUp, FileText
} from 'lucide-react';
import { format } from 'date-fns';

interface SettlementData {
  id: string;
  settlement_id: string;
  marketplace: 'Amazon' | 'Flipkart' | 'Myntra';
  settlement_date: string;
  total_amount: number;
  commission: number;
  tds: number;
  net_amount: number;
  status: 'pending' | 'processed' | 'failed' | 'disputed';
  ticket_count: number;
  claimed_amount: number;
  resolution_status: 'open' | 'in_progress' | 'resolved';
  orders_count: number;
  returns_count: number;
  created_at: string;
}

const mockSettlementData: SettlementData[] = [
  {
    id: 'SETT001',
    settlement_id: 'MYN-SETT-2024-001',
    marketplace: 'Myntra',
    settlement_date: '2024-01-20T00:00:00Z',
    total_amount: 125000,
    commission: 18750,
    tds: 1250,
    net_amount: 105000,
    status: 'processed',
    ticket_count: 3,
    claimed_amount: 15000,
    resolution_status: 'in_progress',
    orders_count: 85,
    returns_count: 12,
    created_at: '2024-01-20T10:30:00Z'
  },
  {
    id: 'SETT002',
    settlement_id: 'AMZ-SETT-2024-002',
    marketplace: 'Amazon',
    settlement_date: '2024-01-19T00:00:00Z',
    total_amount: 98000,
    commission: 14700,
    tds: 980,
    net_amount: 82320,
    status: 'pending',
    ticket_count: 1,
    claimed_amount: 5000,
    resolution_status: 'open',
    orders_count: 65,
    returns_count: 8,
    created_at: '2024-01-19T14:20:00Z'
  },
  {
    id: 'SETT003',
    settlement_id: 'FLP-SETT-2024-003',
    marketplace: 'Flipkart',
    settlement_date: '2024-01-18T00:00:00Z',
    total_amount: 156000,
    commission: 23400,
    tds: 1560,
    net_amount: 131040,
    status: 'disputed',
    ticket_count: 5,
    claimed_amount: 25000,
    resolution_status: 'open',
    orders_count: 102,
    returns_count: 18,
    created_at: '2024-01-18T09:15:00Z'
  }
];

export default function SettlementPage() {
  const [settlements] = useState<SettlementData[]>(mockSettlementData);
  const [selectedSettlement, setSelectedSettlement] = useState<SettlementData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [marketplaceFilter, setMarketplaceFilter] = useState('all');

  const marketplaceLogos = {
    Amazon: '/logos/amazon.png',
    Flipkart: '/logos/flipkart.png',
    Myntra: '/logos/myntra.png'
  };

  // Filter settlements
  const filteredSettlements = useMemo(() => {
    return settlements.filter(settlement => {
      if (searchTerm && !settlement.settlement_id.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (statusFilter !== 'all' && settlement.status !== statusFilter) return false;
      if (marketplaceFilter !== 'all' && settlement.marketplace !== marketplaceFilter) return false;
      return true;
    });
  }, [settlements, searchTerm, statusFilter, marketplaceFilter]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalSettlements = filteredSettlements.length;
    const totalAmount = filteredSettlements.reduce((sum, s) => sum + s.net_amount, 0);
    const totalClaimed = filteredSettlements.reduce((sum, s) => sum + s.claimed_amount, 0);
    const pendingTickets = filteredSettlements.reduce((sum, s) => sum + (s.resolution_status !== 'resolved' ? s.ticket_count : 0), 0);
    
    return { totalSettlements, totalAmount, totalClaimed, pendingTickets };
  }, [filteredSettlements]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'disputed':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (status) {
      case 'processed':
        return `${baseClasses} bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400`;
      case 'pending':
        return `${baseClasses} bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400`;
      case 'failed':
        return `${baseClasses} bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400`;
      case 'disputed':
        return `${baseClasses} bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400`;
      default:
        return `${baseClasses} bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300`;
    }
  };

  const getResolutionBadge = (status: string) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (status) {
      case 'resolved':
        return `${baseClasses} bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400`;
      case 'in_progress':
        return `${baseClasses} bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400`;
      case 'open':
        return `${baseClasses} bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400`;
      default:
        return `${baseClasses} bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300`;
    }
  };

  const getMarketplaceBadge = (marketplace: string) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (marketplace) {
      case 'Amazon':
        return `${baseClasses} bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400`;
      case 'Flipkart':
        return `${baseClasses} bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400`;
      case 'Myntra':
        return `${baseClasses} bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400`;
      default:
        return `${baseClasses} bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300`;
    }
  };

  if (selectedSettlement) {
    return (
      <div className="space-y-6">
        {/* Settlement Detail Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => setSelectedSettlement(null)}
                className="text-teal-100 hover:text-white mb-2 text-sm"
              >
                ← Back to Settlements
              </button>
              <h2 className="text-2xl font-bold">Settlement Details</h2>
              <p className="text-teal-100 mt-1">{selectedSettlement.settlement_id}</p>
            </div>
            <div className="flex items-center space-x-3">
              <img 
                src={marketplaceLogos[selectedSettlement.marketplace]} 
                alt={selectedSettlement.marketplace} 
                className="w-8 h-8"
              />
              <span className={getMarketplaceBadge(selectedSettlement.marketplace)}>
                {selectedSettlement.marketplace}
              </span>
            </div>
          </div>
        </div>

        {/* Settlement Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Financial Breakdown */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Financial Breakdown</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Total Amount</span>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">₹{selectedSettlement.total_amount.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <span className="text-sm font-medium text-red-700 dark:text-red-300">Commission</span>
                <span className="text-lg font-bold text-red-900 dark:text-red-100">-₹{selectedSettlement.commission.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">TDS</span>
                <span className="text-lg font-bold text-amber-900 dark:text-amber-100">-₹{selectedSettlement.tds.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border-2 border-emerald-200 dark:border-emerald-800">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Net Amount</span>
                <span className="text-xl font-bold text-emerald-900 dark:text-emerald-100">₹{selectedSettlement.net_amount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Settlement Details */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Settlement Information</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Settlement Date</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">
                  {format(new Date(selectedSettlement.settlement_date), 'PPP')}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                <div className="flex items-center space-x-2 mt-1">
                  {getStatusIcon(selectedSettlement.status)}
                  <span className={getStatusBadge(selectedSettlement.status)}>
                    {selectedSettlement.status}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Orders Count</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">{selectedSettlement.orders_count}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Returns Count</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">{selectedSettlement.returns_count}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Created</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">
                  {format(new Date(selectedSettlement.created_at), 'PPpp')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tickets & Claims */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Tickets & Claims</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{selectedSettlement.ticket_count}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Total Tickets</div>
            </div>
            
            <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">₹{selectedSettlement.claimed_amount.toLocaleString()}</div>
              <div className="text-sm text-amber-600 dark:text-amber-400">Claimed Amount</div>
            </div>
            
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span className={getResolutionBadge(selectedSettlement.resolution_status)}>
                {selectedSettlement.resolution_status.replace('_', ' ')}
              </span>
              <div className="text-sm text-blue-600 dark:text-blue-400 mt-2">Resolution Status</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Settlement Management</h2>
            <p className="text-teal-100 mt-1">Track marketplace settlements, tickets, and claim resolutions</p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Marketplace Filter */}
            <div className="flex items-center space-x-2 bg-white/20 rounded-lg p-2">
              {Object.entries(marketplaceLogos).map(([marketplace, logo]) => (
                <button
                  key={marketplace}
                  onClick={() => setMarketplaceFilter(marketplaceFilter === marketplace ? 'all' : marketplace)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                    marketplaceFilter === marketplace 
                      ? 'bg-white/30 text-white' 
                      : 'text-teal-100 hover:bg-white/20'
                  }`}
                >
                  <img src={logo} alt={marketplace} className="w-4 h-4" />
                  <span className="text-sm">{marketplace}</span>
                </button>
              ))}
            </div>
            
            <button className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Settlements</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.totalSettlements}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Net Amount</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">₹{metrics.totalAmount.toLocaleString()}</p>
            </div>
            <IndianRupee className="w-8 h-8 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Claimed</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">₹{metrics.totalClaimed.toLocaleString()}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-amber-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Pending Tickets</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.pendingTickets}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Settlements</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {filteredSettlements.length} of {settlements.length} settlements
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search settlements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
              />
            </div>
            
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processed">Processed</option>
              <option value="failed">Failed</option>
              <option value="disputed">Disputed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Settlements Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Settlement
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Marketplace
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Net Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Tickets
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Claimed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Resolution
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {filteredSettlements.map((settlement) => (
                <tr key={settlement.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{settlement.settlement_id}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{settlement.orders_count} orders, {settlement.returns_count} returns</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <img 
                        src={marketplaceLogos[settlement.marketplace]} 
                        alt={settlement.marketplace} 
                        className="w-5 h-5"
                      />
                      <span className={getMarketplaceBadge(settlement.marketplace)}>
                        {settlement.marketplace}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">₹{settlement.net_amount.toLocaleString()}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">from ₹{settlement.total_amount.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(settlement.status)}
                      <span className={getStatusBadge(settlement.status)}>
                        {settlement.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{settlement.ticket_count}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">₹{settlement.claimed_amount.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getResolutionBadge(settlement.resolution_status)}>
                      {settlement.resolution_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900 dark:text-slate-100">
                      {format(new Date(settlement.settlement_date), 'MMM dd, yyyy')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => setSelectedSettlement(settlement)}
                      className="text-teal-600 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 text-sm font-medium flex items-center space-x-1 hover:bg-teal-50 dark:hover:bg-teal-900/20 px-2 py-1 rounded transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}