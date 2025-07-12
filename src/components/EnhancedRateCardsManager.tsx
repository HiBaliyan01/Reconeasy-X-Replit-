import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, Plus, Edit3, Trash2, Search, Download, Upload,
  TrendingUp, CheckCircle, AlertTriangle, Calculator, Info,
  ArrowLeft, Save, X, HelpCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { fetchRateCards, addRateCard, deleteRateCard, updateRateCard, RateCard } from '../utils/supabase';

interface RateCardFormProps {
  mode: 'create' | 'edit';
  rateCard: Partial<RateCard>;
  onChange: (field: string, value: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
  platforms: string[];
  categories: string[];
}

const RateCardForm: React.FC<RateCardFormProps> = ({ 
  mode, 
  rateCard, 
  onChange, 
  onSubmit, 
  onCancel,
  platforms,
  categories
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let processedValue = value;
    
    // Convert numeric inputs to numbers
    if (type === 'number') {
      processedValue = value === '' ? '' : parseFloat(value);
    }
    
    onChange(name, processedValue);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="text-teal-100 hover:text-white text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              ← Back to Rate Cards
            </button>
            <span className="text-lg font-bold">{mode === 'create' ? 'Add Rate Card' : 'Edit Rate Card'}</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-3">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Basic Information</h3>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Platform <span className="text-red-500">*</span>
            </label>
            <select
              name="platform"
              value={rateCard.platform || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              required
            >
              <option value="">Select Platform</option>
              {platforms.map(platform => (
                <option key={platform} value={platform}>{platform}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              name="category"
              value={rateCard.category || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              required
            >
              <option value="">Select Category</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
              <option value="new">+ Add New Category</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Commission Rate (%) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                name="commission_rate"
                value={rateCard.commission_rate || ''}
                onChange={handleChange}
                step="0.01"
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                required
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <span className="text-slate-500 dark:text-slate-400">%</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-3">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Fee Structure</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Shipping Fee (₹)
              <span className="ml-1 text-slate-500 dark:text-slate-400 text-xs">
                <HelpCircle className="w-3 h-3 inline" /> Default logistics charge
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                name="shipping_fee"
                value={rateCard.shipping_fee || ''}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <span className="text-slate-500 dark:text-slate-400">₹</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              GST Rate (%)
              <span className="ml-1 text-slate-500 dark:text-slate-400 text-xs">
                <HelpCircle className="w-3 h-3 inline" /> Applied on fees
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                name="gst_rate"
                value={rateCard.gst_rate || ''}
                onChange={handleChange}
                step="0.01"
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <span className="text-slate-500 dark:text-slate-400">%</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              RTO Fee (₹)
              <span className="ml-1 text-slate-500 dark:text-slate-400 text-xs">
                <HelpCircle className="w-3 h-3 inline" /> Return to origin charge
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                name="rto_fee"
                value={rateCard.rto_fee || ''}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <span className="text-slate-500 dark:text-slate-400">₹</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Packaging Fee (₹)
              <span className="ml-1 text-slate-500 dark:text-slate-400 text-xs">
                <HelpCircle className="w-3 h-3 inline" /> Environmental fees
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                name="packaging_fee"
                value={rateCard.packaging_fee || ''}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <span className="text-slate-500 dark:text-slate-400">₹</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Fixed Fee (₹)
              <span className="ml-1 text-slate-500 dark:text-slate-400 text-xs">
                <HelpCircle className="w-3 h-3 inline" /> Platform fixed charge
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                name="fixed_fee"
                value={rateCard.fixed_fee || ''}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <span className="text-slate-500 dark:text-slate-400">₹</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-3">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Price Thresholds & Validity</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Min Price (₹)
              <span className="ml-1 text-slate-500 dark:text-slate-400 text-xs">
                <HelpCircle className="w-3 h-3 inline" /> Lower price threshold
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                name="min_price"
                value={rateCard.min_price || ''}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <span className="text-slate-500 dark:text-slate-400">₹</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Max Price (₹)
              <span className="ml-1 text-slate-500 dark:text-slate-400 text-xs">
                <HelpCircle className="w-3 h-3 inline" /> Upper price threshold
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                name="max_price"
                value={rateCard.max_price || ''}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <span className="text-slate-500 dark:text-slate-400">₹</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Effective From
              <span className="ml-1 text-slate-500 dark:text-slate-400 text-xs">
                <HelpCircle className="w-3 h-3 inline" /> Start date
              </span>
            </label>
            <input
              type="date"
              name="effective_from"
              value={rateCard.effective_from || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Effective To
              <span className="ml-1 text-slate-500 dark:text-slate-400 text-xs">
                <HelpCircle className="w-3 h-3 inline" /> End date (optional)
              </span>
            </label>
            <input
              type="date"
              name="effective_to"
              value={rateCard.effective_to || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Promo Discount Fee (%)
              <span className="ml-1 text-slate-500 dark:text-slate-400 text-xs">
                <HelpCircle className="w-3 h-3 inline" /> For promotions
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                name="promo_discount_fee"
                value={rateCard.promo_discount_fee || ''}
                onChange={handleChange}
                step="0.01"
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <span className="text-slate-500 dark:text-slate-400">%</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Territory Fee (%)
              <span className="ml-1 text-slate-500 dark:text-slate-400 text-xs">
                <HelpCircle className="w-3 h-3 inline" /> Regional charges
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                name="territory_fee"
                value={rateCard.territory_fee || ''}
                onChange={handleChange}
                step="0.01"
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <span className="text-slate-500 dark:text-slate-400">%</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Notes
              <span className="ml-1 text-slate-500 dark:text-slate-400 text-xs">
                <HelpCircle className="w-3 h-3 inline" /> Internal comments
              </span>
            </label>
            <textarea
              name="notes"
              value={rateCard.notes || ''}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              placeholder="Add any internal notes about this rate card..."
            />
          </div>
        </div>

        <div className="mt-6 flex space-x-3">
          <button
            onClick={onSubmit}
            disabled={!rateCard.platform || !rateCard.category || !rateCard.commission_rate}
            className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mode === 'create' ? 'Create Rate Card' : 'Update Rate Card'}
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default function EnhancedRateCardsManager() {
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCard, setEditingCard] = useState<RateCard | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calculationResult, setCalculationResult] = useState<any>(null);
  
  // Form state
  const [newRateCard, setNewRateCard] = useState<Partial<RateCard>>({
    platform: '',
    category: '',
    commission_rate: 0,
    shipping_fee: 0,
    gst_rate: 0,
    rto_fee: 0,
    packaging_fee: 0,
    fixed_fee: 0,
    min_price: 0,
    max_price: 0,
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: '',
    promo_discount_fee: 0,
    territory_fee: 0,
    notes: ''
  });
  
  // Calculator state
  const [calcValues, setCalcValues] = useState({
    mrp: '1000',
    platform: '',
    category: '',
    actualPaid: '850'
  });

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

  // Extract unique platforms and categories
  const platforms = useMemo(() => {
    return Array.from(new Set(rateCards.map(card => card.platform)));
  }, [rateCards]);

  const categories = useMemo(() => {
    return Array.from(new Set(rateCards.map(card => card.category)));
  }, [rateCards]);

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
    const activeCards = filteredRateCards.filter(c => !c.effective_to || new Date(c.effective_to) > new Date()).length;
    const expiredCards = filteredRateCards.filter(c => c.effective_to && new Date(c.effective_to) <= new Date()).length;
    const avgCommission = filteredRateCards.reduce((sum, c) => sum + (c.commission_rate || 0), 0) / 
                   (filteredRateCards.length || 1);
    
    return { totalCards, activeCards, expiredCards, avgCommission };
  }, [filteredRateCards]);

  const handleCreateRateCard = async () => {
    try {
      await addRateCard(newRateCard as Omit<RateCard, 'id' | 'created_at'>);
      await loadRateCards();
      setShowCreateForm(false);
      setNewRateCard({
        platform: '',
        category: '',
        commission_rate: 0,
        shipping_fee: 0,
        gst_rate: 0,
        effective_from: new Date().toISOString().split('T')[0]
      });
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
        gst_rate: editingCard.gst_rate,
        rto_fee: editingCard.rto_fee,
        packaging_fee: editingCard.packaging_fee,
        fixed_fee: editingCard.fixed_fee,
        min_price: editingCard.min_price,
        max_price: editingCard.max_price,
        effective_from: editingCard.effective_from,
        effective_to: editingCard.effective_to,
        promo_discount_fee: editingCard.promo_discount_fee,
        territory_fee: editingCard.territory_fee,
        notes: editingCard.notes
      });
      await loadRateCards();
      setEditingCard(null);
    } catch (error) {
      console.error('Error updating rate card:', error);
    }
  };

  const handleDeleteRateCard = async (cardId: string) => {
    if (confirm('Are you sure you want to delete this rate card?')) {
      try {
        await deleteRateCard(cardId);
        await loadRateCards();
      } catch (error) {
        console.error('Error deleting rate card:', error);
      }
    }
  };

  const handleNewRateCardChange = (field: string, value: any) => {
    setNewRateCard(prev => ({ ...prev, [field]: value }));
  };

  const handleEditingCardChange = (field: string, value: any) => {
    if (!editingCard) return;
    setEditingCard(prev => ({ ...prev, [field]: value }));
  };

  const exportToCSV = () => {
    const csvData = filteredRateCards.map(card => ({
      'Platform': card.platform,
      'Category': card.category,
      'Commission Rate (%)': card.commission_rate,
      'Shipping Fee (₹)': card.shipping_fee || 0,
      'GST Rate (%)': card.gst_rate || 0,
      'RTO Fee (₹)': card.rto_fee || 0,
      'Packaging Fee (₹)': card.packaging_fee || 0,
      'Fixed Fee (₹)': card.fixed_fee || 0,
      'Min Price (₹)': card.min_price || 'N/A',
      'Max Price (₹)': card.max_price || 'N/A',
      'Effective From': card.effective_from || 'N/A',
      'Effective To': card.effective_to || 'Current',
      'Promo Discount Fee (%)': card.promo_discount_fee || 0,
      'Territory Fee (%)': card.territory_fee || 0,
      'Notes': card.notes || ''
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
    const effectiveFrom = new Date(card.effective_from || '');
    const effectiveTo = card.effective_to ? new Date(card.effective_to) : null;

    if (effectiveFrom > now) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">Future</span>;
    } else if (effectiveTo && effectiveTo <= now) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">Expired</span>;
    } else {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">Active</span>;
    }
  };

  const handleCalculate = () => {
    // Find matching rate card
    const matchingCard = rateCards.find(
      card => card.platform === calcValues.platform && 
              card.category === calcValues.category &&
              (!card.min_price || parseFloat(calcValues.mrp) >= card.min_price) &&
              (!card.max_price || parseFloat(calcValues.mrp) <= card.max_price)
    );
    
    if (!matchingCard) {
      setCalculationResult({
        found: false,
        message: 'No matching rate card found for the selected platform and category.'
      });
      return;
    }
    
    const mrp = parseFloat(calcValues.mrp);
    const actualPaid = parseFloat(calcValues.actualPaid);
    
    // Calculate fees
    const commission = (matchingCard.commission_rate / 100) * mrp;
    const shipping = matchingCard.shipping_fee || 0;
    const rto = matchingCard.rto_fee || 0;
    const packaging = matchingCard.packaging_fee || 0;
    const fixed = matchingCard.fixed_fee || 0;
    const promoDiscount = matchingCard.promo_discount_fee ? (matchingCard.promo_discount_fee / 100) * mrp : 0;
    const territory = matchingCard.territory_fee ? (matchingCard.territory_fee / 100) * mrp : 0;
    
    // Calculate total fees before GST
    const totalFees = commission + shipping + rto + packaging + fixed + promoDiscount + territory;
    
    // Calculate GST on total fees
    const gst = (totalFees * (matchingCard.gst_rate || 0)) / 100;
    
    // Calculate expected amount
    const expected = mrp - (totalFees + gst);
    
    // Calculate discrepancy
    const discrepancy = expected - actualPaid;
    
    setCalculationResult({
      found: true,
      card: matchingCard,
      mrp,
      actualPaid,
      commission,
      shipping,
      rto,
      packaging,
      fixed,
      promoDiscount,
      territory,
      gst,
      totalFees,
      expected,
      discrepancy
    });
  };

  const handleCalcInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCalcValues(prev => ({ ...prev, [name]: value }));
  };

  if (showCreateForm) {
    return (
      <RateCardForm
        mode="create"
        rateCard={newRateCard}
        onChange={handleNewRateCardChange}
        onSubmit={handleCreateRateCard}
        onCancel={() => setShowCreateForm(false)}
        platforms={platforms}
        categories={categories}
      />
    );
  }

  if (editingCard) {
    return (
      <RateCardForm
        mode="edit"
        rateCard={editingCard}
        onChange={handleEditingCardChange}
        onSubmit={handleUpdateRateCard}
        onCancel={() => setEditingCard(null)}
        platforms={platforms}
        categories={categories}
      />
    );
  }

  if (showCalculator) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCalculator(false)}
                className="text-teal-100 hover:text-white text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
              >
                ← Back to Rate Cards
              </button>
              <span className="text-lg font-bold">Rate Card Calculator</span>
            </div>
          </div>
        </div>

        {/* Calculator */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-xl flex items-center justify-center">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Reconciliation Calculator</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Calculate expected settlement amounts based on rate cards</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Product Price (MRP)</label>
              <div className="relative">
                <input
                  type="number"
                  name="mrp"
                  value={calcValues.mrp}
                  onChange={handleCalcInputChange}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  placeholder="e.g., 1000"
                  required
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <span className="text-slate-400 dark:text-slate-500">₹</span>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Actual Paid Amount</label>
              <div className="relative">
                <input
                  type="number"
                  name="actualPaid"
                  value={calcValues.actualPaid}
                  onChange={handleCalcInputChange}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  placeholder="e.g., 850"
                  required
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <span className="text-slate-400 dark:text-slate-500">₹</span>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Platform</label>
              <select
                name="platform"
                value={calcValues.platform}
                onChange={handleCalcInputChange}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                required
              >
                <option value="">Select Platform</option>
                {platforms.map(platform => (
                  <option key={platform} value={platform}>{platform}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Category</label>
              <select
                name="category"
                value={calcValues.category}
                onChange={handleCalcInputChange}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                required
              >
                <option value="">Select Category</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
          
          <button
            onClick={handleCalculate}
            disabled={!calcValues.mrp || !calcValues.actualPaid || !calcValues.platform || !calcValues.category}
            className="w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            Calculate Expected Amount
          </button>
          
          {calculationResult && (
            <div className="mt-6 p-6 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Calculation Result</h4>
                <button
                  onClick={() => setCalculationResult(null)}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {!calculationResult.found ? (
                <div className="flex items-start space-x-3 p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">No matching rate card found</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      No rate card exists for {calcValues.platform} / {calcValues.category}. Please create one first.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">MRP</label>
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">₹{calculationResult.mrp.toFixed(2)}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Platform / Category</label>
                      <p className="text-slate-900 dark:text-slate-100">{calculationResult.card.platform} / {calculationResult.card.category}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Commission</label>
                      <p className="text-red-600 dark:text-red-400">-₹{calculationResult.commission.toFixed(2)} ({calculationResult.card.commission_rate.toFixed(2)}%)</p>
                    </div>
                    
                    {calculationResult.shipping > 0 && (
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Shipping Fee</label>
                        <p className="text-red-600 dark:text-red-400">-₹{calculationResult.shipping.toFixed(2)}</p>
                      </div>
                    )}
                    
                    {calculationResult.rto > 0 && (
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">RTO Fee</label>
                        <p className="text-red-600 dark:text-red-400">-₹{calculationResult.rto.toFixed(2)}</p>
                      </div>
                    )}
                    
                    {calculationResult.packaging > 0 && (
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Packaging Fee</label>
                        <p className="text-red-600 dark:text-red-400">-₹{calculationResult.packaging.toFixed(2)}</p>
                      </div>
                    )}
                    
                    {calculationResult.fixed > 0 && (
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fixed Fee</label>
                        <p className="text-red-600 dark:text-red-400">-₹{calculationResult.fixed.toFixed(2)}</p>
                      </div>
                    )}
                    
                    {calculationResult.promoDiscount > 0 && (
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Promo Discount Fee</label>
                        <p className="text-red-600 dark:text-red-400">-₹{calculationResult.promoDiscount.toFixed(2)}</p>
                      </div>
                    )}
                    
                    {calculationResult.territory > 0 && (
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Territory Fee</label>
                        <p className="text-red-600 dark:text-red-400">-₹{calculationResult.territory.toFixed(2)}</p>
                      </div>
                    )}
                    
                    {calculationResult.gst > 0 && (
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">GST</label>
                        <p className="text-red-600 dark:text-red-400">-₹{calculationResult.gst.toFixed(2)} ({calculationResult.card.gst_rate.toFixed(2)}%)</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Expected Amount</label>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">₹{calculationResult.expected.toFixed(2)}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Actual Paid</label>
                      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">₹{calculationResult.actualPaid.toFixed(2)}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Discrepancy</label>
                      <div className="flex items-center space-x-2">
                        {calculationResult.discrepancy === 0 ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                        ) : calculationResult.discrepancy > 0 ? (
                          <TrendingUp className="w-5 h-5 text-red-500" />
                        ) : (
                          <TrendingUp className="w-5 h-5 text-amber-500" />
                        )}
                        <p className={`text-2xl font-bold ${
                          calculationResult.discrepancy === 0 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : calculationResult.discrepancy > 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}>
                          {calculationResult.discrepancy === 0 
                            ? 'No Discrepancy' 
                            : `₹${Math.abs(calculationResult.discrepancy).toFixed(2)} ${calculationResult.discrepancy > 0 ? 'Underpaid' : 'Overpaid'}`}
                        </p>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-600">
                      <div className="flex items-start space-x-3 p-3 bg-slate-100 dark:bg-slate-600 rounded-lg">
                        <Info className="w-5 h-5 text-slate-500 dark:text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            {calculationResult.discrepancy === 0 
                              ? 'Payment matches expected amount based on rate card.' 
                              : calculationResult.discrepancy > 0
                              ? `You should file a claim for the underpaid amount of ₹${calculationResult.discrepancy.toFixed(2)}.`
                              : `The marketplace has overpaid by ₹${Math.abs(calculationResult.discrepancy).toFixed(2)}.`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
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
              onClick={() => setShowCalculator(true)}
              className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
            >
              <Calculator className="w-4 h-4" />
              <span>Calculator</span>
            </button>
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
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.avgCommission.toFixed(1)}%</p>
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
                : 'You haven\'t added any rate cards yet.'}
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
            >
              Add Your First Rate Card
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
                    Commission
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Fees
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Price Range
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
                        <div>Shipping: ₹{card.shipping_fee || 0}</div>
                        <div>GST: {card.gst_rate || 0}%</div>
                        {card.rto_fee > 0 && <div>RTO: ₹{card.rto_fee}</div>}
                        {card.packaging_fee > 0 && <div>Packaging: ₹{card.packaging_fee}</div>}
                        {card.fixed_fee > 0 && <div>Fixed: ₹{card.fixed_fee}</div>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-slate-100 break-words">
                        {card.min_price || card.max_price ? (
                          `₹${card.min_price || 0} - ₹${card.max_price || '∞'}`
                        ) : (
                          'No limit'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-slate-100">
                        <div>{card.effective_from ? format(new Date(card.effective_from), 'MMM dd, yyyy') : 'N/A'}</div>
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
    </div>
  );
}