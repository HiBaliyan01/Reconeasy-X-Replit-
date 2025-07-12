import React, { useState } from 'react';
import { Info, ArrowLeft, Download } from 'lucide-react';

// Tooltip wrapper (simple, tailwind based)
export function Tooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center">
      <Info className="w-3 h-3 ml-1 text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-400" />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
        {text}
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
  const input = (
    name: string,
    placeholder: string,
    type: string = 'text'
  ) => (
    <input
      type={type}
      placeholder={placeholder}
      value={card[name] ?? ''}
      onChange={(e) => onChange({ 
        ...card, 
        [name]: type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value 
      })}
      className="border border-slate-300 dark:border-slate-600 px-3 py-2 rounded-lg w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
    />
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Platform
            <Tooltip text="Marketplace selling platform" />
          </label>
          {input('platform', 'Amazon / Myntra')}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Category
            <Tooltip text="Product category" />
          </label>
          {input('category', 'Apparel / Electronics')}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Commission %
            <Tooltip text="Marketplace commission percentage" />
          </label>
          {input('commission_rate', 'e.g. 12', 'number')}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Shipping Fee ₹
            <Tooltip text="Default logistics fee" />
          </label>
          {input('shipping_fee', 'e.g. 50', 'number')}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            GST %
            <Tooltip text="GST applied on marketplace fees" />
          </label>
          {input('gst_rate', '18', 'number')}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            RTO Fee ₹
            <Tooltip text="Return-to-Origin fee per order" />
          </label>
          {input('rto_fee', '0', 'number')}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Packaging Fee ₹
            <Tooltip text="Packaging/environmental charge" />
          </label>
          {input('packaging_fee', '0', 'number')}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Fixed Fee ₹
            <Tooltip text="Any fixed platform fee" />
          </label>
          {input('fixed_fee', '0', 'number')}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Min Price ₹
            <Tooltip text="Slab minimum price" />
          </label>
          {input('min_price', '0', 'number')}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Max Price ₹
            <Tooltip text="Slab maximum price" />
          </label>
          {input('max_price', '0', 'number')}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Effective Date
            <Tooltip text="Start date for this rate" />
          </label>
          {input('effective_from', '', 'date')}
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button 
          type="submit" 
          className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          Save
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
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Rate Calculator</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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
            className="w-full px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Calculate
          </button>
        </div>
      </div>

      {result && (
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
          <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Calculation Result</h4>
          
          {!result.found ? (
            <p className="text-amber-600 dark:text-amber-400">No rate card found for this platform and category. Using MRP as expected amount.</p>
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
                <div className="text-center">
                  <p className="text-sm text-slate-600 dark:text-slate-400">Expected Payout:</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">₹{result.expected.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}