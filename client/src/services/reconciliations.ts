export type ReconciliationRow = {
  id?: string;
  order_id?: string;
  marketplace?: string;
  category?: string;
  order_date?: string;
  delivery_date?: string;
  actual_payout_date?: string | null;
  rate_card_id?: string;
  settlement_anchor?: string;
  settlement_cycle?: string;
  expected_payout_after_days?: number;
  grace_days?: number;
  expected_payout_date?: string;
  delay_threshold_date?: string;
  reco_status?: string;
  reconciliation_state?: string;
  operational_status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
};

export type ReconciliationResponse = {
  rows: ReconciliationRow[];
  count: number;
  limit: number;
  offset: number;
};

export type ReconciliationQueryParams = {
  reconciliation_state?: string;
  operational_status?: string;
  marketplace?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  sla_delay_min?: string | number;
};

const buildQueryString = (params: Record<string, any>) =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

export async function fetchReconciliations(params: ReconciliationQueryParams): Promise<ReconciliationResponse> {
  const query = buildQueryString(params);
  const res = await fetch(`/api/reconciliations${query ? `?${query}` : ''}`);
  if (!res.ok) {
    throw new Error('Failed to fetch reconciliations');
  }
  const json = await res.json();
  return json;
}
