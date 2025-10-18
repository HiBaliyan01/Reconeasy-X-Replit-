// client/src/pages/RateCardV2Page.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Info } from "lucide-react";
import { invokeSupabaseFunction } from "@/utils/supabaseFunctions";

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
  archived?: boolean;
}

export default function RateCardV2Page() {
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [filteredCards, setFilteredCards] = useState<RateCard[]>([]);
  const [metrics, setMetrics] = useState<any>({ 
    total: 0, 
    active: 0, 
    expired: 0, 
    upcoming: 0, 
    archived: 0,
    avg_flat_commission: 0, 
    flat_count: 0 
  });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<RateCard | null>(null);
  const [showCalc, setShowCalc] = useState(false);
  const [calcPreset, setCalcPreset] = useState<{platform?: string; category?: string; cardId?: string}>({});
  const [updatingMap, setUpdatingMap] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const searchDebounceRef = useRef<number | null>(null);

  const defaultMetrics = (list: RateCard[]) => ({ total: list.length, active: 0, expired: 0, upcoming: 0, archived: 0, avg_flat_commission: 0, flat_count: 0 });
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
      const payload = await invokeSupabaseFunction<{ data?: RateCard[]; metrics?: any }>("rate-cards-v2");
      console.debug("[rate-cards-v2] payload", payload);
      const list: RateCard[] = Array.isArray(payload?.data) ? payload.data : [];
      const m = payload?.metrics && typeof payload.metrics === "object" ? payload.metrics : defaultMetrics(list);
      const normalised = list.map((card) => ({
        ...card,
        archived: Boolean((card as any).archived ?? false),
      }));
      setRateCards(normalised);
      const initialView = normalised.filter((card) => (showArchivedOnly ? card.archived : !card.archived));
      setFilteredCards(initialView);
      setMetrics({ ...defaultMetrics(normalised), ...(m ?? {}) });
    } catch (err) {
      console.error("Failed to fetch rate cards", err);
      setRateCards([]);
      setFilteredCards([]);
      setMetrics(defaultMetrics([]));
      showToast((err as any)?.message || "Failed to fetch rate cards");
    } finally {
      setLoading(false);
    }
  };

  const resolveStatus = useCallback((card: RateCard): "active" | "expired" | "upcoming" => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = card.effective_from ? new Date(card.effective_from) : today;
    from.setHours(0, 0, 0, 0);
    const to = card.effective_to ? new Date(card.effective_to) : null;
    if (from.getTime() > today.getTime()) {
      return "upcoming";
    }
    if (to) {
      to.setHours(0, 0, 0, 0);
      if (today.getTime() > to.getTime()) {
        return "expired";
      }
    }
    return "active";
  }, []);

  useEffect(() => {
    fetchCards();
  }, []);

useEffect(() => {
  const query = searchValue.trim().toLowerCase();
  const base = rateCards.filter((card) => (showArchivedOnly ? card.archived : !card.archived));

  if (!query) {
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    setFilteredCards(base);
    return;
  }

  if (searchDebounceRef.current) {
    window.clearTimeout(searchDebounceRef.current);
  }

  searchDebounceRef.current = window.setTimeout(() => {
    const results = base.filter((card) => {
      const platform = (card.platform_name || card.platform_id || "").toLowerCase();
      const category = (card.category_name || card.category_id || "").toLowerCase();
      const commissionLabel = card.commission_type === "flat"
        ? `flat (${card.commission_percent ?? ""}%)`
        : "tiered";
      const statusLabel = card.archived ? "archived" : resolveStatus(card);
      return (
        platform.includes(query) ||
        category.includes(query) ||
        commissionLabel.toLowerCase().includes(query) ||
        statusLabel.toLowerCase().includes(query)
      );
    });
    setFilteredCards(results);
    searchDebounceRef.current = null;
  }, 300);

  return () => {
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
  };
}, [searchValue, rateCards, resolveStatus, showArchivedOnly]);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => () => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
  }, []);

  const setUpdatingState = useCallback((id: string, value: boolean) => {
    setUpdatingMap((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleArchiveToggle = useCallback(
    async (card: RateCard, archived: boolean) => {
      setUpdatingState(card.id, true);
      const previousCards = rateCards;
      try {
        const optimisticList = rateCards.map((item) =>
          item.id === card.id ? { ...item, archived } : item
        );
        setRateCards(optimisticList);

        const query = searchValue.trim().toLowerCase();
        const base = optimisticList.filter((rc) => (showArchivedOnly ? rc.archived : !rc.archived));
        if (!query) {
          setFilteredCards(base);
        } else {
          const filtered = base.filter((rc) => {
            const platform = (rc.platform_name || rc.platform_id || "").toLowerCase();
            const category = (rc.category_name || rc.category_id || "").toLowerCase();
            const commissionLabel = rc.commission_type === "flat"
              ? `flat (${rc.commission_percent ?? ""}%)`
              : "tiered";
            const statusLabel = rc.archived ? "archived" : resolveStatus(rc);
            return (
              platform.includes(query) ||
              category.includes(query) ||
              commissionLabel.toLowerCase().includes(query) ||
              statusLabel.toLowerCase().includes(query)
            );
          });
          setFilteredCards(filtered);
        }

        const optimisticMetrics = (() => {
          const total = optimisticList.length;
          const archivedCount = optimisticList.filter((rc) => rc.archived).length;
          const active = optimisticList.filter((rc) => !rc.archived && resolveStatus(rc) === "active").length;
          const expired = optimisticList.filter((rc) => !rc.archived && resolveStatus(rc) === "expired").length;
          const upcoming = optimisticList.filter((rc) => !rc.archived && resolveStatus(rc) === "upcoming").length;
          const flatCards = optimisticList.filter((rc) => rc.commission_type === "flat" && typeof rc.commission_percent === "number");
          const flatSum = flatCards.reduce((sum, rc) => sum + (rc.commission_percent ?? 0), 0);
          const flatCount = flatCards.length;
          const avgFlat = flatCount ? Number((flatSum / flatCount).toFixed(2)) : 0;
          return {
            total,
            active,
            expired,
            upcoming,
            archived: archivedCount,
            avg_flat_commission: avgFlat,
            flat_count: flatCount,
          };
        })();
        setMetrics(optimisticMetrics);

        await invokeSupabaseFunction<{ id?: string }>(
          `rate-cards-v2/${card.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archived }),
          }
        );

        await fetchCards();
        showToast("Updated 1 card(s)");
      } catch (error: any) {
        console.error("Failed to update archive state", error);
        const message = error?.message || "Failed to update card";
        showToast(!archived && error?.status === 400 ? message || "Restore failed" : message);
        setRateCards(previousCards);
        await fetchCards();
      } finally {
        setUpdatingState(card.id, false);
      }
    },
    [
      fetchCards,
      setUpdatingState,
      showToast,
      rateCards,
      resolveStatus,
      searchValue,
      showArchivedOnly,
    ]
  );

  const handleSaved = () => {
    setShowForm(false);
    setEditingCard(null);
    fetchCards();
  };

  const tileToneClasses: Record<string, string> = {
    primary:
      "border-emerald-200 bg-emerald-50/40 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/15 dark:text-emerald-200",
    success:
      "border-emerald-200 bg-emerald-50/40 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/15 dark:text-emerald-200",
    neutral:
      "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200",
    info:
      "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-900/20 dark:text-sky-200",
    danger:
      "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-200",
  };

  const metricTiles = useMemo(
    () => [
      { key: "total", label: "Total Rate Cards", value: metrics.total ?? 0, tone: "primary" },
      { key: "active", label: "Active", value: metrics.active ?? 0, tone: "success" },
      { key: "expired", label: "Expired", value: metrics.expired ?? 0, tone: "danger" },
      { key: "upcoming", label: "Upcoming", value: metrics.upcoming ?? 0, tone: "info" },
      { key: "archived", label: "Archived", value: metrics.archived ?? 0, tone: "neutral" },
      {
        key: "avg",
        label: "Avg Commission % (Flat)",
        value: metrics.avg_flat_commission ?? 0,
        displayValue: (() => {
          const num = Number(metrics.avg_flat_commission ?? 0);
          return Number.isFinite(num) ? (Number.isInteger(num) ? num.toString() : num.toFixed(2)) : "0";
        })(),
        tone: "primary",
        subLabel: `(${metrics.flat_count ?? 0})`,
      },
    ],
    [metrics]
  );

  return (
    <>
      <div className="space-y-6">
      {/* Header */}
      <RateCardHeader title="Rate Cards" />

      {/* Summary metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metricTiles.map((tile) => (
          <div
            key={tile.key}
            className={`rounded-xl border px-4 py-3 text-center shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow ${tileToneClasses[tile.tone]}`}
          >
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{tile.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
              {tile.key === "avg" ? `${tile.displayValue}` : tile.value}
              {tile.key === "avg" && (
                <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">{tile.subLabel}</span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Actions */}
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6 mb-3">
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

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-center lg:flex-1 lg:justify-center xl:justify-end">
          <div className="relative w-full sm:w-96 lg:max-w-xs">
            <input
              type="text"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search marketplace, category, commission, status…"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 pr-8 text-sm text-slate-700 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => setSearchValue("")}
                className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowArchivedOnly((prev) => !prev)}
            aria-pressed={showArchivedOnly}
            className={`ml-0 sm:ml-3 inline-flex items-center justify-center h-9 px-3 rounded-xl text-sm font-medium transition ${
              showArchivedOnly
                ? 'bg-teal-600 text-white hover:bg-teal-700'
                : 'border border-slate-200 bg-slate-100 text-slate-600 hover:border-slate-300 hover:bg-slate-200'
            }`}
          >
            {showArchivedOnly ? 'Show all' : 'Show only archived'}
          </button>
        </div>
      </div>



      {/* Rate Card List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden border border-slate-200 dark:border-slate-700">
        {showArchivedOnly && (
          <div className="flex items-start gap-2 border-b border-sky-200 bg-sky-50 text-sky-800 px-4 py-2">
            <Info className="h-4 w-4 mt-0.5" />
            <span className="text-sm">
              Archived cards are stored for history and won’t be used for reconciliation.
            </span>
          </div>
        )}
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700">
            <tr>
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
              <tr><td colSpan={7} className="p-4 text-center">Loading…</td></tr>
            ) : filteredCards.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8">
                  <div className="text-center space-y-3">
                    <p className="text-slate-600 dark:text-slate-300">
                      {rateCards.length === 0
                        ? "No rate cards yet. Add your first one."
                        : "No rate cards match your search."}
                    </p>
                    {rateCards.length === 0 && (
                      <button
                        onClick={() => { setShowForm(true); setEditingCard(null); }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-sm hover:shadow"
                      >
                        <Plus className="w-4 h-4" />
                        Add New Rate Card
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredCards.map(card => {
                const isArchived = Boolean(card.archived);
                const isUpdating = updatingMap[card.id];
                const displayStatus = resolveStatus(card);
                return (
                <tr key={card.id} className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-slate-50 hover:dark:bg-slate-800">
                  <td className="px-4 py-2">{card.platform_name || card.platform_id || "-"}</td>
                  <td className="px-4 py-2">{card.category_name || card.category_id || "-"}</td>
                  <td className="px-4 py-2">{card.commission_type === "flat" ? `${card.commission_percent ?? 0}%` : "Tiered"}</td>
                  <td className="px-4 py-2">
                    {isArchived ? (
                      <span className="inline-flex items-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 text-xs font-medium">
                        Archived
                      </span>
                    ) : (
                      <RateCardStatusIndicator
                        status={displayStatus}
                        animate={false}
                        size="sm"
                      />
                    )}
                  </td>
                  <td className="px-4 py-2">{card.effective_from}</td>
                  <td className="px-4 py-2">{card.effective_to || "-"}</td>
                  <td className="px-4 py-2 text-right flex gap-3 justify-end">
                    <button
                      className={`text-teal-600 hover:underline text-sm ${isArchived ? 'opacity-40 cursor-not-allowed' : ''}`}
                      disabled={isArchived}
                      onClick={async () => {
                        try {
                          const supabaseCard = await invokeSupabaseFunction<any>(`rate-cards-v2/${card.id}`);
                          if (!supabaseCard || typeof supabaseCard !== "object") {
                            throw new Error("Failed to load rate card");
                          }
                          setEditingCard(supabaseCard);
                          setShowForm(true);
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
                      className={`text-indigo-600 hover:underline text-sm ${isArchived ? 'opacity-40 cursor-not-allowed' : ''}`}
                      disabled={isArchived}
                      onClick={() => {
                        setCalcPreset({ platform: card.platform_id, category: card.category_id, cardId: card.id });
                        setShowCalc(true);
                      }}
                    >
                      Test
                    </button>

                    <button
                      className={`text-sm ${isArchived ? 'text-emerald-600' : 'text-rose-600'} hover:underline disabled:opacity-40 disabled:cursor-not-allowed`}
                      disabled={isUpdating}
                      onClick={() => handleArchiveToggle(card, !isArchived)}
                    >
                      {isUpdating ? 'Updating…' : isArchived ? 'Restore' : 'Archive'}
                    </button>
                  </td>
                </tr>
              );
              })
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
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-40 rounded-lg bg-slate-900 text-white px-4 py-2 shadow-lg text-sm">
          {toastMessage}
        </div>
      )}
    </>
  );
}
