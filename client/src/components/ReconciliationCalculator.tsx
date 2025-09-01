import React, { useEffect, useState } from "react";
import axios from "axios";

type RateCard = {
  id: string;
  platform_id: string;
  category_id: string;
  commission_type: "flat" | "tiered";
  commission_percent?: number | null;
  effective_from: string;
  effective_to?: string | null;
  status: "active" | "expired" | "upcoming";
};

export default function ReconciliationCalculator({ rateCards: injected }: { rateCards?: RateCard[] }) {
  const [rateCards, setRateCards] = useState<RateCard[]>(injected || []);
  const [loading, setLoading] = useState(!injected);

  useEffect(() => {
    if (injected) {
      setRateCards(injected);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await axios.get("/api/rate-cards");
        setRateCards(res.data.data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [injected]);

  if (loading) return <div className="bg-white rounded-xl p-6 shadow">Loading…</div>;
  if (!rateCards.length) {
    return (
      <div className="bg-white rounded-xl p-8 shadow text-center text-slate-500">
        No Rate Cards Found
      </div>
    );
  }

  const [platforms, setPlatforms] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    mrp: '',
    platform: '',
    category: '',
    actualPaid: ''
  });
  const [result, setResult] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (rateCards.length > 0) {
      const uniquePlatforms = Array.from(new Set(rateCards.map(card => card.platform_id)));
      const uniqueCategories = Array.from(new Set(rateCards.map(card => card.category_id)));
      
      setPlatforms(['', ...uniquePlatforms]);
      setCategories(['', ...uniqueCategories]);
    }
  }, [rateCards]);

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

    // Find matching rate card
    const matchingCard = rateCards.find(card => 
      card.platform_id === formData.platform && 
      card.category_id === formData.category &&
      card.status === 'active'
    );

    if (!matchingCard) {
      alert('No active rate card found for this platform and category');
      return;
    }

    // Simple calculation based on commission
    const commission = mrp * ((matchingCard.commission_percent || 0) / 100);
    const expected = mrp - commission;
    const discrepancy = expected - actualPaid;

    const calculationResult = {
      expected,
      actual: actualPaid,
      discrepancy,
      commission,
      mrp,
      platform: formData.platform,
      category: formData.category,
      rateCardFound: !!matchingCard
    };

    setResult(calculationResult);
    setShowResult(true);
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Reconciliation Calculator</h3>
        <p className="text-sm text-gray-600">Calculator ready with {rateCards.length} rate cards.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Product Price (MRP)</label>
          <input
            type="number"
            name="mrp"
            value={formData.mrp}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            placeholder="e.g., 1000"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Actual Paid Amount</label>
          <input
            type="number"
            name="actualPaid"
            value={formData.actualPaid}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            placeholder="e.g., 850"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
          <select
            name="platform"
            value={formData.platform}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            required
          >
            {platforms.map(platform => (
              <option key={platform} value={platform}>{platform || 'Select Platform'}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            required
          >
            {categories.map(category => (
              <option key={category} value={category}>{category || 'Select Category'}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleCalculate}
        disabled={!formData.mrp || !formData.actualPaid || !formData.platform || !formData.category}
        className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors mb-6"
      >
        Calculate Expected Amount
      </button>

      {showResult && result && (
        <div className="mt-6 p-6 bg-gray-50 rounded-xl border">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Calculation Result</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Expected Amount</label>
              <p className="text-xl font-bold text-gray-900">₹{result.expected.toFixed(2)}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Actual Paid</label>
              <p className="text-xl font-bold text-gray-900">₹{result.actual.toFixed(2)}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Discrepancy</label>
              <p className={`text-xl font-bold ${
                result.discrepancy === 0 ? 'text-green-600' : 
                result.discrepancy > 0 ? 'text-red-600' : 'text-yellow-600'
              }`}>
                {result.discrepancy === 0 ? 'No Discrepancy' : 
                 `₹${Math.abs(result.discrepancy).toFixed(2)} ${result.discrepancy > 0 ? 'Underpaid' : 'Overpaid'}`}
              </p>
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              {result.discrepancy === 0 ? 'Payment matches expected amount based on rate card.' : 
               result.discrepancy > 0 ? `You should file a claim for the underpaid amount of ₹${result.discrepancy.toFixed(2)}.` :
               `The marketplace has overpaid by ₹${Math.abs(result.discrepancy).toFixed(2)}.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}