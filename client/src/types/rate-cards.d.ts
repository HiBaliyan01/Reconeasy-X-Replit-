declare namespace RateCardImport {
  type RowStatus = "valid" | "similar" | "duplicate" | "error";

  interface ParseSummary {
    total: number;
    valid: number;
    similar: number;
    duplicate: number;
    error: number;
  }

  interface Payload {
    platform_id: string;
    category_id: string;
    commission_type: "flat" | "tiered";
    commission_percent: number | null;
    gst_percent: number;
    tcs_percent: number;
    settlement_basis: "t_plus" | "weekly" | "bi_weekly" | "monthly";
    t_plus_days?: number | null;
    weekly_weekday?: number | null;
    bi_weekly_weekday?: number | null;
    bi_weekly_which?: string | null;
    monthly_day?: number | null;
    grace_days?: number | null;
    effective_from: string;
    effective_to: string | null;
    global_min_price?: number | null;
    global_max_price?: number | null;
    notes?: string | null;
    slabs: Array<{
      min_price: number;
      max_price: number | null;
      commission_percent: number;
    }>;
    fees: Array<{
      fee_code: string;
      fee_type: "percent" | "amount";
      fee_value: number;
    }>;
  }

  interface ParsedRow {
    row: number;
    status: RowStatus;
    message: string;
    payload?: Payload;
  }

  interface ParseResponse {
    summary: ParseSummary;
    rows: ParsedRow[];
    file_name?: string;
    uploaded_at?: string;
  }

  type ImportRowStatus = "imported" | "skipped";

  interface ImportRowResult {
    row: number;
    status: ImportRowStatus;
    id?: string;
    message?: string;
    source_row?: number;
  }

  interface ImportResponse {
    summary: {
      inserted: number;
      skipped: number;
    };
    results: ImportRowResult[];
    uploaded_at?: string;
  }
}
