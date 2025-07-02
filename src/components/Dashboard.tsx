import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { exportTableToCSV, exportTableToPDF } from '../utils/exportUtils';
import './Dashboard.css';

// Marketplace logos - using placeholder URLs for now
const MARKETPLACE_LOGOS = {
  Amazon: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
  Flipkart: 'https://logos-world.net/wp-content/uploads/2020/11/Flipkart-Logo.png',
  Myntra: 'https://logos-world.net/wp-content/uploads/2020/11/Myntra-Logo.png',
  Ajio: 'https://www.logo.wine/a/logo/Ajio/Ajio-Logo.wine.svg',
  Nykaa: 'https://logos-world.net/wp-content/uploads/2020/11/Nykaa-Logo.png'
};

const Dashboard = ({ token, searchQuery }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('settlements');
  const [settlementsSubTab, setSettlementsSubTab] = useState('returns');
  const [analyticsSubTab, setAnalyticsSubTab] = useState('overview');
  const [marketplaceFilter, setMarketplaceFilter] = useState('');
  const [charges, setCharges] = useState([]);
  const [rateCards, setRateCards] = useState([]);
  const [reconciliationData, setReconciliationData] = useState({ reconciled: [], overdue: [], discrepancy: [] });
  const [returns, setReturns] = useState([]);
  const [newRateCard, setNewRateCard] = useState({
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

  const filteredData = (data) => {
    if (!searchQuery) return data;
    return data.filter(item =>
      Object.values(item).some(val =>
        val && val.toString().toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  };

  useEffect(() => {
    setIsLoading(true);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    // Mock data for development - replace with actual API calls
    const mockData = {
      charges: [
        { id: 1, order_id: 'ORD001', marketplace: 'Amazon', charge_type: 'commission', amount: 150, description: 'Commission charge', charge_date: '2024-01-20' },
        { id: 2, order_id: 'ORD002', marketplace: 'Flipkart', charge_type: 'shipping', amount: 50, description: 'Shipping charge', charge_date: '2024-01-21' }
      ],
      rateCards: [
        { id: 1, marketplace: 'Amazon', category: 'Apparel', charge_type: 'commission', rate_type: 'percentage', rate_value: 15, effective_from: '2024-01-01' },
        { id: 2, marketplace: 'Flipkart', category: 'Electronics', charge_type: 'commission', rate_type: 'percentage', rate_value: 12, effective_from: '2024-01-01' }
      ],
      returns: [
        { id: 1, order_id: 'ORD001', marketplace: 'Amazon', return_type: 'customer', reason: 'Size issue', amount: 1299, sku: 'SKU001', status: 'processed', sla_days: 7, wms_fraudulent: false },
        { id: 2, order_id: 'ORD002', marketplace: 'Flipkart', return_type: 'fraud', reason: 'Fake product', amount: 2499, sku: 'SKU002', status: 'flagged', sla_days: 7, wms_fraudulent: true }
      ]
    };

    // Simulate API delay
    setTimeout(() => {
      setCharges(mockData.charges);
      setRateCards(mockData.rateCards);
      setReturns(mockData.returns);
      setIsLoading(false);
    }, 1000);

    // Uncomment below for actual API calls
    /*
    Promise.all([
      axios.get('http://localhost:5000/api/dashboard'),
      axios.get('http://localhost:5000/api/reconcile'),
      axios.get('http://localhost:5000/api/payments'),
      axios.get('http://localhost:5000/api/settlements'),
      axios.get('http://localhost:5000/api/integrations'),
      axios.get('http://localhost:5000/api/sku'),
      axios.get('http://localhost:5000/api/anomalies'),
      axios.get('http://localhost:5000/api/trends'),
      axios.get('http://localhost:5000/api/mappings'),
      axios.get('http://localhost:5000/api/performance'),
      axios.get('http://localhost:5000/api/audit-log'),
      axios.get('http://localhost:5000/api/alerts'),
      axios.get('http://localhost:5000/api/users'),
      axios.get('http://localhost:5000/api/forecast'),
      axios.get('http://localhost:5000/api/charges'),
      axios.get('http://localhost:5000/api/rate_cards'),
      axios.get('http://localhost:5000/api/returns')
    ])
      .then(([dashRes, reconRes, payRes, settleRes, intRes, skuRes, anomRes, trendRes, mapRes, perfRes, auditRes, alertRes, userRes, forecastRes, chargeRes, rateCardRes, returnsRes]) => {
        setCharges(chargeRes.data);
        setRateCards(rateCardRes.data);
        setReconciliationData(reconRes.data);
        setReturns(returnsRes.data);
      })
      .catch(err => setError('Failed to load data. Please try again.'))
      .finally(() => setIsLoading(false));
    */
  }, [token]);

  const handleRateCardSubmit = async (e) => {
    e.preventDefault();
    try {
      // Mock submission - replace with actual API call
      const newCard = { ...newRateCard, id: Date.now() };
      setRateCards([...rateCards, newCard]);
      
      // Uncomment for actual API call
      // await axios.post('http://localhost:5000/api/rate_cards', newRateCard);
      
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
      alert('Rate card added successfully!');
    } catch (err) {
      setError('Failed to add rate card. Please try again.');
    }
  };

  const handleRateCardChange = (e) => {
    const { name, value } = e.target;
    setNewRateCard({ ...newRateCard, [name]: value });
  };

  const renderMarketplaceLogo = (marketplace) => {
    const logoUrl = MARKETPLACE_LOGOS[marketplace];
    if (logoUrl) {
      return (
        <div className="flex items-center">
          <img src={logoUrl} alt={marketplace} className="inline h-5 w-5 mr-2 object-contain" />
          <span>{marketplace}</span>
        </div>
      );
    }
    return marketplace;
  };

  const exportData = (data, filename) => {
    try {
      exportTableToCSV(data, filename);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  return (
    <div className="dashboard max-w-7xl mx-auto p-4">
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2">Loading...</span>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="tabs flex space-x-4 mb-6">
        <button 
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'settlements' 
              ? 'bg-blue-500 text-white shadow-lg' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`} 
          onClick={() => setActiveTab('settlements')}
        >
          Settlements
        </button>
        <button 
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'analytics' 
              ? 'bg-blue-500 text-white shadow-lg' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`} 
          onClick={() => setActiveTab('analytics')}
        >
          Analytics
        </button>
      </div>

      {/* Marketplace Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Marketplace:</label>
        <select 
          value={marketplaceFilter} 
          onChange={(e) => setMarketplaceFilter(e.target.value)} 
          className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Marketplaces</option>
          {Object.keys(MARKETPLACE_LOGOS).map(marketplace => (
            <option key={marketplace} value={marketplace}>{marketplace}</option>
          ))}
          <option value="Shopify">Shopify</option>
          <option value="WooCommerce">WooCommerce</option>
          <option value="Magento">Magento</option>
        </select>
      </div>

      {/* Settlements Tab Content */}
      {activeTab === 'settlements' && (
        <div>
          {/* Sub-tabs */}
          <div className="sub-tabs flex space-x-2 mb-6 bg-gray-100 p-1 rounded-lg">
            {[
              { id: 'payments', label: 'Payments' },
              { id: 'returns', label: 'Returns' },
              { id: 'settlements', label: 'Settlements' },
              { id: 'charges', label: 'Charges' },
              { id: 'rate_cards', label: 'Rate Cards' }
            ].map(tab => (
              <button 
                key={tab.id}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  settlementsSubTab === tab.id 
                    ? 'bg-blue-500 text-white shadow' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`} 
                onClick={() => setSettlementsSubTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Returns Sub-tab */}
          {settlementsSubTab === 'returns' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Returns Management</h3>
                <div className="flex space-x-2">
                  <button 
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors" 
                    onClick={() => setSettlementsSubTab('returns_customer')}
                  >
                    Customer & RTO Returns
                  </button>
                  <button 
                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors" 
                    onClick={() => setSettlementsSubTab('returns_fraud_damage')}
                  >
                    Fraud & Damage Returns
                  </button>
                  <button 
                    className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors" 
                    onClick={() => setSettlementsSubTab('returns_not_received')}
                  >
                    Not Received Returns
                  </button>
                </div>
              </div>

              {/* Customer & RTO Returns Table */}
              {(settlementsSubTab === 'returns' || settlementsSubTab === 'returns_customer') && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-900">Customer & RTO Returns</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marketplace</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Return Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount (₹)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SLA Days</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Export</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredData(returns.filter(r => ['customer', 'RTO'].includes(r.return_type) && (!marketplaceFilter || r.marketplace === marketplaceFilter))).map((r, index) => (
                          <tr key={index} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{r.order_id}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {renderMarketplaceLogo(r.marketplace)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {r.return_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{r.reason}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">₹{r.amount?.toLocaleString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.sku}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                r.status === 'processed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.sla_days}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex space-x-2">
                                <button 
                                  className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition-colors" 
                                  onClick={() => exportData([r], 'returns_customer')}
                                >
                                  CSV
                                </button>
                                <button 
                                  className="bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600 transition-colors" 
                                  onClick={() => exportTableToPDF([r], 'returns_customer')}
                                >
                                  PDF
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Fraud & Damage Returns Table */}
              {settlementsSubTab === 'returns_fraud_damage' && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-900">Fraud & Damage Returns</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marketplace</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Return Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount (₹)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fraudulent</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Export</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredData(returns.filter(r => ['fraud', 'damage'].includes(r.return_type) && (!marketplaceFilter || r.marketplace === marketplaceFilter))).map((r, index) => (
                          <tr key={index} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{r.order_id}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {renderMarketplaceLogo(r.marketplace)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                r.return_type === 'fraud' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                              }`}>
                                {r.return_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{r.reason}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">₹{r.amount?.toLocaleString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.sku}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                r.wms_fraudulent ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                              }`}>
                                {r.wms_fraudulent ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex space-x-2">
                                <button 
                                  className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition-colors" 
                                  onClick={() => exportData([r], 'returns_fraud_damage')}
                                >
                                  CSV
                                </button>
                                <button 
                                  className="bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600 transition-colors" 
                                  onClick={() => exportTableToPDF([r], 'returns_fraud_damage')}
                                >
                                  PDF
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Rate Cards Sub-tab */}
              {settlementsSubTab === 'rate_cards' && (
                <div>
                  <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Add/Update Rate Card</h4>
                    <form onSubmit={handleRateCardSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Marketplace</label>
                        <select
                          name="marketplace"
                          value={newRateCard.marketplace}
                          onChange={handleRateCardChange}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        >
                          <option value="">Select Marketplace</option>
                          {Object.keys(MARKETPLACE_LOGOS).map(marketplace => (
                            <option key={marketplace} value={marketplace}>{marketplace}</option>
                          ))}
                          <option value="Shopify">Shopify</option>
                          <option value="WooCommerce">WooCommerce</option>
                          <option value="Magento">Magento</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <input
                          type="text"
                          name="category"
                          value={newRateCard.category}
                          onChange={handleRateCardChange}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., Apparel"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Charge Type</label>
                        <select
                          name="charge_type"
                          value={newRateCard.charge_type}
                          onChange={handleRateCardChange}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        >
                          <option value="">Select Charge Type</option>
                          <option value="commission">Commission</option>
                          <option value="shipping">Shipping</option>
                          <option value="penalty">Penalty</option>
                          <option value="advertising">Advertising</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rate Type</label>
                        <select
                          name="rate_type"
                          value={newRateCard.rate_type}
                          onChange={handleRateCardChange}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        >
                          <option value="percentage">Percentage</option>
                          <option value="fixed">Fixed</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rate Value</label>
                        <input
                          type="number"
                          name="rate_value"
                          value={newRateCard.rate_value}
                          onChange={handleRateCardChange}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                          placeholder="e.g., 10 for 10% or 100 for ₹100"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
                        <input
                          type="date"
                          name="effective_from"
                          value={newRateCard.effective_from}
                          onChange={handleRateCardChange}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                      
                      <div className="md:col-span-2">
                        <button 
                          type="submit" 
                          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors font-medium"
                        >
                          Add Rate Card
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Rate Cards Table */}
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h4 className="text-lg font-semibold text-gray-900">Current Rate Cards</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marketplace</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Charge Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate Value</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Effective From</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Export</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredData(rateCards.filter(rc => !marketplaceFilter || rc.marketplace === marketplaceFilter)).map((rc, index) => (
                            <tr key={index} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {renderMarketplaceLogo(rc.marketplace)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rc.category || 'N/A'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">{rc.charge_type}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">{rc.rate_type}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {rc.rate_type === 'percentage' ? `${rc.rate_value}%` : `₹${rc.rate_value}`}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rc.effective_from}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <div className="flex space-x-2">
                                  <button 
                                    className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition-colors" 
                                    onClick={() => exportData([rc], 'rate_cards')}
                                  >
                                    CSV
                                  </button>
                                  <button 
                                    className="bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600 transition-colors" 
                                    onClick={() => exportTableToPDF([rc], 'rate_cards')}
                                  >
                                    PDF
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
              )}
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab Content */}
      {activeTab === 'analytics' && (
        <div>
          <div className="sub-tabs flex space-x-2 mb-6 bg-gray-100 p-1 rounded-lg">
            <button 
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                analyticsSubTab === 'overview' 
                  ? 'bg-blue-500 text-white shadow' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`} 
              onClick={() => setAnalyticsSubTab('overview')}
            >
              Overview
            </button>
          </div>
          
          {analyticsSubTab === 'overview' && (
            <div>
              {/* Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Charges</h3>
                  <p className="text-2xl font-bold text-blue-600">
                    ₹{charges.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Returns</h3>
                  <p className="text-2xl font-bold text-red-600">
                    ₹{returns.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Active Rate Cards</h3>
                  <p className="text-2xl font-bold text-green-600">{rateCards.length}</p>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Charges by Type</h3>
                  <div className="h-64">
                    <Bar
                      data={{
                        labels: [...new Set(charges.map(c => c.charge_type))],
                        datasets: [{
                          label: 'Charge Amount (₹)',
                          data: [...new Set(charges.map(c => c.charge_type))].map(type =>
                            charges.filter(c => c.charge_type === type).reduce((sum, c) => sum + c.amount, 0)
                          ),
                          backgroundColor: '#3B82F6',
                          borderColor: '#1D4ED8',
                          borderWidth: 1
                        }]
                      }}
                      options={{ 
                        responsive: true, 
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Returns by Type</h3>
                  <div className="h-64">
                    <Bar
                      data={{
                        labels: ['Customer', 'RTO', 'Fraud', 'Damage', 'Not Received'],
                        datasets: [{
                          label: 'Return Amount (₹)',
                          data: [
                            returns.filter(r => r.return_type === 'customer').reduce((sum, r) => sum + r.amount, 0),
                            returns.filter(r => r.return_type === 'RTO').reduce((sum, r) => sum + r.amount, 0),
                            returns.filter(r => r.return_type === 'fraud').reduce((sum, r) => sum + r.amount, 0),
                            returns.filter(r => r.return_type === 'damage').reduce((sum, r) => sum + r.amount, 0),
                            returns.filter(r => r.return_type === 'not_received').reduce((sum, r) => sum + r.amount, 0)
                          ],
                          backgroundColor: ['#10B981', '#F59E0B', '#EF4444', '#F97316', '#8B5CF6'],
                          borderWidth: 1
                        }]
                      }}
                      options={{ 
                        responsive: true, 
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;