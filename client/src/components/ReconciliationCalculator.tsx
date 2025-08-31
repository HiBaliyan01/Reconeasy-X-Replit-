import React, { useState, useEffect } from 'react';
import { 
  Calculator, DollarSign, Percent, TrendingUp, AlertTriangle, 
  CheckCircle, Download, RefreshCw, Info
} from 'lucide-react';
import { fetchRateCards, RateCard, calculateExpectedAmount } from '../utils/supabase';

interface ReconciliationCalculatorProps {
  onCalculate?: (result: CalculationResult) => void;
  rateCards?: RateCard[];
}

interface CalculationResult {
  expected: number;
  actual: number;
  discrepancy: number;
  commission: number;
  shipping: number;
  gst: number;
  mrp: number;
  platform: string;
  category: string;
  rateCardFound: boolean;
}

export default function ReconciliationCalculator({ onCalculate, rateCards = [] }: ReconciliationCalculatorProps) {
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<CalculationResult | null>(null);
  
  const [formData, setFormData] = useState({
    mrp: '',
    platform: '',
    category: '',
    actualPaid: ''
  });

  useEffect(() => {
    loadRateCards();
  }, []); // Add empty dependency array to run only once on mount

  const loadRateCards = async () => {
    setIsLoading(true);
    try {
      const cards = await fetchRateCards();
      const uniquePlatforms = [...new Set(cards.map(card => card.platform))];
      const uniqueCategories = [...new Set(cards.map(card => card.category))];
      
      setPlatforms(['', ...uniquePlatforms]);
      setCategories(['', ...uniqueCategories]);
    } catch (error) {
      console.error('Error loading rate cards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCalculate = () => {
    const mrp = parseFloat(formData.mrp);
    const actualPaid = parseFloat(formData.actualPaid);
    
    if (isNaN(mrp) || isNaN(actualPaid)) {
      alert('Please enter valid numbers for MRP and Actual Paid Amount');
      return;
    }
    
    const { expected, commission, shipping, rto, packaging, fixed, gst, rateCardFound } = calculateExpectedAmount(
      mrp,
      formData.platform,
      formData.category,
      rateCards
    );
    
    const discrepancy = expected - actualPaid;
    
    const calculationResult = {
      expected,
      actual: actualPaid,
      discrepancy,
      commission,
      shipping,
      rto,
      packaging,
      fixed,
      gst,
      mrp,
      platform: formData.platform,
      category: formData.category,
      rateCardFound
    };
    
    setResult(calculationResult);
    setShowResult(true);
    
    if (onCalculate) {
      onCalculate(calculationResult);
    }
  };

  const exportCalculation = () => {
    if (!result) return;
    
    const csvContent = `
MRP,₹${result.mrp.toFixed(2)}
Platform,${result.platform}
Category,${result.category}
Commission,₹${result.commission.toFixed(2)}
Shipping Fee,₹${result.shipping.toFixed(2)}
RTO Fee,₹${result.rto.toFixed(2)}
Packaging Fee,₹${result.packaging.toFixed(2)}
Fixed Fee,₹${result.fixed.toFixed(2)}
GST,₹${result.gst.toFixed(2)}
Expected Amount,₹${result.expected.toFixed(2)}
Actual Paid,₹${result.actual.toFixed(2)}
Discrepancy,₹${result.discrepancy.toFixed(2)}
    `.trim();
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-xl flex items-center justify-center">
            <Calculator className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Reconciliation Calculator</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Calculate expected settlement amounts based on rate cards</p>
          </div>
        </div>
        
        <button
          onClick={loadRateCards}
          className="flex items-center space-x-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Rate Cards</span>
        </button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center">
          <div className="inline-block w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Loading rate cards...</p>
        </div>
      ) : rateCards.length === 0 ? (
        <div className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No Rate Cards Found</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            You need to add rate cards before using the calculator.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Product Price (MRP)</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="number"
                  name="mrp"
                  value={formData.mrp}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  placeholder="e.g., 1000"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Actual Paid Amount</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="number"
                  name="actualPaid"
                  value={formData.actualPaid}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  placeholder="e.g., 850"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Platform</label>
              <select
                name="platform"
                value={formData.platform}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                required
              >
                {platforms.map(platform => (
                  <option key={platform} value={platform}>{platform}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                required
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
          
          <button
            onClick={handleCalculate}
            className="w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 mb-6"
          >
            Calculate Expected Amount
          </button>
          
          {showResult && result && (
            <div className="mt-6 p-6 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Calculation Result</h4>
                <button
                  onClick={exportCalculation}
                  className="flex items-center space-x-2 px-3 py-2 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-lg hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
              </div>
              
              {result.rto > 0 && (
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">RTO Fee</label>
                  <p className="text-red-600 dark:text-red-400">-₹{result.rto.toFixed(2)}</p>
                </div>
              )}
              
              {result.packaging > 0 && (
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Packaging Fee</label>
                  <p className="text-red-600 dark:text-red-400">-₹{result.packaging.toFixed(2)}</p>
                </div>
              )}
              
              {result.fixed > 0 && (
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fixed Fee</label>
                  <p className="text-red-600 dark:text-red-400">-₹{result.fixed.toFixed(2)}</p>
                </div>
              )}
              
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">MRP</label>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">₹{result.mrp.toFixed(2)}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Platform / Category</label>
                    <p className="text-slate-900 dark:text-slate-100">{result.platform} / {result.category}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Commission</label>
                    <p className="text-red-600 dark:text-red-400">-₹{result.commission.toFixed(2)} ({(result.commission / result.mrp * 100).toFixed(2)}%)</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Shipping Fee</label>
                    <p className="text-red-600 dark:text-red-400">-₹{result.shipping.toFixed(2)}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">GST</label>
                    <p className="text-red-600 dark:text-red-400">-₹{result.gst.toFixed(2)} ({(result.gst / (result.commission + result.shipping) * 100).toFixed(2)}%)</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Expected Amount</label>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">₹{result.expected.toFixed(2)}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Actual Paid</label>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">₹{result.actual.toFixed(2)}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Discrepancy</label>
                    <div className="flex items-center space-x-2">
                      {result.discrepancy === 0 ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : result.discrepancy > 0 ? (
                        <TrendingUp className="w-5 h-5 text-red-500" />
                      ) : (
                        <TrendingUp className="w-5 h-5 text-amber-500" />
                      )}
                      <p className={`text-2xl font-bold ${
                        result.discrepancy === 0 
                          ? 'text-emerald-600 dark:text-emerald-400' 
                          : result.discrepancy > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {result.discrepancy === 0 
                          ? 'No Discrepancy' 
                          : `₹${Math.abs(result.discrepancy).toFixed(2)} ${result.discrepancy > 0 ? 'Underpaid' : 'Overpaid'}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-600">
                    <div className="flex items-start space-x-3 p-3 bg-slate-100 dark:bg-slate-600 rounded-lg">
                      <Info className="w-5 h-5 text-slate-500 dark:text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {result.discrepancy === 0 
                            ? 'Payment matches expected amount based on rate card.' 
                            : result.discrepancy > 0
                            ? `You should file a claim for the underpaid amount of ₹${result.discrepancy.toFixed(2)}.`
                            : `The marketplace has overpaid by ₹${Math.abs(result.discrepancy).toFixed(2)}.`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}