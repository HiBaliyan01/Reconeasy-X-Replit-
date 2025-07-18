import React, { useState } from "react";
import { Calculator, DollarSign, ArrowRight, AlertTriangle, CheckCircle } from "lucide-react";

interface RateCalculatorProps {
  rateCards: any[];
}

export function RateCalculator({ rateCards }: RateCalculatorProps) {
  const [mrp, setMrp] = useState("");
  const [platform, setPlatform] = useState("");
  const [category, setCategory] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Get unique platforms and categories from rate cards
  const platforms = [...new Set(rateCards.map(card => card.platform))];
  const categories = [...new Set(rateCards.map(card => card.category))];

  const handleCalculate = () => {
    if (!mrp || !platform || !category) return;

    const mrpValue = parseFloat(mrp);
    
    // Find matching rate card
    const rateCard = rateCards.find(
      card => card.platform === platform && 
              card.category === category &&
              (!card.min_price || mrpValue >= card.min_price) &&
              (!card.max_price || mrpValue <= card.max_price)
    );
    
    if (!rateCard) {
      setResult({
        mrp: mrpValue,
        platform,
        category,
        commission: 0,
        shipping: 0,
        rto: 0,
        packaging: 0,
        fixed: 0,
        gst: 0,
        expected: mrpValue,
        rateCardFound: false
      });
    } else {
      const commission = (rateCard.commission_rate / 100) * mrpValue;
      const shipping = rateCard.shipping_fee || 0;
      const rto = rateCard.rto_fee || 0;
      const packaging = rateCard.packaging_fee || 0;
      const fixed = rateCard.fixed_fee || 0;
      
      // Calculate total fees before GST
      const totalFees = commission + shipping + rto + packaging + fixed;
      
      // Calculate GST on total fees
      const gst = (totalFees * (rateCard.gst_rate || 0)) / 100;
      
      // Calculate expected amount
      const expected = mrpValue - (totalFees + gst);
      
      setResult({
        mrp: mrpValue,
        platform,
        category,
        commission,
        shipping,
        rto,
        packaging,
        fixed,
        gst,
        expected,
        rateCardFound: true
      });
    }
    
    setShowResult(true);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-xl flex items-center justify-center">
          <Calculator className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Rate Card Calculator</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">Calculate expected settlement amount based on rate cards</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Product Price (MRP)</label>
          <div className="relative">
            <DollarSign className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="number"
              value={mrp}
              onChange={(e) => setMrp(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              placeholder="e.g., 1000"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
          >
            <option value="">Select Platform</option>
            {platforms.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
          >
            <option value="">Select Category</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-end">
          <button
            onClick={handleCalculate}
            disabled={!mrp || !platform || !category}
            className="w-full px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <ArrowRight className="w-4 h-4" />
            <span>Calculate</span>
          </button>
        </div>
      </div>

      {showResult && result && (
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600">
          {!result.rateCardFound && (
            <div className="flex items-start space-x-3 p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">No matching rate card found</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  No rate card exists for {result.platform} / {result.category}. Using MRP as expected amount.
                </p>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Calculation Breakdown</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">MRP:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">₹{result.mrp.toFixed(2)}</span>
                </div>
                
                {result.commission > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Commission:</span>
                    <span className="font-medium text-red-600 dark:text-red-400">-₹{result.commission.toFixed(2)}</span>
                  </div>
                )}
                
                {result.shipping > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Shipping Fee:</span>
                    <span className="font-medium text-red-600 dark:text-red-400">-₹{result.shipping.toFixed(2)}</span>
                  </div>
                )}
                
                {result.rto > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">RTO Fee:</span>
                    <span className="font-medium text-red-600 dark:text-red-400">-₹{result.rto.toFixed(2)}</span>
                  </div>
                )}
                
                {result.packaging > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Packaging Fee:</span>
                    <span className="font-medium text-red-600 dark:text-red-400">-₹{result.packaging.toFixed(2)}</span>
                  </div>
                )}
                
                {result.fixed > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Fixed Fee:</span>
                    <span className="font-medium text-red-600 dark:text-red-400">-₹{result.fixed.toFixed(2)}</span>
                  </div>
                )}
                
                {result.gst > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">GST:</span>
                    <span className="font-medium text-red-600 dark:text-red-400">-₹{result.gst.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-600">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Expected Amount:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{result.expected.toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                  ₹{result.expected.toFixed(2)}
                </div>
                <div className="flex items-center justify-center space-x-2 text-sm">
                  {result.rateCardFound ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Based on {result.platform} / {result.category} rate card
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="text-amber-600 dark:text-amber-400">
                        No matching rate card found
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}