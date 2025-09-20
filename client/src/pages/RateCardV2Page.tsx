// client/src/pages/RateCardV2Page.tsx
import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import axios from "axios";

import { RateCardHeader } from "@/components/RateCardHeader";
import Modal from "@/components/ui/Modal";
import RateCardFormV2 from "@/components/RateCardFormV2Compact";
import UploadWidget from "@/pages/RateCards/UploadWidget";
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

interface RateCardFee {
  id: string;
  rate_card_id: string;
  fee_code: string;
  fee_type: "percent" | "amount";
  fee_value: number | null;
}

interface RateCardSlab {
  id: string;
  rate_card_id: string;
  min_price: number | null;
  max_price: number | null;
  commission_percent: number | null;
}

interface RateCard {
  id: string;
  platform_id: string;
  category_id: string;
  platform_name?: string;
  category_name?: string;
  commission_type: "flat" | "tiered";
  commission_percent: number | null;
  effective_from: string;
  effective_to?: string | null;
  gst_percent?: number | null;
  tcs_percent?: number | null;
  settlement_basis?: string | null;
  t_plus_days?: number | null;
  weekly_weekday?: number | null;
  bi_weekly_weekday?: number | null;
  bi_weekly_which?: string | null;
  monthly_day?: string | null;
  grace_days?: number;
  global_min_price?: number | null;
  global_max_price?: number | null;
  notes?: string | null;
  status?: string;
  fees?: RateCardFee[];
  slabs?: RateCardSlab[];
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });

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
      const res = await axios.get("/api/rate-cards-v2", { validateStatus: () => true });
      if (res.status >= 200 && res.status < 300) {
        const payload = res.data;
        const list: RateCard[] = Array.isArray(payload?.data) ? payload.data : [];
        const m = payload?.metrics && typeof payload.metrics === "object" ? payload.metrics : defaultMetrics(list);
        setRateCards(list);
        setMetrics(m);
      } else {
        throw new Error(`Request failed with status ${res.status}`);
      }
    } catch (err) {
      console.error("Failed to fetch rate cards", err);
      setRateCards([]);
      setMetrics(defaultMetrics([]));
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

      {/* Delete confirmation modal */}
      <Modal
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open:false, ids:[] })}
        title="Confirm Deletion"
        size="sm"
        hideClose
      >
        <div className="p-2 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to delete {confirmDelete.ids.length} rate card{confirmDelete.ids.length!==1?'s':''}? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={()=>setConfirmDelete({ open:false, ids:[] })} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">Cancel</button>
            <button
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white"
              onClick={async () => {
                const ids = [...confirmDelete.ids];
                setConfirmDelete({ open: false, ids: [] });
                if (!ids.length) return;
                try {
                  await Promise.all(
                    ids.map((id) =>
                      axios.delete(`/api/rate-cards-v2/${id}`, { validateStatus: () => true })
                    )
                  );
                } catch (error) {
                  console.error("Failed to delete rate cards", error);
                }
                setSelectedIds([]);
                await fetchCards();
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Actions */}
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => {
            setShowForm(true);
            setEditingCard(null);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-sm hover:shadow transition"
        >
          <Plus className="w-4 h-4" />
          Add New Rate Card
        </button>

        <div className="flex items-center gap-3">
          {/* Selected count chip (only when selecting) */}
          {selectedIds.length > 0 && (
            <span className="hidden sm:inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium border-teal-200 text-teal-700 dark:border-teal-800 dark:text-teal-300 bg-teal-50/70 dark:bg-teal-900/20">
              {selectedIds.length} selected
            </span>
          )}

          {/* Bulk delete */}
          <button
            disabled={selectedIds.length === 0}
            onClick={() => selectedIds.length>0 && setConfirmDelete({ open:true, ids:[...selectedIds] })}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${selectedIds.length === 0 ? 'bg-slate-200 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-rose-500 to-rose-600 text-white hover:from-rose-600 hover:to-rose-700 shadow-sm hover:shadow'}`}
            title={selectedIds.length === 0 ? 'Select rows to enable' : 'Delete selected'}
          >
            {/* Trash icon (inline SVG to avoid extra import) */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M9 3a1 1 0 0 0-1 1v1H5.5a1 1 0 1 0 0 2H6v11a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7h.5a1 1 0 1 0 0-2H16V4a1 1 0 0 0-1-1H9Zm2 2h2V4h-2v1ZM8 7h8v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V7Zm2.5 2a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0v-6a1 1 0 0 0-1-1Zm4 0a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0v-6a1 1 0 0 0-1-1Z"/></svg>
            Delete Selected
          </button>
        </div>
      </div>



      {/* Rate Card List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden border border-slate-200 dark:border-slate-700">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700">
            <tr>
              <th className="px-3 py-2 text-left w-10">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={rateCards.length > 0 && selectedIds.length === rateCards.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(rateCards.map((r) => r.id));
                    else setSelectedIds([]);
                  }}
                  className="h-4 w-4 accent-teal-600 dark:accent-teal-400"
                />
              </th>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-white">Platform</th>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-white">Category</th>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-white">Commission</th>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-white">Status</th>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-white">Valid From</th>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-white">Valid To</th>
              <th className="px-4 py-2 text-slate-700 dark:text-white"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-4 text-center">Loading…</td></tr>
            ) : rateCards.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8">
                  <div className="text-center space-y-3">
                    <p className="text-slate-600 dark:text-slate-300">No rate cards yet. Add your first one.</p>
                    <button
                      onClick={() => { setShowForm(true); setEditingCard(null); }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-sm hover:shadow"
                    >
                      <Plus className="w-4 h-4" />
                      Add New Rate Card
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              rateCards.map(card => (
                <tr key={card.id} className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-slate-50 hover:dark:bg-slate-800">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(card.id)}
                      onChange={(e) => {
                        setSelectedIds((prev) => {
                          const set = new Set(prev);
                          if (e.target.checked) set.add(card.id); else set.delete(card.id);
                          return Array.from(set);
                        });
                      }}
                      aria-label={`Select ${card.platform_id} - ${card.category_id}`}
                      className="h-4 w-4 accent-teal-600 dark:accent-teal-400"
                    />
                  </td>
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
                          const res = await axios.get(`/api/rate-cards-v2/${card.id}`, {
                            validateStatus: () => true,
                          });
                          if (res.status >= 200 && res.status < 300) {
                            const data = res.data && typeof res.data === "object" ? res.data : null;
                            if (!data) throw new Error('Empty response');
                            setEditingCard(data);
                            setShowForm(true);
                          } else {
                            throw new Error(`HTTP ${res.status}`);
                          }
                        } catch (error) {
                          console.error('Failed to load rate card', error);
                          alert('Failed to load rate card. Please try again.');
                          setEditingCard(null);
                        }
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
                      onClick={() => setConfirmDelete({ open:true, ids:[card.id] })}
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
      <UploadWidget onImportComplete={handleSaved} />



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
            gst_percent: typeof editingCard.gst_percent === "number" ? editingCard.gst_percent : 18,
            tcs_percent: typeof editingCard.tcs_percent === "number" ? editingCard.tcs_percent : 1,
            settlement_basis: (editingCard.settlement_basis as "t_plus" | "weekly" | "bi_weekly" | "monthly") || "t_plus",
            slabs: editingCard.slabs ?? [],
            fees: editingCard.fees ?? []
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
