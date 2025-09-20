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
    message?: string;
    platform_id?: string;
    category_id?: string;
    commission_type?: string;
    effective_from?: string;
    effective_to?: string | null;
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
}
