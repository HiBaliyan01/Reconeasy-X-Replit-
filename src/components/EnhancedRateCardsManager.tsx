import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, Plus, Edit3, Trash2, Search, Filter, Download, 
  Calendar, TrendingUp, AlertTriangle, CheckCircle, Upload, Save, X
} from 'lucide-react';
import { format } from 'date-fns';
import { fetchRateCards, addRateCard, deleteRateCard, updateRateCard, RateCard } from '../utils/supabase';
import * as XLSX from 'xlsx';

interface EnhancedRateCardsManagerProps {
  onRateCardChange?: () => void;
}

export default function EnhancedRateCardsManager({ onRateCardChange }: EnhancedRateCardsManagerProps) {
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCard, setEditingCard] = useState<RateCard | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [newRateCard, setNewRateCard] = useState({
    platform: '',
    category: '',
    commission_rate: '',
    shipping_fee: '',
    gst_rate: ''
  });

  // Load rate cards
  useEffect(() => {
    loadRateCards();
  }, []);

  const loadRateCards = async () => {
    setIsLoading(true);
    try {
      const data = await fetchRateCards();
      setRateCards(data);
    } catch (error) {
      console.error('Error loading rate cards:', error);
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
      if (platformFilter !== 'all' && card.platform !== platformFilter) return false;
      if (categoryFilter !== 'all' && card.category !== categoryFilter) return false;
      return true;
    });
  }, [rateCards, searchTerm, platformFilter, categoryFilter]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalCards = filteredRateCards.length;
    const uniquePlatforms = new Set(filteredRateCards.map(c => c.platform)).size;
    const uniqueCategories = new Set(filteredRateCards.map(c => c.category)).size;
    const avgCommission = filteredRateCards.reduce((sum, c) => sum + (c.commission_rate || 0), 0) / 
                         (filteredRateCards.length || 1);
    
    return { totalCards, uniquePlatforms, uniqueCategories, avgCommission };
  }, [filteredRateCards]);

  // Unique platforms and categories for filters
  const platforms = useMemo(() => {
    return Array.from(new Set(rateCards.map(c => c.platform)));
  }, [rateCards]);

  const categories = useMemo(() => {
    return Array.from(new Set(rateCards.map(c => c.category)));
  }, [rateCards]);

  const handleCreateRateCard = async () => {
    try {
      await addRateCard({
        platform: newRateCard.platform,
        category: newRateCard.category,
        commission_rate: parseFloat(newRateCard.commission_rate) || 0,
        shipping_fee: parseFloat(newRateCard.shipping_fee) || 0,
        gst_rate: parseFloat(newRateCard.gst_rate) || 0
      });
      
      setNewRateCard({
        platform: '',
        category: '',
        commission_rate: '',
        shipping_fee: '',
        gst_rate: ''
      });
      
      setShowCreateForm(false);
      await loadRateCards();
      if (onRateCardChange) onRateCardChange();
    } catch (error) {
      console.error('Error creating rate card:', error);
    }
  };

  const handleUpdateRateCard = async () => {
    if (!editingCard) return;
    
    try {
      await updateRateCard(editingCard.id, {
        platform: editingCard.platform,
        category: editingCard.category,
        commission_rate: editingCard.commission_rate,
        shipping_fee: editingCard.shipping_fee,
        gst_rate: editingCard.gst_rate
      });
      
      setEditingCard(null);
      await loadRateCards();
      if (onRateCardChange) onRateCardChange();
    } catch (error) {
      console.error('Error updating rate card:', error);
    }
  };

  const handleDeleteRateCard = async (cardId: string) => {
    if (confirm('Are you sure you want to delete this rate card?')) {
      try {
        await deleteRateCard(cardId);
        await loadRateCards();
        if (onRateCardChange) onRateCardChange();
      } catch (error) {
        console.error('Error deleting rate card:', error);
      }
    }
  };

  const exportToCSV = () => {
    const csvData = filteredRateCards.map(card => ({
      Platform: card.platform,
      Category: card.category,
      'Commission Rate (%)': card.commission_rate,
      'Shipping Fee (₹)': card.shipping_fee,
      'GST Rate (%)': card.gst_rate,
      'Created At': format(new Date(card.created_at), 'yyyy-MM-dd HH:mm:ss')
    }));

    const worksheet = XLSX.utils.json_to_sheet(csvData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rate Cards');
    XLSX.writeFile(workbook, `rate_cards_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const importFromCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // Transform data to match our schema
        const rateCardsToImport = jsonData.map((row: any) => ({
          platform: row.Platform || row.platform,
          category: row.Category || row.category,
          commission_rate: parseFloat(row['Commission Rate (%)'] || row.commission_rate || 0),
          shipping_fee: parseFloat(row['Shipping Fee (₹)'] || row.shipping_fee || 0),
          gst_rate: parseFloat(row['GST Rate (%)'] || row.gst_rate || 0)
        }));
        
        // Batch insert
        for (const card of rateCardsToImport) {
          await addRateCard(card);
        }
        
        await loadRateCards();
        if (onRateCardChange) onRateCardChange();
        alert(`Successfully imported ${rateCardsToImport.length} rate cards`);
      } catch (error) {
        console.error('Error importing rate cards:', error);
        alert('Error importing rate cards. Please check the file format.');
      }
    };
    reader.readAsArrayBuffer(file);
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
              <p className="text-teal-100 mt-1">Add marketplace rate card details</p>
            </div>
          </div>
        </div>

        {/* Create Rate Card Form */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Platform</label>
              <select
                value={newRateCard.platform}
                onChange={(e) => setNewRateCard({ ...newRateCard, platform: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                required
              >
                <option value="">Select Platform</option>
                <option value="Amazon">Amazon</option>
                <option value="Flipkart">Flipkart</option>
                <option value="Myntra">Myntra</option>
                <option value="Ajio">Ajio</option>
                <option value="Nykaa">Nykaa</option>
                <option value="Meesho">Meesho</option>
                <option value="Shopify">Shopify</option>
                <option value="WooCommerce">WooCommerce</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Category</label>
              <select
                value={newRateCard.category}
                onChange={(e) => setNewRateCard({ ...newRateCard, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                required
              >
                <option value="">Select Category</option>
                <option value="Apparel">Apparel</option>
                <option value="Electronics">Electronics</option>
                <option value="Home & Kitchen">Home & Kitchen</option>
                <option value="Beauty">Beauty</option>
                <option value="Toys">Toys</option>
                <option value="Books">Books</option>
                <option value="Grocery">Grocery</option>
                <option value="Furniture">Furniture</option>
                <option value="Footwear">Footwear</option>
                <option value="Accessories">Accessories</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Commission Rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={newRateCard.commission_rate}
                onChange={(e) => setNewRateCard({ ...newRateCard, commission_rate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="e.g., 15.0"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Shipping Fee (₹)</label>
              <input
                type="number"
                step="0.01"
                value={newRateCard.shipping_fee}
                onChange={(e) => setNewRateCard({ ...newRateCard, shipping_fee: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="e.g., 50.0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">GST Rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={newRateCard.gst_rate}
                onChange={(e) => setNewRateCard({ ...newRateCard, gst_rate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="e.g., 18.0"
              />
            </div>
          </div>

          <div className="mt-6 flex space-x-3">
            <button
              onClick={handleCreateRateCard}
              disabled={!newRateCard.platform || !newRateCard.category || !newRateCard.commission_rate}
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

  if (editingCard) {
    return (
      <div className="space-y-6">
        {/* Edit Rate Card Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => setEditingCard(null)}
                className="text-teal-100 hover:text-white mb-2 text-sm"
              >
                ← Back to Rate Cards
              </button>
              <h2 className="text-2xl font-bold">Edit Rate Card</h2>
              <p className="text-teal-100 mt-1">Update marketplace rate card details</p>
            </div>
          </div>
        </div>

        {/* Edit Rate Card Form */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Platform</label>
              <select
                value={editingCard.platform}
                onChange={(e) => setEditingCard({ ...editingCard, platform: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                required
              >
                <option value="">Select Platform</option>
                <option value="Amazon">Amazon</option>
                <option value="Flipkart">Flipkart</option>
                <option value="Myntra">Myntra</option>
                <option value="Ajio">Ajio</option>
                <option value="Nykaa">Nykaa</option>
                <option value="Meesho">Meesho</option>
                <option value="Shopify">Shopify</option>
                <option value="WooCommerce">WooCommerce</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Category</label>
              <select
                value={editingCard.category}
                onChange={(e) => setEditingCard({ ...editingCard, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                required
              >
                <option value="">Select Category</option>
                <option value="Apparel">Apparel</option>
                <option value="Electronics">Electronics</option>
                <option value="Home & Kitchen">Home & Kitchen</option>
                <option value="Beauty">Beauty</option>
                <option value="Toys">Toys</option>
                <option value="Books">Books</option>
                <option value="Grocery">Grocery</option>
                <option value="Furniture">Furniture</option>
                <option value="Footwear">Footwear</option>
                <option value="Accessories">Accessories</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Commission Rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={editingCard.commission_rate}
                onChange={(e) => setEditingCard({ ...editingCard, commission_rate: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="e.g., 15.0"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Shipping Fee (₹)</label>
              <input
                type="number"
                step="0.01"
                value={editingCard.shipping_fee}
                onChange={(e) => setEditingCard({ ...editingCard, shipping_fee: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="e.g., 50.0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">GST Rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={editingCard.gst_rate}
                onChange={(e) => setEditingCard({ ...editingCard, gst_rate: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="e.g., 18.0"
              />
            </div>
          </div>

          <div className="mt-6 flex space-x-3">
            <button
              onClick={handleUpdateRateCard}
              disabled={!editingCard.platform || !editingCard.category}
              className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Update Rate Card
            </button>
            <button
              onClick={() => setEditingCard(null)}
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
              <span>Export</span>
            </button>
            <label className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Import</span>
              <input 
                type="file" 
                accept=".csv,.xlsx,.xls" 
                className="hidden" 
                onChange={importFromCSV}
              />
            </label>
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
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Platforms</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.uniquePlatforms}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Categories</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.uniqueCategories}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Avg Commission</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.avgCommission.toFixed(1)}%</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-amber-500" />
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
            
            {/* Platform Filter */}
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Platforms</option>
              {platforms.map(platform => (
                <option key={platform} value={platform}>{platform}</option>
              ))}
            </select>
            
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Rate Cards Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-2 text-slate-600 dark:text-slate-400">Loading rate cards...</p>
          </div>
        ) : filteredRateCards.length === 0 ? (
          <div className="p-8 text-center">
            <CreditCard className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No Rate Cards Found</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              {searchTerm || platformFilter !== 'all' || categoryFilter !== 'all'
                ? 'No rate cards match your current filters.'
                : 'Get started by adding your first rate card.'}
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
            >
              Add Rate Card
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Commission Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Shipping Fee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    GST Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Created
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
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{card.commission_rate}%</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-slate-100">₹{card.shipping_fee}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-slate-100">{card.gst_rate}%</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-slate-100">
                        {format(new Date(card.created_at), 'MMM dd, yyyy')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setEditingCard(card)}
                          className="text-teal-600 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 text-sm font-medium flex items-center space-x-1 hover:bg-teal-50 dark:hover:bg-teal-900/20 px-2 py-1 rounded transition-colors"
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

      {/* Rate Card Preview */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Rate Card Calculator</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          See how rate cards affect your settlement calculations. Enter a product price to see the breakdown.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Product Price (MRP)</label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              placeholder="e.g., 1000"
              defaultValue="1000"
              id="calc-mrp"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Platform</label>
            <select
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              id="calc-platform"
            >
              {platforms.map(platform => (
                <option key={platform} value={platform}>{platform}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Category</label>
            <select
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              id="calc-category"
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
        
        <button
          className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors mb-6"
          onClick={() => {
            const mrp = parseFloat((document.getElementById('calc-mrp') as HTMLInputElement).value);
            const platform = (document.getElementById('calc-platform') as HTMLSelectElement).value;
            const category = (document.getElementById('calc-category') as HTMLSelectElement).value;
            
            const card = rateCards.find(c => 
              c.platform === platform && c.category === category
            );
            
            if (!card) {
              alert('No rate card found for this platform and category combination.');
              return;
            }
            
            const commission = (card.commission_rate / 100) * mrp;
            const shipping = card.shipping_fee || 0;
            const gst = ((commission + shipping) * (card.gst_rate || 0)) / 100;
            const expected = mrp - (commission + shipping + gst);
            
            document.getElementById('calc-commission')!.textContent = `₹${commission.toFixed(2)}`;
            document.getElementById('calc-shipping')!.textContent = `₹${shipping.toFixed(2)}`;
            document.getElementById('calc-gst')!.textContent = `₹${gst.toFixed(2)}`;
            document.getElementById('calc-expected')!.textContent = `₹${expected.toFixed(2)}`;
            
            document.getElementById('calc-result')!.classList.remove('hidden');
          }}
        >
          Calculate
        </button>
        
        <div id="calc-result" className="hidden space-y-3 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Commission:</div>
            <div id="calc-commission" className="text-sm text-red-600 dark:text-red-400">₹0.00</div>
            
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Shipping Fee:</div>
            <div id="calc-shipping" className="text-sm text-red-600 dark:text-red-400">₹0.00</div>
            
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">GST:</div>
            <div id="calc-gst" className="text-sm text-red-600 dark:text-red-400">₹0.00</div>
            
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300 border-t border-slate-200 dark:border-slate-600 pt-2">Expected Payment:</div>
            <div id="calc-expected" className="text-sm font-bold text-emerald-600 dark:text-emerald-400 border-t border-slate-200 dark:border-slate-600 pt-2">₹0.00</div>
          </div>
        </div>
      </div>
    </div>
  );
}