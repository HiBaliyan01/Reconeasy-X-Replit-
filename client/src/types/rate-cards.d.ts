declare namespace RateCardImport {
  type RowStatus = "valid" | "similar" | "duplicate" | "error";

  interface ParseSummary {
    total: number;
    valid: number;
    similar: number;
    duplicate: number;
    error: number;
  }

  interface ParsedRow {
    row: number;
    row_id: string;
    status: RowStatus;
    message: string;
    tooltip?: string;
    existing?: {
      id: string;
      label: string;
      date_range: string;
    };
    archivedMatch?: {
      id: string;
      label: string;
      date_range: string;
      type: "exact" | "overlap";
    };
    suggestions?: Array<
      | { type: "shift_from"; new_from: string; reason: string }
      | { type: "clip_to"; new_to: string; reason: string }
      | { type: "skip"; reason: string }
    >;
    platform_id?: string;
    category_id?: string;
    commission_type?: string;
    effective_from?: string;
    effective_to?: string | null;
    payload?: any;
  }

  interface ParseResponse {
    analysis_id: string;
    file_name?: string;
    uploaded_at: string;
    summary: ParseSummary;
    rows: ParsedRow[];
  }

  type ImportRowStatus = "imported" | "skipped";

  interface ImportRowResult {
    row_id: string;
    row: number;
    status: ImportRowStatus;
    id?: string;
    message?: string;
  }

  interface ImportResponse {
    analysis_id: string;
    file_name?: string;
    uploaded_at: string;
    summary: {
      inserted: number;
      skipped: number;
    };
    results: ImportRowResult[];
  }

  interface RateCardPayload {
    platform_id: string;
    category_id: string;
    commission_type: "flat" | "tiered";
    commission_percent: number | null;
    slabs?: Array<{ min_price: number; max_price: number | null; commission_percent: number }>;
    fees?: Array<{ fee_code: string; fee_type: "percent" | "amount"; fee_value: number }>;
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
  }
}
