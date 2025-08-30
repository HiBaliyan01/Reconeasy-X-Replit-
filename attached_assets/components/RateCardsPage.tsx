import React, { useState, useMemo } from 'react';
import { 
  CreditCard, Plus, Edit3, Trash2, Search, Filter, Download, 
  Calendar, TrendingUp, AlertTriangle, CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface RateCard {
  id: string;
  marketplace: string;
  category: string;
  charge_type: string;
  rate_type: 'percentage' | 'fixed';
  rate_value: number;
  min_amount?: number;
  max_amount?: number;
  effective_from: string;
  effective_to?: string;
  created_at: string;
}

const mockRateCards: RateCard[] = [
  {
    id: 'RC001',
    marketplace: 'Amazon',
    category: 'Apparel',
    charge_type: 'commission',
    rate_type: 'percentage',
    rate_value: 15,
    min_amount: 100,
    max_amount: 10000,
    effective_from: '2024-01-01',
    effective_to: '2024-06-30',
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'RC002',
    marketplace: 'Amazon',
    category: 'Apparel',
    charge_type: 'commission',
    rate_type: 'percentage',
    rate_value: 18,
    min_amount: 100,
    max_amount: 10000,
    effective_from: '2024-07-01',
    created_at: '2024-06-15T00:00:00Z'
  },
  {
    id: 'RC003',
    marketplace: 'Flipkart',
    category: 'Electronics',
    charge_type: 'shipping',
    rate_type: 'fixed',
    rate_value: 50,
    effective_from: '2024-01-01',
    created_at: '2024-01-01T00:00:00Z'
  }
];

export default function RateCardsPage() {
  const [rateCards, setRateCards] = useState<RateCard[]>(mockRateCards);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [marketplaceFilter, setMarketplaceFilter] = useState('all');
  const [chargeTypeFilter, setChargeTypeFilter] = useState('all');
  const [newRateCard, setNewRateCard] = useState({
    marketplace: '',
    category: '',
    charge_type: '',
    rate_type: 'percentage' as 'percentage' | 'fixed',
    rate_value: '',
    min_amount: '',
    max_amount: '',
    effective_from: '',
    effective_to: ''
  });

  // Filter rate cards
  const filteredRateCards = useMemo(() => {
    return rateCards.filter(card => {
      if (searchTerm && !card.marketplace.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !card.category.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !card.charge_type.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (marketplaceFilter !== 'all' && card.marketplace !== marketplaceFilter) return false;
      if (chargeTypeFilter !== 'all' && card.charge_type !== chargeTypeFilter) return false;
      return true;
    });
  }, [rateCards, searchTerm, marketplaceFilter, chargeTypeFilter]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalCards = filteredRateCards.length;
    const activeCards = filteredRateCards.filter(c => !c.effective_to || new Date(c.effective_to) > new Date()).length;
    const expiredCards = filteredRateCards.filter(c => c.effective_to && new Date(c.effective_to) <= new Date()).length;
    const avgRate = filteredRateCards.filter(c => c.rate_type === 'percentage').reduce((sum, c) => sum + c.rate_value, 0) / 
                   filteredRateCards.filter(c => c.rate_type === 'percentage').length || 0;
    
    return { totalCards, activeCards, expiredCards, avgRate };
  }, [filteredRateCards]);

  const handleCreateRateCard = () => {
    const rateCard: RateCard = {
      id: `RC${String(rateCards.length + 1).padStart(3, '0')}`,
      marketplace: newRateCard.marketplace,
      category: newRateCard.category,
      charge_type: newRateCard.charge_type,
      rate_type: newRateCard.rate_type,
      rate_value: parseFloat(newRateCard.rate_value),
      min_amount: newRateCard.min_amount ? parseFloat(newRateCard.min_amount) : undefined,
      max_amount: newRateCard.max_amount ? parseFloat(newRateCard.max_amount) : undefined,
      effective_from: newRateCard.effective_from,
      effective_to: newRateCard.effective_to || undefined,
      created_at: new Date().toISOString()
    };

    // Update effective_to for previous rate card if applicable
    const existingCards = rateCards.filter(c => 
      c.marketplace === newRateCard.marketplace && 
      c.category === newRateCard.category && 
      c.charge_type === newRateCard.charge_type &&
      !c.effective_to
    );

    if (existingCards.length > 0) {
      setRateCards(prev => prev.map(c => 
        existingCards.includes(c) 
          ? { ...c, effective_to: newRateCard.effective_from }
          : c
      ));
    }

    setRateCards(prev => [...prev, rateCard]);
    setNewRateCard({
      marketplace: '',
      category: '',
      charge_type: '',
      rate_type: 'percentage',
      rate_value: '',
      min_amount: '',
      max_amount: '',
      effective_from: '',
      effective_to: ''
    });
    setShowCreateForm(false);
  };

  const handleDeleteRateCard = (cardId: string) => {
    if (confirm('Are you sure you want to delete this rate card?')) {
      setRateCards(prev => prev.filter(c => c.id !== cardId));
    }
  };

  const exportToCSV = () => {
    const csvData = filteredRateCards.map(card => ({
      Marketplace: card.marketplace,
      Category: card.category,
      'Charge Type': card.charge_type,
      'Rate Type': card.rate_type,
      'Rate Value': card.rate_type === 'percentage' ? `${card.rate_value}%` : `₹${card.rate_value}`,
      'Min Amount': card.min_amount ? `₹${card.min_amount}` : 'N/A',
      'Max Amount': card.max_amount ? `₹${card.max_amount}` : 'N/A',
      'Effective From': card.effective_from,
      'Effective To': card.effective_to || 'Current'
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rate_cards_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadge = (card: RateCard) => {
    const now = new Date();
    const effectiveFrom = new Date(card.effective_from);
    const effectiveTo = card.effective_to ? new Date(card.effective_to) : null;

    if (effectiveFrom > now) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">Future</span>;
    } else if (effectiveTo && effectiveTo <= now) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">Expired</span>;
    } else {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">Active</span>;
    }
  };

  if (showCreateForm) {
    return (
      <div className="space-y-6">
        {/* Create Rate Card Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-teal-100 hover:text-white mb-2 text-sm"
              >
                ← Back to Rate Cards
              </button>
              <h2 className="text-2xl font-bold">Create Rate Card</h2>
              <p className="text-teal-100 mt-1">Add or update marketplace rate card details</p>
            </div>
          </div>
        </div>

        {/* Create Rate Card Form */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Marketplace</label>
              <select
                value={newRateCard.marketplace}
                onChange={(e) => setNewRateCard({ ...newRateCard, marketplace: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                required
              >
                <option value="">Select Marketplace</option>
                <option value="Amazon">Amazon</option>
                <option value="Flipkart">Flipkart</option>
                <option value="Myntra">Myntra</option>
                <option value="Ajio">Ajio</option>
                <option value="Nykaa">Nykaa</option>
                <option value="Shopify">Shopify</option>
                <option value="WooCommerce">WooCommerce</option>
                <option value="Magento">Magento</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Category</label>
              <input
                type="text"
                value={newRateCard.category}
                onChange={(e) => setNewRateCard({ ...newRateCard, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="e.g., Apparel, Electronics"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Charge Type</label>
              <select
                value={newRateCard.charge_type}
                onChange={(e) => setNewRateCard({ ...newRateCard, charge_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                required
              >
                <option value="">Select Charge Type</option>
                <option value="commission">Commission</option>
                <option value="shipping">Shipping</option>
                <option value="penalty">Penalty</option>
                <option value="advertising">Advertising</option>
                <option value="payment_gateway">Payment Gateway</option>
                <option value="storage">Storage</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Rate Type</label>
              <select
                value={newRateCard.rate_type}
                onChange={(e) => setNewRateCard({ ...newRateCard, rate_type: e.target.value as 'percentage' | 'fixed' })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                required
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Rate Value {newRateCard.rate_type === 'percentage' ? '(%)' : '(₹)'}
              </label>
              <input
                type="number"
                step="0.01"
                value={newRateCard.rate_value}
                onChange={(e) => setNewRateCard({ ...newRateCard, rate_value: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder={newRateCard.rate_type === 'percentage' ? 'e.g., 15 for 15%' : 'e.g., 100 for ₹100'}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Min Amount (₹)</label>
              <input
                type="number"
                value={newRateCard.min_amount}
                onChange={(e) => setNewRateCard({ ...newRateCard, min_amount: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="Optional minimum amount"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Max Amount (₹)</label>
              <input
                type="number"
                value={newRateCard.max_amount}
                onChange={(e) => setNewRateCard({ ...newRateCard, max_amount: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="Optional maximum amount"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Effective From</label>
              <input
                type="date"
                value={newRateCard.effective_from}
                onChange={(e) => setNewRateCard({ ...newRateCard, effective_from: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Effective To (Optional)</label>
              <input
                type="date"
                value={newRateCard.effective_to}
                onChange={(e) => setNewRateCard({ ...newRateCard, effective_to: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="Leave empty for current rate"
              />
            </div>
          </div>

          <div className="mt-6 flex space-x-3">
            <button
              onClick={handleCreateRateCard}
              disabled={!newRateCard.marketplace || !newRateCard.category || !newRateCard.charge_type || !newRateCard.rate_value || !newRateCard.effective_from}
              className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Rate Card
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-6 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
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
            <h2 className="text-2xl font-bold">Marketplace Rate Cards</h2>
            <p className="text-teal-100 mt-1">Manage commission rates, shipping charges, and marketplace fees</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Rate Card</span>
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Rate Cards</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.totalCards}</p>
            </div>
            <CreditCard className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Active Cards</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.activeCards}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Expired Cards</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.expiredCards}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Avg Commission</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.avgRate.toFixed(1)}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Rate Cards</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {filteredRateCards.length} of {rateCards.length} rate cards
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search rate cards..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
              />
            </div>
            
            {/* Marketplace Filter */}
            <select
              value={marketplaceFilter}
              onChange={(e) => setMarketplaceFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Marketplaces</option>
              <option value="Amazon">Amazon</option>
              <option value="Flipkart">Flipkart</option>
              <option value="Myntra">Myntra</option>
              <option value="Ajio">Ajio</option>
              <option value="Nykaa">Nykaa</option>
            </select>
            
            {/* Charge Type Filter */}
            <select
              value={chargeTypeFilter}
              onChange={(e) => setChargeTypeFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Charge Types</option>
              <option value="commission">Commission</option>
              <option value="shipping">Shipping</option>
              <option value="penalty">Penalty</option>
              <option value="advertising">Advertising</option>
            </select>
          </div>
        </div>
      </div>

      {/* Rate Cards Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Marketplace
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Charge Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Amount Range
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Effective Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {filteredRateCards.map((card) => (
                <tr key={card.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{card.marketplace}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900 dark:text-slate-100">{card.category}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900 dark:text-slate-100 capitalize">{card.charge_type.replace('_', ' ')}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {card.rate_type === 'percentage' ? `${card.rate_value}%` : `₹${card.rate_value}`}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900 dark:text-slate-100">
                      {card.min_amount || card.max_amount ? (
                        `₹${card.min_amount || 0} - ₹${card.max_amount || '∞'}`
                      ) : (
                        'No limit'
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900 dark:text-slate-100">
                      <div>{format(new Date(card.effective_from), 'MMM dd, yyyy')}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        to {card.effective_to ? format(new Date(card.effective_to), 'MMM dd, yyyy') : 'Current'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(card)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleDeleteRateCard(card.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 text-sm font-medium flex items-center space-x-1 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
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