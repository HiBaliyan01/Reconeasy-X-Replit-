import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invokeSupabaseFunction } from "@/utils/supabaseFunctions";

export type TemplateVariant = "flat" | "tiered";

export type TemplateFieldOption = string | { value: string; label?: string };

export type TemplateFieldDependency =
  | string
  | {
      field: string;
      value?: string | number | boolean;
      equals?: string | number | boolean;
      values?: Array<string | number | boolean>;
      not?: boolean;
    };

export type RateCardTemplateField = {
  key?: string;
  form_key?: string;
  label: string;
  type?: string;
  field_type?: string;
  input_type?: string;
  description?: string;
  help_text?: string;
  example?: string;
  aliases?: string[];
  mandatory?: boolean;
  options?: TemplateFieldOption[];
  allowed_values?: TemplateFieldOption[];
  choices?: TemplateFieldOption[];
  meta?: Record<string, unknown>;
  group?: string;
  depends_on?: TemplateFieldDependency | TemplateFieldDependency[];
  visibility?: "wizard" | "csv" | "both";
  source?: "user" | "settlement" | "derived";
  status?: "active" | "deprecated";
};

export type TemplateSampleUrls = {
  csv?: string;
  xlsx?: string;
};

export type RateCardTemplateMetadata = {
  template_type: TemplateVariant;
  version: string;
  headers_json: RateCardTemplateField[];
  sample_data_url?: TemplateSampleUrls;
  description?: string;
  created_at?: string;
  updated_at?: string;
};

type TemplateApiRecord = Omit<RateCardTemplateMetadata, "sample_data_url"> & {
  sample_data_url?: string | TemplateSampleUrls | null;
};

const parseSampleDataUrl = (value?: string | TemplateSampleUrls | null): TemplateSampleUrls | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        return parseSampleDataUrl(parsed as TemplateSampleUrls);
      }
    } catch {
      // treat value as direct CSV link
      return /^https?:\/\//i.test(value) ? { csv: value } : undefined;
    }
    return /^https?:\/\//i.test(value) ? { csv: value } : undefined;
  }
  const urls: TemplateSampleUrls = {};
  if (value.csv) urls.csv = value.csv;
  if (value.xlsx) urls.xlsx = value.xlsx;
  return Object.keys(urls).length ? urls : undefined;
};

const buildLocalFallbackTemplate = (template_type: TemplateVariant): RateCardTemplateMetadata => {
  const sharedHeaders: RateCardTemplateField[] = [
    { key: "platform_id", label: "Marketplace", mandatory: true },
    { key: "category_id", label: "Category", mandatory: true },
    { key: "commission_type", label: "Commission Type", mandatory: true },
    { key: "commission_percent", label: "Commission %", mandatory: true },
    { key: "gst_percent", label: "GST %", mandatory: true, group: "Taxes" },
    { key: "tcs_percent", label: "TCS %", mandatory: false, group: "Taxes" },
    { key: "settlement_basis", label: "Settlement Basis", mandatory: true, group: "Settlement" },
    { key: "t_plus_days", label: "T + Days", mandatory: false, group: "Settlement" },
    { key: "weekly_weekday", label: "Weekly Weekday", mandatory: false, group: "Settlement" },
    { key: "bi_weekly_weekday", label: "Bi-weekly Weekday", mandatory: false, group: "Settlement" },
    { key: "bi_weekly_which", label: "Bi-weekly Which", mandatory: false, group: "Settlement" },
    { key: "monthly_day", label: "Monthly Day", mandatory: false, group: "Settlement" },
    { key: "grace_days", label: "Grace Days", mandatory: false, group: "Settlement" },
    { key: "effective_from", label: "Effective From", mandatory: true, group: "Validity" },
    { key: "effective_to", label: "Effective To", mandatory: false, group: "Validity" },
    {
      key: "tech_fee",
      label: "Tech / Platform Fee",
      mandatory: false,
      group: "Fees & Deductions",
      description: "Marketplace-controlled platform or technology usage fee",
    },
    {
      key: "collection_fee_percent",
      label: "Collection Fee (%)",
      mandatory: false,
      group: "Fees & Deductions",
      description: "COD collection or payment handling fee",
    },
    {
      key: "promo_contribution_percent",
      label: "Discount / Promo Contribution (%)",
      mandatory: false,
      group: "Fees & Deductions",
      description: "Brand’s contribution towards marketplace promotions or discounts",
    },
    { key: "notes", label: "Notes", mandatory: false, group: "Additional Options" },
  ];

  const tieredExtras: RateCardTemplateField[] =
    template_type === "tiered"
      ? [
          { key: "min_price", label: "Min Price (₹)", mandatory: true },
          { key: "max_price", label: "Max Price (₹)", mandatory: true },
        ]
      : [];

  return {
    template_type,
    version: "v3.3-local",
    headers_json: [...sharedHeaders, ...tieredExtras],
    description: "Local fallback template (offline-safe)",
  };
};

const LOCAL_TEMPLATE_FALLBACKS: Record<TemplateVariant, RateCardTemplateMetadata> = {
  flat: buildLocalFallbackTemplate("flat"),
  tiered: buildLocalFallbackTemplate("tiered"),
};

const parseVersionToTuple = (version?: string | null): number[] => {
  if (!version) return [0];
  const normalized = version.trim().replace(/^v/gi, "");
  return normalized
    .split(".")
    .filter(Boolean)
    .map((segment) => {
      const parsed = Number(segment);
      return Number.isNaN(parsed) ? 0 : parsed;
    });
};

const compareVersions = (a?: string | null, b?: string | null) => {
  const tupleA = parseVersionToTuple(a);
  const tupleB = parseVersionToTuple(b);
  const length = Math.max(tupleA.length, tupleB.length);
  for (let i = 0; i < length; i += 1) {
    const valA = tupleA[i] ?? 0;
    const valB = tupleB[i] ?? 0;
    if (valA > valB) return 1;
    if (valA < valB) return -1;
  }
  return 0;
};

type UseActiveRateCardTemplateResult = {
  template: RateCardTemplateMetadata | null;
  loading: boolean;
  error: string | null;
  fallback: boolean;
  refresh: () => void;
};

export function useActiveRateCardTemplate(templateType: TemplateVariant | null): UseActiveRateCardTemplateResult {
  const [template, setTemplate] = useState<RateCardTemplateMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const activeRequestRef = useRef(0);

  const fetchTemplate = useCallback(async () => {
    if (!templateType) {
      setTemplate(null);
      setFallback(false);
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    setLoading(true);
    setError(null);

    try {
      const response = await invokeSupabaseFunction<{ status?: string; templates?: TemplateApiRecord[] }>(
        "get_rate_card_templates",
      );
      if (activeRequestRef.current !== requestId) return;

      const records = Array.isArray(response?.templates) ? response.templates : [];
      const matching = records.filter((record) => record.template_type === templateType);
      if (!matching.length) {
        const fb = LOCAL_TEMPLATE_FALLBACKS[templateType];
        setTemplate(fb);
        setFallback(true);
        setError("No active template found for this type.");
        return;
      }

      const sorted = matching.sort((a, b) => compareVersions(b.version, a.version));
      const winning = sorted[0];

      setTemplate({
        ...winning,
        headers_json: Array.isArray(winning.headers_json) ? winning.headers_json : [],
        sample_data_url: parseSampleDataUrl(winning.sample_data_url),
      });
      setFallback(false);
    } catch (err) {
      if (activeRequestRef.current !== requestId) return;
      const message = err instanceof Error ? err.message : "Failed to load template metadata.";
      const fallback = templateType ? LOCAL_TEMPLATE_FALLBACKS[templateType] : null;
      if (fallback) {
        console.warn("[RateCard] Falling back to local template metadata:", message);
        setTemplate(fallback);
        setFallback(true);
        setError(message);
      } else {
        setError(message);
        setTemplate(null);
        setFallback(false);
      }
    } finally {
      if (activeRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [templateType]);

  useEffect(() => {
    if (!templateType) {
      setTemplate(null);
      setLoading(false);
      setError(null);
      return;
    }
    void fetchTemplate();
  }, [templateType, fetchTemplate]);

  return useMemo(
    () => ({
      template,
      loading,
      error,
      fallback,
      refresh: fetchTemplate,
    }),
    [template, loading, error, fallback, fetchTemplate],
  );
}
