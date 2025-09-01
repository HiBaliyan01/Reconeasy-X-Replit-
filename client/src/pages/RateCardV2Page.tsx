// client/src/pages/RateCardV2Page.tsx
import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import axios from "axios";

import { RateCardHeader } from "@/components/RateCardHeader";
import Modal from "@/components/ui/Modal";
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
      <RateCardHeader onBack={() => window.history.back()} title="Rate Cards" />

      {/* Summary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl shadow text-center">
          <p className="text-sm text-slate-500">Total Rate Cards</p>
          <p className="text-2xl font-bold">{metrics.total}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow text-center">
          <p className="text-sm text-slate-500">Active</p>
          <p className="text-2xl font-bold">{metrics.active}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow text-center">
          <p className="text-sm text-slate-500">Expired</p>
          <p className="text-2xl font-bold">{metrics.expired}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow text-center">
          <p className="text-sm text-slate-500">Upcoming</p>
          <p className="text-2xl font-bold">{metrics.upcoming}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow text-center">
          <p className="text-sm text-slate-500">Avg Commission % (Flat)</p>
          <p className="text-2xl font-bold">
            {metrics.avg_flat_commission}
            <span className="text-xs text-slate-400"> ({metrics.flat_count})</span>
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
              <tr><td colSpan={6} className="p-4 text-center">Loading…</td></tr>
            ) : rateCards.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center">No rate cards.</td></tr>
            ) : (
              rateCards.map(card => (
                <tr key={card.id} className="border-t">
                  <td className="px-4 py-2">{card.platform_id}</td>
                  <td className="px-4 py-2">{card.category_id}</td>
                  <td className="px-4 py-2">{card.commission_type === "flat" ? `${card.commission_percent ?? 0}%` : "Tiered"}</td>
                  <td className="px-4 py-2 capitalize">{card.status}</td>
                  <td className="px-4 py-2">{card.effective_from}</td>
                  <td className="px-4 py-2">{card.effective_to || "-"}</td>
                  <td className="px-4 py-2 text-right flex gap-3 justify-end">
                    <button
                      className="text-teal-600 hover:underline text-sm"
                      onClick={async () => {
                        const res = await axios.get(`/api/rate-cards/${card.id}`);
                        setEditingCard(res.data);
                        setShowForm(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="text-rose-600 hover:underline text-sm"
                      onClick={async () => {
                        if (!confirm("Delete this rate card?")) return;
                        await axios.delete(`/api/rate-cards/${card.id}`);
                        fetchCards();
                      }}
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold dark:text-white">Upload Rate Cards</h3>
          <a
            href="/api/rate-cards/template.csv"
            className="text-teal-600 hover:underline text-sm"
            download="rate-card-template.csv"
            data-testid="download-csv-template"
          >
            Download CSV template
          </a>
        </div>
        <RateCardUploader onUploadSuccess={handleSaved} />
      </div>

      {/* Reconciliation Calculator — use the same list */}
      <ReconciliationCalculator rateCards={rateCards} />

      {/* Modal for Add/Edit Rate Card */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingCard ? "Edit Rate Card" : "Add Rate Card"}
        maxWidthClass="max-w-6xl"
      >
        <RateCardFormV2
          mode={editingCard ? "edit" : "create"}
          initialData={editingCard ? {
            ...editingCard,
            mode: "edit" as const,
            gst_percent: editingCard.gst_percent ? parseFloat(String(editingCard.gst_percent)) : 18,
            tcs_percent: editingCard.tcs_percent ? parseFloat(String(editingCard.tcs_percent)) : 1,
            settlement_basis: (editingCard.settlement_basis as "t_plus" | "weekly" | "bi_weekly" | "monthly") || "t_plus",
            slabs: [],
            fees: []
          } : undefined}
          onSaved={() => {
            setShowForm(false);
            setEditingCard(null);
            fetchCards();
          }}
        />
      </Modal>
    </div>
  );
}