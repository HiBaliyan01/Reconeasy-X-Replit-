import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface PredictRecoResultProps {
  result: {
    order_id: string;
    marketplace: string;
    category: string;
    date: string;
    expected_payout: number;
    actual_settlement_amount: number;
    delta: number;
    mismatch_flag: boolean;
    calculation_breakdown: {
      commission: number;
      shipping_fee: number;
      gst: number;
      rto_fee: number;
      packaging_fee: number;
      fixed_fee: number;
      total_deductions: number;
    };
  };
}

const PredictRecoResult: React.FC<PredictRecoResultProps> = ({ result }) => {
  const {
    order_id,
    expected_payout,
    actual_settlement_amount,
    delta,
    mismatch_flag,
    calculation_breakdown,
  } = result;

  return (
    <div className="p-6 bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 space-y-4">
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">🔍 Reconciliation Summary</h2>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="text-slate-700 dark:text-slate-300">
          <strong>Order ID:</strong> {order_id}
        </div>
        <div className="text-slate-700 dark:text-slate-300">
          <strong>Marketplace:</strong> {result.marketplace}
        </div>
        <div className="text-slate-700 dark:text-slate-300">
          <strong>Category:</strong> {result.category}
        </div>
        <div className="text-slate-700 dark:text-slate-300">
          <strong>Date:</strong> {result.date}
        </div>
        <div className="text-slate-700 dark:text-slate-300">
          <strong>Expected Payout:</strong> ₹{expected_payout.toLocaleString()}
        </div>
        <div className="text-slate-700 dark:text-slate-300">
          <strong>Actual Settlement:</strong> ₹{actual_settlement_amount.toLocaleString()}
        </div>
        <div className="text-slate-700 dark:text-slate-300">
          <strong>Difference (Δ):</strong> ₹{delta.toLocaleString()}
        </div>
        <div className="text-slate-700 dark:text-slate-300">
          <strong>Status:</strong>{' '}
          {mismatch_flag ? (
            <span className="text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
              <AlertCircle size={16} /> Mismatch
            </span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle size={16} /> Match
            </span>
          )}
        </div>
      </div>
      <h3 className="font-semibold mt-4 text-slate-900 dark:text-slate-100">💸 Fee Breakdown</h3>
      <ul className="list-disc pl-6 text-sm text-slate-700 dark:text-slate-300">
        {Object.entries(calculation_breakdown).map(([key, value]) => (
          <li key={key}>
            {key.replace(/_/g, ' ')}: ₹{(value as number).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PredictRecoResult;