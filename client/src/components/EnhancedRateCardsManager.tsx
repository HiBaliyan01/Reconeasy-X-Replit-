import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Download, Edit3, Trash2, Search, Filter, 
  CheckCircle, AlertTriangle, Clock, TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { RateCardHeader, RateCardForm, RateCalculator } from './RateCardComponents';
import { fetchRateCards, addRateCard, updateRateCard, deleteRateCard, RateCard } from '../utils/supabase';
import RateCardUploader from './RateCardUploader';

export default function EnhancedRateCardsManager() {
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [marketplaceFilter, setMarketplaceFilter] = useState("all");
  const [editingCard, setEditingCard] = useState<RateCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newRateCard, setNewRateCard] = useState<Partial<RateCard>>({
    platform: "",
    category: "",
    commission_rate: 0,
    shipping_fee: 0, 
    gst_rate: 18, // Default GST rate
    rto_fee: 0,
    packaging_fee: 0,
    fixed_fee: 0,
    min_price: 0,
    max_price: 0,
    effective_from: new Date().toISOString().split("T")[0],
    effective_to: ""
  });

  // Load rate cards on component mount
  useEffect(() => {
    loadRateCards();
  }, []);

  const loadRateCards = async () => {
    setIsLoading(true);
    try {
      const data = await fetchRateCards();
      setRateCards(data);
    } catch (error) {
      console.error("Error loading rate cards:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter rate cards
  const filteredRateCards = useMemo(() => {
    return rateCards.filter(card => {
      if (searchTerm && !card.platform.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !card.category.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (marketplaceFilter !== "all" && card.platform !== marketplaceFilter) return false;
      return true;
    });
  }, [rateCards, searchTerm, marketplaceFilter]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalCards = filteredRateCards.length;
    const activeCards = filteredRateCards.filter(c => !c.effective_to || new Date(c.effective_to) > new Date()).length;
    const expiredCards = filteredRateCards.filter(c => c.effective_to && new Date(c.effective_to) <= new Date()).length;
    const avgRate = filteredRateCards.reduce((sum, c) => sum + c.commission_rate, 0) / 
                   (filteredRateCards.length || 1);
    
    return { totalCards, activeCards, expiredCards, avgRate };
  }, [filteredRateCards]);

  const handleCreateRateCard = async () => {
    try {
      await addRateCard(newRateCard as Omit<RateCard, "id" | "created_at">);
      await loadRateCards();
      setShowCreateForm(false);
      setNewRateCard({
        platform: "",
        category: "",
        commission_rate: 0,
        shipping_fee: 0,
        gst_rate: 0,
        effective_from: new Date().toISOString().split("T")[0]
      });
    } catch (error) {
      console.error("Error creating rate card:", error);
    }
  };

  const handleUpdateRateCard = async () => {
    if (!editingCard) return;
    
    try {
      await updateRateCard(editingCard.id, editingCard);
      await loadRateCards();
      setEditingCard(null);
    } catch (error) {
      console.error("Error updating rate card:", error);
    }
  };

  const handleDeleteRateCard = async (cardId: string) => {
    if (confirm("Are you sure you want to delete this rate card?")) {
      try {
        await deleteRateCard(cardId);
        await loadRateCards();
      } catch (error) {
        console.error("Error deleting rate card:", error);
      }
    }
  };

  const exportToCSV = () => {
    const csvData = filteredRateCards.map(card => ({
      Platform: card.platform,
      Category: card.category,
      "Commission Rate": `${card.commission_rate}%`,
      "Shipping Fee": `₹${card.shipping_fee || 0}`,
      "GST Rate": `${card.gst_rate || 0}%`,
      "RTO Fee": card.rto_fee ? `₹${card.rto_fee}` : "N/A",
      "Packaging Fee": card.packaging_fee ? `₹${card.packaging_fee}` : "N/A",
      "Fixed Fee": card.fixed_fee ? `₹${card.fixed_fee}` : "N/A",
      "Min Price": card.min_price ? `₹${card.min_price}` : "N/A",
      "Max Price": card.max_price ? `₹${card.max_price}` : "N/A",
      "Effective From": card.effective_from || "N/A",
      "Effective To": card.effective_to || "Current"
    }));

    const csv = [
      Object.keys(csvData[0]).join(","),
      ...csvData.map(row => Object.values(row).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rate_cards_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadge = (card: RateCard) => {
    const now = new Date();
    const effectiveFrom = new Date(card.effective_from || "");
    const effectiveTo = card.effective_to ? new Date(card.effective_to) : null;

    if (effectiveFrom > now) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">Future</span>;
    } else if (effectiveTo && effectiveTo <= now) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">Expired</span>;
    } else {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">Active</span>;
    }
  };

  // Render create/edit form
  if (showCreateForm) {
    return (
      <div className="space-y-6">
        <RateCardHeader 
          onBack={() => setShowCreateForm(false)}
          onExport={exportToCSV}
        />
        <RateCardForm
          card={newRateCard}
          onChange={setNewRateCard}
          onSubmit={handleCreateRateCard}
          onCancel={() => setShowCreateForm(false)}
        />
      </div>
    );
  }

  // Render edit form
  if (editingCard) {
    return (
      <div className="space-y-6">
        <RateCardHeader 
          onBack={() => setEditingCard(null)}
          onExport={exportToCSV}
        />
        <RateCardForm
          card={editingCard}
          onChange={setEditingCard}
          onSubmit={handleUpdateRateCard}
          onCancel={() => setEditingCard(null)}
        />
      </div>
    );
  }

  // Render main view
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
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Rate Cards</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.totalCards}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Active Cards</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.activeCards}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Expired Cards</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.expiredCards}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center shadow-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Avg Commission</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.avgRate.toFixed(1)}%</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
              <Clock className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Rate Calculator */}
      <RateCalculator rateCards={rateCards} />

      {/* Rate Card Uploader */}
      <RateCardUploader onUploadSuccess={loadRateCards} />

      {/* Search and Filter Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-4">
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
              {[...new Set(rateCards.map(card => card.platform))].map(platform => (
                <option key={platform} value={platform}>{platform}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Rate Cards Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">Loading rate cards...</p>
          </div>
        ) : filteredRateCards.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">No rate cards found.</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Create Your First Rate Card
            </button>
          </div>
        ) : (
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
                    Commission
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Shipping
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    GST
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Price Range
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
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{card.platform}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-slate-100">{card.category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {card.commission_rate}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-slate-100">
                        {card.shipping_fee ? `₹${card.shipping_fee}` : "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-slate-100">
                        {card.gst_rate ? `${card.gst_rate}%` : "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-slate-100">
                        {card.min_price || card.max_price ? (
                          `₹${card.min_price || 0} - ₹${card.max_price || '∞'}`
                        ) : (
                          "No limit"
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(card)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setEditingCard(card)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 text-sm font-medium flex items-center space-x-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
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
        )}
      </div>
    </div>
  );
}