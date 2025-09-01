import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

type Fee = { fee_code: string; fee_type: "percent" | "amount"; fee_value: number };
type Slab = { min_price: number; max_price: number | null; commission_percent: number };

type RateCardLite = {
  id: string;
  platform_id: string;
  category_id: string;
  commission_type: "flat" | "tiered";
  commission_percent?: number | null;
  effective_from: string;
  effective_to?: string | null;
  status: "active" | "expired" | "upcoming";
  // If your list endpoint already enriches names, you can use platform_name/category_name in the UI
  platform_name?: string;
  category_name?: string;
};

type RateCardFull = RateCardLite & {
  gst_percent: number;
  tcs_percent: number;
  fees: Fee[];
  slabs: Slab[];
};

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

export default function ReconciliationCalculator({ rateCards: injected }: { rateCards?: RateCardLite[] }) {
  // If parent passes list, use it; else fetch
  const [list, setList] = useState<RateCardLite[]>(injected || []);
  const [loadingList, setLoadingList] = useState(!injected);

  // Selection state
  const [platform, setPlatform] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [cardId, setCardId] = useState<string>("");

  // Detailed card (fees, slabs, taxes)
  const [card, setCard] = useState<RateCardFull | null>(null);
  const [loadingCard, setLoadingCard] = useState(false);

  // Inputs
  const [price, setPrice] = useState<number>(0);
  const [qty, setQty] = useState<number>(1);

  // Fetch list if not injected
  useEffect(() => {
    if (injected) return;
    (async () => {
      try {
        const res = await axios.get("/api/rate-cards"); // returns { data, metrics }
        setList(res.data?.data || []);
      } finally {
        setLoadingList(false);
      }
    })();
  }, [injected]);

  // Build filters from list
  const platforms = useMemo(() => {
    const set = new Set(list.map((r) => r.platform_id));
    return Array.from(set);
  }, [list]);
  const categories = useMemo(() => {
    const set = new Set(list.filter((r) => (platform ? r.platform_id === platform : true)).map((r) => r.category_id));
    return Array.from(set);
  }, [list, platform]);

  const filteredCards = useMemo(() => {
    return list.filter(
      (r) => (!platform || r.platform_id === platform) && (!category || r.category_id === category)
    );
  }, [list, platform, category]);

  // Default selections when list loads
  useEffect(() => {
    if (!loadingList && list.length) {
      // pick first platform/category if none chosen
      if (!platform) setPlatform(list[0].platform_id);
    }
  }, [loadingList, list]); // eslint-disable-line

  useEffect(() => {
    if (platform && categories.length && !categories.includes(category)) {
      setCategory(categories[0] || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, categories.join("|")]);

  // Default card choice = latest Active, else most recent Expired/Upcoming by effective_from
  useEffect(() => {
    const pool = filteredCards;
    if (!pool.length) {
      setCardId("");
      setCard(null);
      return;
    }
    // If current selection still valid keep it
    if (cardId && pool.some((c) => c.id === cardId)) return;

    const active = pool.filter((c) => c.status === "active");
    const pickFrom = active.length ? active : pool;
    const latest = [...pickFrom].sort(
      (a, b) => +new Date(b.effective_from) - +new Date(a.effective_from)
    )[0];
    setCardId(latest.id);
  }, [filteredCards]); // eslint-disable-line

  // Fetch full card details whenever cardId changes
  useEffect(() => {
    if (!cardId) {
      setCard(null);
      return;
    }
    setLoadingCard(true);
    axios
      .get(`/api/rate-cards/${cardId}`)
      .then((res) => setCard(res.data))
      .finally(() => setLoadingCard(false));
  }, [cardId]);

  // ------ Calculation helpers ------
  function commissionPercentFor(price: number, rc: RateCardFull): number {
    if (rc.commission_type === "flat") {
      return Number(rc.commission_percent || 0);
    }
    // tiered: find matching slab
    const slab = (rc.slabs || []).find((s) => {
      const minOk = price >= (s.min_price ?? 0);
      const maxOk = s.max_price == null ? true : price < s.max_price;
      return minOk && maxOk;
    });
    return slab ? Number(slab.commission_percent) : 0;
  }

  function computeBreakdown(): {
    gross: number;
    commissionPct: number;
    commission: number;
    fees: { label: string; value: number }[];
    feesTotal: number;
    gst: number;
    tcs: number;
    net: number;
  } | null {
    if (!card || price <= 0 || qty <= 0) return null;

    const gross = price * qty;
    const commissionPct = commissionPercentFor(price, card);
    const commission = (commissionPct / 100) * gross;

    const feesRows = (card.fees || []).map((f) => {
      const base = f.fee_type === "percent" ? (f.fee_value / 100) * gross : f.fee_value * qty;
      const label =
        f.fee_code === "fixed"
          ? "Fixed Fee"
          : f.fee_code === "collection"
          ? "Collection/COD Fee"
          : f.fee_code === "tech"
          ? "Tech/Closing Fee"
          : f.fee_code === "storage"
          ? "Storage Fee"
          : f.fee_code === "rto"
          ? "RTO Fee"
          : f.fee_code === "packaging"
          ? "Packaging Fee"
          : "Shipping Fee";
      return { label, value: base };
    });
    const feesTotal = feesRows.reduce((s, x) => s + x.value, 0);

    // Assumptions (documented in UI):
    // GST applies to (commission + fees)
    // TCS applies to gross
    const gst = ((card.gst_percent || 0) / 100) * (commission + feesTotal);
    const tcs = ((card.tcs_percent || 0) / 100) * gross;

    const net = gross - commission - feesTotal - gst - tcs;

    return {
      gross,
      commissionPct,
      commission,
      fees: feesRows,
      feesTotal,
      gst,
      tcs,
      net,
    };
  }

  const result = useMemo(() => computeBreakdown(), [card, price, qty]);

  // ------ UI ------
  if (loadingList) return <div className="text-sm text-slate-500">Loading rate cards…</div>;

  if (!list.length) {
    return (
      <div className="text-sm text-slate-500">
        No Rate Cards Found. Add a card first to use the calculator.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">Reconciliation Calculator</h3>
        <p className="text-xs text-slate-500">
          Assumptions: GST on (commission + fees); TCS on gross.
        </p>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600">Platform</label>
          <select
            value={platform}
            onChange={(e) => {
              setPlatform(e.target.value);
              setCategory("");
              setCardId("");
            }}
            className="mt-1 w-full rounded-xl border-slate-200 focus:border-teal-500 focus:ring-teal-500/30"
          >
            {platforms.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABELS[p] ?? p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600">Category</label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setCardId("");
            }}
            className="mt-1 w-full rounded-xl border-slate-200 focus:border-teal-500 focus:ring-teal-500/30"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c] ?? c}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600">Rate Card</label>
          <select
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
            className="mt-1 w-full rounded-xl border-slate-200 focus:border-teal-500 focus:ring-teal-500/30"
          >
            {filteredCards.map((c) => (
              <option key={c.id} value={c.id}>
                {`${PLATFORM_LABELS[c.platform_id] ?? c.platform_id} • ${CATEGORY_LABELS[c.category_id] ?? c.category_id} • ${c.status} • From ${c.effective_from}`}
              </option>
            ))}
          </select>
          {loadingCard && <p className="text-xs text-slate-400 mt-1">Loading rate card…</p>}
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600">Product Price (₹)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border-slate-200 focus:border-teal-500 focus:ring-teal-500/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Quantity</label>
          <input
            type="number"
            min={1}
            step="1"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border-slate-200 focus:border-teal-500 focus:ring-teal-500/30"
          />
        </div>
      </div>

      {/* Breakdown */}
      {!card ? (
        <div className="text-sm text-slate-500">Select a rate card to calculate.</div>
      ) : !result ? (
        <div className="text-sm text-slate-500">Enter price and quantity to calculate.</div>
      ) : (
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Gross (₹)</p>
              <p className="text-slate-900 font-semibold">{result.gross.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500">Commission ({result.commissionPct.toFixed(2)}%)</p>
              <p className="text-slate-900 font-semibold">₹ {result.commission.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500">Fees Total (₹)</p>
              <p className="text-slate-900 font-semibold">₹ {result.feesTotal.toFixed(2)}</p>
            </div>
            <div className="md:col-span-3">
              <details>
                <summary className="cursor-pointer text-slate-600">View fee breakdown</summary>
                <ul className="mt-2 list-disc pl-5 text-slate-700">
                  {result.fees.map((f, i) => (
                    <li key={i}>
                      {f.label}: ₹ {f.value.toFixed(2)}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
            <div>
              <p className="text-slate-500">GST (₹)</p>
              <p className="text-slate-900 font-semibold">₹ {result.gst.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500">TCS (₹)</p>
              <p className="text-slate-900 font-semibold">₹ {result.tcs.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500">Net Payout (₹)</p>
              <p className="text-slate-900 font-bold">₹ {result.net.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}