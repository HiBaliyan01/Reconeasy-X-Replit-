// client/src/pages/RateCardV2Page.tsx
import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import axios from "axios";

import { RateCardHeader } from "@/components/RateCardHeader";
import Modal from "@/components/ui/Modal";
import RateCardFormV2 from "@/components/RateCardFormV2Compact";
import RateCardUploader from "@/components/RateCardUploader";
import ReconciliationCalculator from "@/components/ReconciliationCalculator";
import RateCardStatusIndicator from "@/components/RateCardStatusIndicator";

const PLATFORM_LABELS: Record<string, string> = {
  amazon: "Amazon",
  flipkart: "Flipkart",
  myntra: "Myntra",
  ajio: "AJIO",
  quick: "Quick Commerce",
};

const CATEGORY_LABELS: Record<string, string> = {
  apparel: "Apparel",
  electronics: "Electronics",
  beauty: "Beauty",
  home: "Home",
};


interface RateCard {
  id: string;
  platform_id: string;
  category_id: string;
  platform_name?: string;
  category_name?: string;
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
  const [showCalc, setShowCalc] = useState(false);
  const [calcPreset, setCalcPreset] = useState<{platform?: string; category?: string; cardId?: string}>({});

  // --- Local persistence helpers (fallback when API is unavailable) ---
  const LS_KEY = 're_rate_cards_v2';
  const readLocal = (): { data: RateCard[]; metrics: any } => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return { data: [], metrics: defaultMetrics([]) };
      const parsed = JSON.parse(raw);
      const arr: RateCard[] = Array.isArray(parsed?.data) ? parsed.data : [];
      return { data: arr, metrics: computeMetrics(arr) };
    } catch (_) {
      return { data: [], metrics: defaultMetrics([]) };
    }
  };
  const writeLocal = (arr: RateCard[]) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ data: arr }));
    } catch (_) {}
  };
  const upsertLocal = (card: any) => {
    const cur = readLocal().data;
    const idx = cur.findIndex((c) => c.id === card.id);
    if (idx >= 0) cur[idx] = { ...cur[idx], ...card } as any;
    else cur.push(card as any);
    writeLocal(cur);
  };
  const deleteLocal = (id: string) => {
    const cur = readLocal().data.filter((c) => c.id !== id);
    writeLocal(cur);
  };

  const defaultMetrics = (list: RateCard[]) => ({ total: list.length, active: 0, expired: 0, upcoming: 0, avg_flat_commission: 0, flat_count: 0 });
  const computeMetrics = (list: RateCard[]) => {
    const total = list.length;
    const flat = list.filter((r: any) => r.commission_type === 'flat' && typeof r.commission_percent === 'number');
    const flat_count = flat.length;
    const avg_flat_commission = flat_count ? Math.round((flat.reduce((s, r) => s + (r.commission_percent || 0), 0) / flat_count) * 100) / 100 : 0;
    // naive status based on dates
    const today = new Date().toISOString().slice(0, 10);
    let active = 0, expired = 0, upcoming = 0;
    list.forEach((r: any) => {
      const from = r.effective_from || today;
      const to = r.effective_to || '9999-12-31';
      if (today < from) upcoming++; else if (today > to) expired++; else active++;
    });
    return { total, active, expired, upcoming, avg_flat_commission, flat_count };
  };

  const fetchCards = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/rate-cards", { validateStatus: () => true });
      // Normalize response to avoid crashes on static hosting (404 HTML)
      let list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      let m = res.data && typeof res.data === 'object' && res.data.metrics ? res.data.metrics : defaultMetrics(list);
      if (!list.length) {
        const local = readLocal();
        list = local.data;
        m = local.metrics;
      }
      setRateCards(list);
      setMetrics(m);
    } catch (err) {
      console.error("Failed to fetch rate cards", err);
      const local = readLocal();
      setRateCards(local.data);
      setMetrics(local.metrics);
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
      <RateCardHeader title="Rate Cards" />

      {/* Summary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl shadow text-center border border-slate-200 dark:border-slate-700 bg-emerald-50/40 dark:bg-emerald-900/15">
          <p className="text-sm text-slate-600 dark:text-slate-300">Total Rate Cards</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.total}</p>
        </div>
        <div className="p-4 rounded-xl shadow text-center border border-slate-200 dark:border-slate-700 bg-emerald-50/40 dark:bg-emerald-900/15">
          <p className="text-sm text-slate-600 dark:text-slate-300">Active</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.active}</p>
        </div>
        <div className="p-4 rounded-xl shadow text-center border border-slate-200 dark:border-slate-700 bg-emerald-50/40 dark:bg-emerald-900/15">
          <p className="text-sm text-slate-600 dark:text-slate-300">Expired</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.expired}</p>
        </div>
        <div className="p-4 rounded-xl shadow text-center border border-slate-200 dark:border-slate-700 bg-emerald-50/40 dark:bg-emerald-900/15">
          <p className="text-sm text-slate-600 dark:text-slate-300">Upcoming</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.upcoming}</p>
        </div>
        <div className="p-4 rounded-xl shadow text-center border border-slate-200 dark:border-slate-700 bg-emerald-50/40 dark:bg-emerald-900/15">
          <p className="text-sm text-slate-600 dark:text-slate-300">Avg Commission % (Flat)</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
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
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden border border-slate-200 dark:border-slate-700">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-850">
            <tr>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">Platform</th>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">Category</th>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">Commission</th>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">Status</th>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">Valid From</th>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">Valid To</th>
              <th className="px-4 py-2 text-slate-700 dark:text-slate-200"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-4 text-center">Loading…</td></tr>
            ) : rateCards.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center">No rate cards.</td></tr>
            ) : (
              rateCards.map(card => (
                <tr key={card.id} className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-slate-50 hover:dark:bg-slate-800">
                  <td className="px-4 py-2">{card.platform_name || card.platform_id || "-"}</td>
                  <td className="px-4 py-2">{card.category_name || card.category_id || "-"}</td>
                  <td className="px-4 py-2">{card.commission_type === "flat" ? `${card.commission_percent ?? 0}%` : "Tiered"}</td>
                  <td className="px-4 py-2">
                    <RateCardStatusIndicator
                      status={card.status as 'active' | 'expired' | 'upcoming'}
                      animate={false}
                      size="sm"
                    />
                  </td>
                  <td className="px-4 py-2">{card.effective_from}</td>
                  <td className="px-4 py-2">{card.effective_to || "-"}</td>
                  <td className="px-4 py-2 text-right flex gap-3 justify-end">
                    <button
                      className="text-teal-600 hover:underline text-sm"
                      onClick={async () => {
                        try {
                          const res = await axios.get(`/api/rate-cards/${card.id}`, { validateStatus: () => true });
                          const data = res.data && typeof res.data === 'object' ? res.data : null;
                          setEditingCard(data);
                        } catch (_) {
                          // fallback to local
                          const local = readLocal().data.find((c) => c.id === card.id) || null;
                          setEditingCard(local as any);
                        }
                        setShowForm(true);
                      }}
                    >
                      Edit
                    </button>

                    <button
                      className="text-indigo-600 hover:underline text-sm"
                      onClick={() => {
                        setCalcPreset({ platform: card.platform_id, category: card.category_id, cardId: card.id });
                        setShowCalc(true);
                      }}
                    >
                      Test
                    </button>

                    <button
                      className="text-rose-600 hover:underline text-sm"
                      onClick={async () => {
                        if (!confirm("Delete this rate card?")) return;
                        // Optimistic local update first (works with localStorage fallback)
                        try {
                          deleteLocal(card.id);
                          const next = rateCards.filter((c) => c.id !== card.id);
                          setRateCards(next as any);
                          setMetrics(computeMetrics(next as any));
                        } catch (_) {}
                        // Fire-and-forget server delete (may 404 in static preview)
                        try { await axios.delete(`/api/rate-cards/${card.id}`, { validateStatus: () => true }); } catch (_) {}
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
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Upload Rate Cards</h3>
          <a
            href="/templates/rate-cards-template.csv"
            className="text-teal-600 dark:text-teal-400 hover:underline text-sm"
            download="rate-card-template.csv"
            data-testid="download-csv-template"
          >
            Download CSV template
          </a>
        </div>
        <RateCardUploader onUploadSuccess={handleSaved} />
      </div>



      {/* Reconciliation Calculator */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow p-4">
        <ReconciliationCalculator rateCards={rateCards.map(card => ({
          ...card,
          status: card.status || 'active' as 'active' | 'expired' | 'upcoming'
        }))} />
      </div>

      {/* Modal for Add/Edit Rate Card */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingCard ? "Edit Rate Card" : "Add Rate Card"}
        hideClose
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
          onCancel={() => {
            setShowForm(false);
            setEditingCard(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditingCard(null);
            fetchCards();
          }}
        />
      </Modal>

      {/* Calculator Modal */}
      <Modal
        open={showCalc}
        onClose={() => setShowCalc(false)}
        title="Reconciliation Calculator"
        variant="modal"
        size="md"
      >
        <ReconciliationCalculator
          rateCards={rateCards}
          initialPlatform={calcPreset.platform}
          initialCategory={calcPreset.category}
          initialCardId={calcPreset.cardId}
          variant="compact"
        />
      </Modal>

    </div>
  );
}
