import React, { useState } from 'react';
import { Info, ArrowLeft, Download } from 'lucide-react';

// Improved Tooltip wrapper with better positioning
// Tooltip wrapper (simple, tailwind based)
export function Tooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center cursor-help">
      <Info className="w-3.5 h-3.5 ml-1 text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-400" />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-800 text-white text-xs rounded-md px-3 py-1.5 whitespace-nowrap z-10 shadow-lg">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></span>
      </span>
    </span>
  );
}

// Reusable Header Component
export function RateCardHeader({ onBack, onExport }: { onBack: () => void, onExport?: () => void }) {
  return (
    <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-teal-100 hover:text-white text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
          >
            <div className="flex items-center space-x-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Rate Cards</span>
            </div>
          </button>
          <span className="font-semibold text-lg">Add / Edit Rate Card</span>
        </div>
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        )}
      </div>
    </div>
  );
}

// Reusable RateCardForm (with tooltips)
export function RateCardForm({ 
  card, 
  onChange, 
  onSubmit, 
  onCancel 
}: { 
  card: any,
  onChange: (card: any) => void, 
  onSubmit: () => void, 
  onCancel: () => void 
}) {
  // Platforms and categories for dropdowns
  const platforms = [
    "Amazon", "Flipkart", "Myntra", "Ajio", "Nykaa", 
    "Shopify", "WooCommerce", "Magento"
  ];
  
  const categories = [
    "Apparel", "Electronics", "Home", "Beauty", "Footwear", 
    "Accessories", "Books", "Toys", "Jewelry", "Sports"
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6"
    >
      {/* Platform Info Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
          Platform Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Platform
              <Tooltip text="Marketplace selling platform" />
            </label>
            <select 
              value={card.platform || ''} 
              onChange={(e) => onChange({ ...card, platform: e.target.value })}
              className="border border-slate-300 dark:border-slate-600 px-3 py-2 rounded-lg w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
              <option value="">Select Platform</option>
              {platforms.map(platform => (
                <option key={platform} value={platform}>{platform}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Category
              <Tooltip text="Product category" />
            </label>
            <select 
              value={card.category || ''} 
              onChange={(e) => onChange({ ...card, category: e.target.value })}
              className="border border-slate-300 dark:border-slate-600 px-3 py-2 rounded-lg w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
              <option value="">Select Category</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Commission %
              <Tooltip text="Marketplace commission percentage" />
            </label>
            <input
              type="number"
              placeholder="e.g. 12"
              value={card.commission_rate ?? ''}
              onChange={(e) => onChange({ 
                ...card, 
                commission_rate: parseFloat(e.target.value) || 0
              })}
              className="border border-slate-300 dark:border-slate-600 px-3 py-2 rounded-lg w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Fee Details Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
          Fee Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Shipping Fee ₹
              <Tooltip text="Default logistics fee" />
            </label>
            <input
              type="number"
              placeholder="e.g. 50"
              value={card.shipping_fee ?? ''}
              onChange={(e) => onChange({ 
                ...card, 
                shipping_fee: parseFloat(e.target.value) || 0
              })}
              className="border border-slate-300 dark:border-slate-600 px-3 py-2 rounded-lg w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              GST %
              <Tooltip text="GST applied on marketplace fees" />
            </label>
            <input
              type="number"
              placeholder="e.g. 18"
              value={card.gst_rate ?? ''}
              onChange={(e) => onChange({ 
                ...card, 
                gst_rate: parseFloat(e.target.value) || 0
              })}
              className="border border-slate-300 dark:border-slate-600 px-3 py-2 rounded-lg w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              RTO Fee ₹
              <Tooltip text="Return-to-Origin fee per order" />
            </label>
            <input
              type="number"
              placeholder="e.g. 100"
              value={card.rto_fee ?? ''}
              onChange={(e) => onChange({ 
                ...card, 
                rto_fee: parseFloat(e.target.value) || 0
              })}
              className="border border-slate-300 dark:border-slate-600 px-3 py-2 rounded-lg w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Packaging Fee ₹
              <Tooltip text="Packaging/environmental charge" />
            </label>
            <input
              type="number"
              placeholder="e.g. 20"
              value={card.packaging_fee ?? ''}
              onChange={(e) => onChange({ 
                ...card, 
                packaging_fee: parseFloat(e.target.value) || 0
              })}
              className="border border-slate-300 dark:border-slate-600 px-3 py-2 rounded-lg w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Fixed Fee ₹
              <Tooltip text="Any fixed platform fee" />
            </label>
            <input
              type="number"
              placeholder="e.g. 10"
              value={card.fixed_fee ?? ''}
              onChange={(e) => onChange({ 
                ...card, 
                fixed_fee: parseFloat(e.target.value) || 0
              })}
              className="border border-slate-300 dark:border-slate-600 px-3 py-2 rounded-lg w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Slab Validity Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
          Slab Validity
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Min Price ₹
              <Tooltip text="Slab minimum price" />
            </label>
            <input
              type="number"
              placeholder="e.g. 500"
              value={card.min_price ?? ''}
              onChange={(e) => onChange({ 
                ...card, 
                min_price: parseFloat(e.target.value) || 0
              })}
              className="border border-slate-300 dark:border-slate-600 px-3 py-2 rounded-lg w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Max Price ₹
              <Tooltip text="Slab maximum price" />
            </label>
            <input
              type="number"
              placeholder="e.g. 5000"
              value={card.max_price ?? ''}
              onChange={(e) => onChange({ 
                ...card, 
                max_price: parseFloat(e.target.value) || 0
              })}
              className="border border-slate-300 dark:border-slate-600 px-3 py-2 rounded-lg w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Effective Date
              <Tooltip text="Start date for this rate" />
            </label>
            <input
              type="date"
              value={card.effective_from ?? ''}
              onChange={(e) => onChange({ 
                ...card, 
                effective_from: e.target.value
              })}
              className="border border-slate-300 dark:border-slate-600 px-3 py-2 rounded-lg w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button 
          type="submit" 
          className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h1a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h1v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
          </svg>
          Save Rate Card
        </button>
        <button 
          type="button" 
          onClick={onCancel} 
          className="px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// RateCalculator (updated with extra fees)
export function RateCalculator({ rateCards }: { rateCards: any[] }) {
  const [platform, setPlatform] = useState('');
  const [category, setCategory] = useState('');
  const [mrp, setMrp] = useState<number>(0);
  const [result, setResult] = useState<any>(null);

  // Get unique platforms and categories
  const platforms = [...new Set(rateCards.map(card => card.platform))];
  const categories = [...new Set(rateCards.map(card => card.category))];

  const calculate = () => {
    if (!platform || !category || !mrp) return;

    const card = rateCards.find(r => r.platform === platform && r.category === category);
    if (!card) {
      setResult({
        found: false,
        mrp,
        expected: mrp
      });
      return;
    }

    const commission = (card.commission_rate / 100) * mrp;
    const shipping = card.shipping_fee || 0;
    const rto = card.rto_fee || 0;
    const packaging = card.packaging_fee || 0;
    const fixed = card.fixed_fee || 0;
    
    // Calculate total fees before GST
    const totalFees = commission + shipping + rto + packaging + fixed;
    
    // Calculate GST on total fees
    const gst = (totalFees * (card.gst_rate || 0)) / 100;
    
    // Calculate expected amount
    const expected = mrp - (totalFees + gst);
    
    setResult({
      found: true,
      mrp,
      commission,
      shipping,
      rto,
      packaging,
      fixed,
      gst,
      totalFees,
      expected
    });
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 mb-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-teal-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zm6 7a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm-3 3a1 1 0 100 2h.01a1 1 0 100-2H10zm-4 1a1 1 0 011-1h.01a1 1 0 110 2H7a1 1 0 01-1-1zm1-4a1 1 0 100 2h.01a1 1 0 100-2H7zm2 1a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zm4-4a1 1 0 100 2h.01a1 1 0 100-2H13zM9 9a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zM7 8a1 1 0 000 2h.01a1 1 0 000-2H7z" clipRule="evenodd" />
        </svg>
        Rate Calculator
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">MRP (₹)</label>
          <input 
            type="number" 
            value={mrp || ''} 
            onChange={(e) => setMrp(Number(e.target.value))} 
            placeholder="Enter product price" 
            className="border border-slate-300 dark:border-slate-600 px-3 py-2 rounded-lg w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Platform</label>
          <select 
            value={platform} 
            onChange={(e) => setPlatform(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 px-3 py-2 rounded-lg w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
          >
            <option value="">Select Platform</option>
            {platforms.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Category</label>
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 px-3 py-2 rounded-lg w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
          >
            <option value="">Select Category</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-end">
          <button 
            onClick={calculate}
            className="w-full px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            Calculate
          </button>
        </div>
      </div>

      {result && (
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg shadow-inner">
          <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2 border-b border-slate-200 dark:border-slate-600 pb-2">Calculation Result</h4>
          
          {!result.found ? (
            <p className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">No rate card found for this platform and category. Using MRP as expected amount.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">MRP: <span className="font-medium text-slate-900 dark:text-slate-100">₹{result.mrp.toFixed(2)}</span></p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Commission: <span className="font-medium text-red-600 dark:text-red-400">-₹{result.commission.toFixed(2)}</span></p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Shipping Fee: <span className="font-medium text-red-600 dark:text-red-400">-₹{result.shipping.toFixed(2)}</span></p>
                {result.rto > 0 && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">RTO Fee: <span className="font-medium text-red-600 dark:text-red-400">-₹{result.rto.toFixed(2)}</span></p>
                )}
                {result.packaging > 0 && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">Packaging Fee: <span className="font-medium text-red-600 dark:text-red-400">-₹{result.packaging.toFixed(2)}</span></p>
                )}
                {result.fixed > 0 && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">Fixed Fee: <span className="font-medium text-red-600 dark:text-red-400">-₹{result.fixed.toFixed(2)}</span></p>
                )}
                <p className="text-sm text-slate-600 dark:text-slate-400">GST: <span className="font-medium text-red-600 dark:text-red-400">-₹{result.gst.toFixed(2)}</span></p>
              </div>
              <div className="flex items-center justify-center">
                <div className="text-center bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg w-full">
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Expected Payout:</p>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">₹{result.expected.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}