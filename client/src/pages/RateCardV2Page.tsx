// client/src/pages/RateCardV2Page.tsx
import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import axios from "axios";

import { RateCardHeader } from "@/components/RateCardHeader";
import RateCardFormV2 from "@/components/RateCardFormV2";
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
}

export default function RateCardV2Page() {
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<RateCard | null>(null);

  const fetchCards = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/rate-cards-v2");
      setRateCards(res.data);
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
          <p className="text-2xl font-bold dark:text-white">{rateCards.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">Active</p>
          <p className="text-2xl font-bold dark:text-white">
            {rateCards.filter(
              (c) =>
                !c.effective_to ||
                new Date(c.effective_to) >= new Date()
            ).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">Expired</p>
          <p className="text-2xl font-bold dark:text-white">
            {rateCards.filter(
              (c) =>
                c.effective_to && new Date(c.effective_to) < new Date()
            ).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">Avg Commission %</p>
          <p className="text-2xl font-bold dark:text-white">
            {rateCards.length
              ? (
                  rateCards.reduce(
                    (sum, c) => sum + (c.commission_percent || 0),
                    0
                  ) / rateCards.length
                ).toFixed(1)
              : "0"}
          </p>
        </div>
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
              mode: editingCard ? "edit" : "create" as const,
              gst_percent: editingCard.gst_percent ? parseFloat(editingCard.gst_percent) : 18,
              tcs_percent: editingCard.tcs_percent ? parseFloat(editingCard.tcs_percent) : 1,
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
              <th className="px-4 py-2 text-left dark:text-white">Valid From</th>
              <th className="px-4 py-2 text-left dark:text-white">Valid To</th>
              <th className="px-4 py-2 dark:text-white"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center p-4 dark:text-gray-300">
                  Loading…
                </td>
              </tr>
            ) : rateCards.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center p-4 dark:text-gray-300">
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
                  <td className="px-4 py-2 dark:text-gray-300">{card.effective_from}</td>
                  <td className="px-4 py-2 dark:text-gray-300">{card.effective_to || "-"}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => {
                        setEditingCard(card);
                        setShowForm(true);
                      }}
                      className="text-teal-600 hover:underline text-sm"
                    >
                      Edit
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