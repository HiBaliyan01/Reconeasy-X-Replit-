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

  if (loading) return <div>Loading…</div>;
  if (!rateCards.length) {
    return (
      <div className="text-slate-500 text-sm">
        No Rate Cards Found
      </div>
    );
  }

  // …your existing calculator UI/logic using `rateCards`
  return <div className="text-sm text-slate-600">Calculator ready with {rateCards.length} rate cards.</div>;
}