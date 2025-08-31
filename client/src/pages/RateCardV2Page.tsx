// client/src/pages/RateCardV2Page.tsx
import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import axios from "axios";

import { RateCardHeader } from "@/components/RateCardHeader";
import RateCardFormV2 from "@/components/RateCardFormV2Compact";
import RateCardUploader from "@/components/RateCardUploader";
import ReconciliationCalculator from "@/components/ReconciliationCalculator";

interface RateCard {
  id: string;
  platform_id: string;
  category_id: string;
  commission_type: "flat" | "tiered";
  commission_percent?: number;
  effective_from: string;
  effective_to?: string;
  gst_percent?: string;
  tcs_percent?: string;
  settlement_basis?: string;
  t_plus_days?: number;
  notes?: string;
  status?: string; // Add status field from backend
}

export default function RateCardV2Page() {
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [metrics, setMetrics] = useState<any>({ 
    total: 0, 
    active: 0, 
    expired: 0, 
    upcoming: 0, 
    avg_flat_commission: 0, 
    flat_count: 0 
  });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<RateCard | null>(null);

  const fetchCards = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/rate-cards");
      setRateCards(res.data.data);
      setMetrics(res.data.metrics);
    } catch (err) {
      console.error("Failed to fetch rate cards", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  const handleSaved = () => {
    setShowForm(false);
    setEditingCard(null);
    fetchCards();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <RateCardHeader onBack={() => window.history.back()} title="Rate Cards V2" />

      {/* Summary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Rate Cards</p>
          <p className="text-2xl font-bold dark:text-white">{metrics.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">Active</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{metrics.active}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">Expired</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{metrics.expired}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">Upcoming</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{metrics.upcoming}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow text-center flex-1 mr-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Avg Commission % (Flat)</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {metrics.avg_flat_commission}% <span className="text-xs text-slate-400 dark:text-slate-500">({metrics.flat_count})</span>
          </p>
        </div>
        
        <button
          onClick={() => {
            setShowForm(true);
            setEditingCard(null);
          }}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl transition-colors duration-200"
        >
          <Plus className="w-4 h-4" />
          Add New Rate Card
        </button>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => {
            setShowForm(true);
            setEditingCard(null);
          }}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl transition-colors duration-200"
        >
          <Plus className="w-4 h-4" />
          Add New Rate Card
        </button>
      </div>

      {/* Form (Add/Edit) */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow">
          <RateCardFormV2
            mode={editingCard ? "edit" : "create"}
            initialData={editingCard ? {
              ...editingCard,
              mode: "edit" as const,
              gst_percent: editingCard.gst_percent ? parseFloat(editingCard.gst_percent) : 18,
              tcs_percent: editingCard.tcs_percent ? parseFloat(editingCard.tcs_percent) : 1,
              settlement_basis: (editingCard.settlement_basis as "t_plus" | "weekly" | "bi_weekly" | "monthly") || "t_plus",
              slabs: [],
              fees: []
            } : undefined}
            onSaved={handleSaved}
          />
        </div>
      )}

      {/* Rate Card List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left dark:text-white">Platform</th>
              <th className="px-4 py-2 text-left dark:text-white">Category</th>
              <th className="px-4 py-2 text-left dark:text-white">Commission</th>
              <th className="px-4 py-2 text-left dark:text-white">Status</th>
              <th className="px-4 py-2 text-left dark:text-white">Valid From</th>
              <th className="px-4 py-2 text-left dark:text-white">Valid To</th>
              <th className="px-4 py-2 dark:text-white"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center p-4 dark:text-gray-300">
                  Loading…
                </td>
              </tr>
            ) : rateCards.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center p-4 dark:text-gray-300">
                  No rate cards yet.
                </td>
              </tr>
            ) : (
              rateCards.map((card) => (
                <tr key={card.id} className="border-t dark:border-gray-600">
                  <td className="px-4 py-2 dark:text-gray-300">{card.platform_id}</td>
                  <td className="px-4 py-2 dark:text-gray-300">{card.category_id}</td>
                  <td className="px-4 py-2 dark:text-gray-300">
                    {card.commission_type === "flat"
                      ? `${card.commission_percent}%`
                      : "Tiered"}
                  </td>
                  <td className="px-4 py-2 capitalize dark:text-gray-300">
                    <span className={`px-2 py-1 rounded text-xs ${
                      card.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      card.status === 'expired' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    }`}>
                      {card.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 dark:text-gray-300">{card.effective_from}</td>
                  <td className="px-4 py-2 dark:text-gray-300">{card.effective_to || "-"}</td>
                  <td className="px-4 py-2 text-right flex gap-3 justify-end">
                    <button
                      onClick={() => {
                        setEditingCard(card);
                        setShowForm(true);
                      }}
                      className="text-teal-600 hover:underline text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("Delete this rate card?")) return;
                        await axios.delete(`/api/rate-cards-v2/${card.id}`);
                        fetchCards();
                      }}
                      className="text-rose-600 hover:underline text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CSV Upload */}
      <RateCardUploader />

      {/* Calculator */}
      <ReconciliationCalculator />
    </div>
  );
}