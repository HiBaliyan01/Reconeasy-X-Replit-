// components/ReconcileReturns.tsx
import React, { useState } from 'react';

const ReconcileReturns = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleReconcile = async () => {
    setLoading(true);
    const res = await fetch('/api/returns/reconcile');
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-2 text-[var(--primary)]">Return Reconciliation</h2>
      <button onClick={handleReconcile} className="bg-[var(--primary)] text-white px-4 py-2 rounded mb-4">🔄 Reconcile Returns</button>
      {loading && <p>Reconciling...</p>}
      <table className="table-auto w-full text-sm">
        <thead>
          <tr className="bg-[var(--secondary)]">
            <th className="px-2 py-1">Return ID</th>
            <th className="px-2 py-1">Order ID</th>
            <th className="px-2 py-1">Reason</th>
            <th className="px-2 py-1">Status</th>
            <th className="px-2 py-1">Expected Refund</th>
            <th className="px-2 py-1">Actual Refund</th>
            <th className="px-2 py-1">Discrepancy</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="text-center">
              <td className="px-2 py-1">{row.return_id}</td>
              <td className="px-2 py-1">{row.order_id}</td>
              <td className="px-2 py-1">{row.return_reason}</td>
              <td className="px-2 py-1">{row.status}</td>
              <td className="px-2 py-1 text-green-600">₹{row.expected_refund}</td>
              <td className="px-2 py-1 text-blue-600">₹{row.actual_refund}</td>
              <td className="px-2 py-1 text-red-500">{row.discrepancy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ReconcileReturns;