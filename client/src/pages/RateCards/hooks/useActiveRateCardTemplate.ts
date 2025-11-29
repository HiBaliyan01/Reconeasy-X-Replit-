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
  refresh: () => void;
};

export function useActiveRateCardTemplate(templateType: TemplateVariant | null): UseActiveRateCardTemplateResult {
  const [template, setTemplate] = useState<RateCardTemplateMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequestRef = useRef(0);

  const fetchTemplate = useCallback(async () => {
    if (!templateType) {
      setTemplate(null);
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
        setTemplate(null);
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
    } catch (err) {
      if (activeRequestRef.current !== requestId) return;
      const message = err instanceof Error ? err.message : "Failed to load template metadata.";
      setError(message);
      setTemplate(null);
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
      refresh: fetchTemplate,
    }),
    [template, loading, error, fetchTemplate],
  );
}
