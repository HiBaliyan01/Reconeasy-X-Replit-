import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, Trash2, Info, CheckCircle, X, AlertTriangle, LogOut, ChevronDown } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { invokeSupabaseFunction } from "@/utils/supabaseFunctions";
import { Button } from "@/components/ui/button";
import NoLimitChip from "@/components/rate-cards/NoLimitChip";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import {
  RateCardTemplateField,
  RateCardTemplateMetadata,
  TemplateFieldDependency,
  TemplateVariant,
  useActiveRateCardTemplate,
} from "../hooks/useActiveRateCardTemplate";

type WizardStepDefinition = {
  id: string;
  title: string;
  description: string;
  buildPlaceholder: (ctx: {
    template: RateCardTemplateMetadata | null;
    templateType: TemplateVariant | null;
  }) => string;
};

type BasicsFieldKey = "platform_id" | "category_id" | "commission_type";
type TieredSlabKey = "min_price" | "max_price" | "commission_percent";

const DEFAULT_BASICS_REQUIRED: Record<BasicsFieldKey, boolean> = {
  platform_id: true,
  category_id: true,
  commission_type: true,
};
const REQUIRED_TAX_KEYS = ["gst_percent"];

const PRODUCT_REQUIRED_FIELDS = {
  basics: ["marketplace", "category", "commission_type"],
  taxes: ["gst_percentage", "tcs_percentage"],
  settlement: ["settlement_basis", "t_plus_days"],
  validity: ["start_date", "end_date"],
  commission_structure: ["flat_or_tiered_structure_valid"],
};

function validateSettlementTerms(form: Record<string, string>) {
  return Boolean(form.settlement_basis && form.settlement_basis.trim() !== "");
}

const SETTLEMENT_BASIS_OPTIONS = [
  {
    value: "delivery_date",
    label: "Delivery Date",
    description: "Most marketplaces release payouts after delivery.",
  },
  {
    value: "settlement_generation",
    label: "Settlement Generation Date",
    description: "Used when payouts depend on settlement release.",
  },
];

type BasicsFieldDefinition = {
  id: BasicsFieldKey;
  synonyms: string[];
  defaultLabel: string;
  defaultHelpText: string;
  fallbackType?: "text" | "select" | "radio";
};

type BasicsFieldConfig = {
  id: BasicsFieldKey;
  label: string;
  helpText?: string;
  required: boolean;
  inputType: "text" | "select" | "radio";
  options: Array<{ value: string; label: string }>;
  templateField: RateCardTemplateField | null;
};

type TieredSlab = {
  id: string;
  min_price: string;
  max_price: string | null;
  commission_percent: string;
  noUpperLimit?: boolean;
  minTouched?: boolean;
  minAutoFilled?: boolean;
};

type LogisticsZone = "local" | "regional" | "national";

type LogisticsSlabInput = {
  id: string;
  weight_min_grams: number | "";
  weight_max_grams: number | "";
  zone: LogisticsZone;
  forward_fee: number | "";
  reverse_fee: number | "";
};

const normalizeSlabs = (slabs: TieredSlab[]): TieredSlab[] => {
  if (!slabs || !Array.isArray(slabs)) return [];
  const normalized = slabs.map((slab) => ({ ...slab }));

  normalized.forEach((slab, index) => {
    if (index === 0) {
      slab.minAutoFilled = false;
      slab.min_price = "0";
    } else {
      const prevMaxRaw = normalized[index - 1].max_price;
      const prevMaxNum =
        prevMaxRaw === null || prevMaxRaw === "" || Number.isNaN(Number(prevMaxRaw))
          ? 0
          : Number(prevMaxRaw);
      slab.min_price = String(prevMaxNum + 1);
      slab.minAutoFilled = true;
      slab.minTouched = false;
    }

    if (index === normalized.length - 1) {
      if (slab.noUpperLimit) {
        slab.max_price = null;
      }
    } else {
      slab.noUpperLimit = false;
      if (slab.max_price === null) slab.max_price = "";
    }
  });

  return normalized;
};

type SlabGap = {
  indexPrev: number;
  indexNext: number;
  gapStart: number;
  gapEnd: number;
  prev: { min_price: number | null; max_price: number | null };
  next: { min_price: number | null; max_price: number | null };
};

type TieredSlabError = Partial<Record<TieredSlabKey, string>>;

type TieredColumnConfig = {
  field: RateCardTemplateField | null;
  fallbackLabel: string;
  fallbackHelp: string;
};

type FieldOption = { value: string; label: string };

type StepRequirementMap = {
  basics: boolean;
  commission: boolean;
  fees: boolean;
  taxes: boolean;
  settlement: boolean;
  validity: boolean;
  options: boolean;
  review: boolean;
};

type FeeFieldConfig = {
  key: string;
  label: string;
  helpText?: string;
  required: boolean;
  inputType: "text" | "number" | "select";
  options: FieldOption[];
  group: string;
  templateField: RateCardTemplateField;
  dependsOn: TemplateFieldDependency[];
  supportsPercentToggle?: boolean;
  defaultMode?: FeeValueMode;
};

type TaxFieldConfig = {
  key: string;
  label: string;
  helpText?: string;
  required: boolean;
  defaultValue: string;
};

type SettlementFieldConfig = {
  key: string;
  label: string;
  helpText?: string;
  required: boolean;
  inputType: "text" | "number" | "select";
  options: FieldOption[];
  defaultValue: string;
  dependsOn: TemplateFieldDependency[];
};

type ValidityFieldConfig = {
  key: string;
  label: string;
  helpText?: string;
  required: boolean;
};

type OptionalFieldConfig = {
  key: string;
  label: string;
  helpText?: string;
  inputType: "text" | "number" | "textarea" | "select";
  required: boolean;
  templateField: RateCardTemplateField | null;
  options?: FieldOption[];
};

const STEP_DEFINITIONS: WizardStepDefinition[] = [
  {
    id: "basics",
    title: "Scope & Template",
    description: "Set the marketplace scope and choose the rate card template.",
    buildPlaceholder: ({ template, templateType }) => {
      if (!templateType) {
        return "Select a template type to unlock the guided scope form.";
      }
      if (!template) {
        return "Loading the selected template metadata so Scope & Template can configure its fields.";
      }
      return `Scope & Template is now aligned to the ${templateType === "tiered" ? "Tiered" : "Flat"} template ${
        template.version
      }, ensuring every header is mapped correctly.`;
    },
  },
  {
    id: "commission",
    title: "Commission Structure",
    description: "Define how commissions are calculated.",
    buildPlaceholder: ({ template }) =>
      template
        ? `Commission Structure will derive fields from ${template.headers_json.length} template columns, covering slabs and flat percentages from version ${template.version}.`
        : "Once the template is loaded, this step will reflect the commission columns present in the active template.",
  },
  {
    id: "fees",
    title: "Fees & Deductions",
    description: "Capture platform fees, penalties, and deductions.",
    buildPlaceholder: ({ template }) =>
      template
        ? `Fees & Deductions will list every surcharge column detected in template version ${template.version}.`
        : "Template metadata pending. Future sections for penalties and deductions will appear here.",
  },
  {
    id: "taxes",
    title: "Taxes",
    description: "Define statutory tax rates for reporting and payout visibility.",
    buildPlaceholder: ({ template }) =>
      template
        ? `Taxes will read statutory fields (like GST/TCS) directly from the ${template.version} headers so validation is automatic.`
        : "Taxes will activate as soon as the template is ready.",
  },
  {
    id: "settlement",
    title: "Settlement Terms",
    description: "Outline settlement cadence and payout behavior.",
    buildPlaceholder: ({ template }) =>
      template
        ? `Settlement Terms will pull cadence inputs (T+N, weekly, etc.) using metadata from template ${template.version}.`
        : "Placeholder for configuring payout cadence and grace periods once metadata loads.",
  },
  {
    id: "validity",
    title: "Validity",
    description: "Control effective dates and archival behavior.",
    buildPlaceholder: ({ template }) =>
      template
        ? `Validity will guide effective-from/to fields to keep template ${template.version} aligned with the monitoring rules.`
        : "Start/end validity and archival automation will live here after the template syncs.",
  },
  {
    id: "options",
    title: "Additional Information",
    description: "Add optional automation, alerts, or notes.",
    buildPlaceholder: ({ template }) =>
      template
        ? `Additional Information inherit optional columns from version ${template.version}—notes, alerts, and automation toggles.`
        : "Advanced toggles appear here once template data is available.",
  },
  {
    id: "review",
    title: "Review & Submit",
    description: "Summarize everything before publishing.",
    buildPlaceholder: ({ template }) =>
      template
        ? `Review & Submit will summarize every mapped field for ${template?.template_type} template version ${template.version} before publishing.`
        : "This step will recap your entries once template-driven sections have been configured.",
  },
];

const BASICS_FIELD_DEFINITIONS: BasicsFieldDefinition[] = [
  {
    id: "platform_id",
    synonyms: ["platform_id", "platform", "marketplace", "marketplace_id", "channel"],
    defaultLabel: "Marketplace",
    defaultHelpText: "Select the marketplace/platform this rate card applies to.",
    fallbackType: "text",
  },
  {
    id: "category_id",
    synonyms: ["category_id", "category", "product_category", "vertical"],
    defaultLabel: "Category",
    defaultHelpText: "Choose the category or vertical that this rate card covers.",
    fallbackType: "text",
  },
];

const TEMPLATE_CHOICES: Array<{ key: TemplateVariant; heading: string; blurb: string; points: string[] }> = [
  {
    key: "flat",
    heading: "Flat Rate Card",
    blurb: "Simple commission % across all price points.",
    points: ["Fast setup", "Best for stable categories"],
  },
  {
    key: "tiered",
    heading: "Tiered Rate Card",
    blurb: "Different commissions per price slab.",
    points: ["Price break intelligence", "Optimized for scale"],
  },
];

const DEFAULT_COMMISSION_OPTIONS: FieldOption[] = [
  { value: "flat", label: "Flat" },
  { value: "tiered", label: "Tiered" },
];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SETTLEMENT_LABELS: Record<string, string> = {
  delivery_date: "Delivery Date",
  settlement_generation: "Settlement Generation Date",
  per_order: "Per Order",
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
};
const REVIEW_DISPLAY_LABELS: Record<string, string> = {
  flat: "Flat commission",
  tiered: "Tiered commission",
  delivery_date: "Delivery date",
  settlement_generation: "Settlement generation date",
  return_request_date: "Return request date",
  return_pickup_date: "Return pickup date",
  order_delivery_date: "Order delivery date",
};

const SECTION_STEP_MAP: Record<string, keyof StepRequirementMap> = {
  "Scope & Template": "basics",
  "Commission Structure": "commission",
  "Fees & Deductions": "fees",
  Taxes: "taxes",
  "Settlement Terms": "settlement",
  Validity: "validity",
  "Additional Information": "options",
  "Review & Submit": "review",
};

const TAX_FIELD_DEFINITIONS = [
  {
    key: "gst_percent",
    synonyms: ["gst_percent", "gst", "tax_percent", "gst_rate"],
    defaultLabel: "GST %",
    defaultHelpText: "Used as a reference rate for reporting. This does not override marketplace-calculated GST.",
    defaultValue: "18",
  },
  {
    key: "tcs_percent",
    synonyms: ["tcs_percent", "tcs", "tax_collected_source"],
    defaultLabel: "TCS %",
    defaultHelpText: "Applicable where the marketplace deducts TCS under income tax provisions.",
    defaultValue: "1",
  },
];

type ValidityFieldDefinition = {
  key: string;
  synonyms: string[];
  defaultLabel: string;
  defaultHelpText: string;
  required: boolean;
};

const VALIDITY_FIELD_DEFINITIONS: ValidityFieldDefinition[] = [
  {
    key: "effective_from",
    synonyms: ["effective_from", "valid_from", "start_date"],
    defaultLabel: "Effective From",
    defaultHelpText: "Orders with activity on or after this date will use this rate card.",
    required: true,
  },
  {
    key: "effective_to",
    synonyms: ["effective_to", "valid_to", "end_date"],
    defaultLabel: "Effective To",
    defaultHelpText: "Leave blank if this rate card remains valid until replaced by a newer rate card.",
    required: false,
  },
];

const OPTIONAL_FIELD_DEFINITIONS = [
  {
    key: "return_window_days",
    synonyms: ["return_window_days", "return_window", "return_period"],
    defaultLabel: "Return Window (Days)",
    defaultHelpText: "Expected number of days within which returns are typically completed by the marketplace.",
  },
  {
    key: "return_sla_start_event",
    synonyms: ["return_sla_start_event"],
    defaultLabel: "Return SLA Start Event",
    defaultHelpText:
      "Determines when the return timeline starts for delay and dispute detection, once return reconciliation is enabled.",
    options: [
      { value: "return_request_date", label: "Return Request Date" },
      { value: "return_pickup_date", label: "Return Pickup Date" },
      { value: "order_delivery_date", label: "Order Delivery Date" },
    ],
  },
  {
    key: "utr_prefix",
    synonyms: ["utr_prefix", "payment_reference"],
    defaultLabel: "UTR Prefix",
    defaultHelpText: "Helps ReconEasy identify and group settlement transactions for this rate card.",
  },
  {
    key: "notes",
    synonyms: ["notes", "remarks", "comments"],
    defaultLabel: "Notes (Optional)",
    defaultHelpText: "Add any additional context or instructions.",
  },
];

const FEE_FIELD_KEYS = new Set([
  "tech_fee",
  "collection_fee_percent",
  "promo_contribution_percent",
  "platform_fee",
]);

type FeeValueMode = "amount" | "percent";

const FEE_FIELD_OVERRIDES: Record<
  string,
  {
    label?: string;
    helpText?: string;
    group?: string;
    defaultMode?: FeeValueMode;
    supportsPercentToggle?: boolean;
  }
> = {
  tech_fee: {
    label: "Tech / Platform Fee (₹ or % of order value)",
    helpText: "Marketplace-controlled platform or technology usage fee",
    group: "Fees & Deductions",
    supportsPercentToggle: true,
    defaultMode: "amount",
  },
  platform_fee: {
    label: "Tech / Platform Fee (₹ or % of order value)",
    helpText: "Marketplace-controlled platform or technology usage fee",
    group: "Fees & Deductions",
    supportsPercentToggle: true,
    defaultMode: "amount",
  },
  collection_fee_percent: {
    label: "Collection Fee (% of order value)",
    helpText: "COD collection or payment handling fee (applied only for COD orders)",
    group: "Fees & Deductions",
  },
  promo_contribution_percent: {
    label: "Discount / Promo Contribution (% of order value)",
    helpText: "Brand’s contribution towards marketplace promotions or discounts",
    group: "Fees & Deductions",
  },
};

type SettlementFieldDefinition = {
  key: string;
  synonyms: string[];
  defaultLabel: string;
  defaultHelpText: string;
  defaultValue: string;
  fallbackType?: "text" | "number" | "select";
  fallbackOptions?: FieldOption[];
};

const SETTLEMENT_FIELD_DEFINITIONS: SettlementFieldDefinition[] = [
  {
    key: "settlement_basis",
    synonyms: ["settlement_basis", "settlement_anchor", "basis", "anchor"],
    defaultLabel: "Settlement Anchor",
    defaultHelpText: "Event from which the payout clock starts.",
    defaultValue: "delivery_date",
    fallbackType: "select",
    fallbackOptions: [
      { value: "delivery_date", label: "Delivery Date" },
      { value: "settlement_generation", label: "Settlement Generation Date" },
    ],
  },
  {
    key: "t_plus_days",
    synonyms: ["t_plus_days", "t_plus", "tplus", "expected_payout_after_days"],
    defaultLabel: "Expected Payout After (Days)",
    defaultHelpText: "T + N days from the settlement anchor.",
    defaultValue: "",
    fallbackType: "number",
  },
  {
    key: "grace_days",
    synonyms: ["grace_days", "grace_period"],
    defaultLabel: "Grace Days (Buffer)",
    defaultHelpText: "Extra buffer days allowed before marking a payout as delayed.",
    defaultValue: "",
  },
];

const SETTLEMENT_DEPENDENCY_RULES: Record<string, TemplateFieldDependency[]> = {
  t_plus_days: [],
};

const hasContent = (value: any) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return true;
  return Boolean(value);
};

const datesOverlap = (aStart: string, aEnd: string | null, bStart: string, bEnd: string | null): boolean => {
  if (!aStart || !bStart) return false;
  const startA = new Date(aStart).getTime();
  const endA = aEnd ? new Date(aEnd).getTime() : Number.POSITIVE_INFINITY;
  const startB = new Date(bStart).getTime();
  const endB = bEnd ? new Date(bEnd).getTime() : Number.POSITIVE_INFINITY;
  if ([startA, endA, startB, endB].some((v) => Number.isNaN(v))) return false;
  return startA <= endB && startB <= endA;
};

const parseNumberInput = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = value.toString().trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const T_PLUS_DAYS_VALIDATION_MESSAGE =
  "Expected payout days is required to detect delayed or missing payments";

function getTPlusDaysValidationError(form: Record<string, string>) {
  const rawValue = form.t_plus_days;
  if (!hasContent(rawValue)) {
    return T_PLUS_DAYS_VALIDATION_MESSAGE;
  }

  const parsedValue = parseNumberInput(rawValue);
  if (parsedValue === null || !Number.isInteger(parsedValue) || parsedValue < 1) {
    return T_PLUS_DAYS_VALIDATION_MESSAGE;
  }

  return "";
}

const StepSkeleton = ({ lines = 4 }: { lines?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: lines }).map((_, index) => (
      <div
        key={`skeleton-${index}`}
        className="h-4 w-full animate-pulse rounded-full bg-slate-200/80"
        style={{ maxWidth: `${80 - index * 8}%` }}
      />
    ))}
  </div>
);

const normalizeFieldKey = (value?: string | null) =>
  value ? value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") : "";

const sanitizePriceInput = (raw: string | number | null | undefined): string => {
  if (raw === null || raw === undefined) return "";
  const digits = String(raw).replace(/[^0-9]/g, "");
  if (!digits.length) return "";
  const normalized = digits.replace(/^0+(?=\d)/, "");
  return normalized === "" ? "0" : normalized;
};

const normalizeVisibility = (field?: RateCardTemplateField | null): "wizard" | "csv" | "both" => {
  const metaVisibility = typeof field?.meta?.visibility === "string" ? (field?.meta?.visibility as string) : undefined;
  const raw = field?.visibility ?? metaVisibility;
  if (raw === "wizard" || raw === "csv" || raw === "both") return raw;
  return "both";
};

const isWizardVisibleField = (field?: RateCardTemplateField | null) => normalizeVisibility(field) !== "csv";

const formatOptionLabel = (value: string) =>
  value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const formatCurrency = (value: string | number | null): string => {
  if (value === null) return "∞";
  const num = Number(value);
  if (Number.isNaN(num)) return value?.toString() ?? "—";
  return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

function detectSlabGaps(slabs: TieredSlab[]): SlabGap[] {
  // Normalize and sort by min_price ascending
  const normalized = slabs
    .map((slab, originalIndex) => ({
      originalIndex,
      min: Number(slab.min_price),
      max: slab.noUpperLimit || slab.max_price === null ? null : Number(slab.max_price),
      noUpperLimit: Boolean(slab.noUpperLimit),
    }))
    .filter((s) => !Number.isNaN(s.min))
    .sort((a, b) => a.min - b.min);

  const gaps: SlabGap[] = [];
  for (let i = 0; i < normalized.length - 1; i++) {
    const prev = normalized[i];
    const next = normalized[i + 1];
    if (prev.max === null) {
      // Open-ended: covers everything above; no gaps after it
      continue;
    }
    if (Number.isNaN(prev.max) || Number.isNaN(next.min)) continue;
    const gapStart = prev.max + 1;
    const gapEnd = next.min - 1;
    if (next.min > prev.max + 1) {
      gaps.push({
        indexPrev: prev.originalIndex,
        indexNext: next.originalIndex,
        gapStart,
        gapEnd,
        prev: { min_price: prev.min, max_price: prev.max },
        next: { min_price: next.min, max_price: next.max },
      });
    }
  }
  return gaps;
}

function SlabGapWarningModal({
  open,
  gaps,
  onClose,
  onFix,
  onContinue,
}: {
  open: boolean;
  gaps: SlabGap[];
  onClose: () => void;
  onFix: () => void;
  onContinue: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">We found gaps in your slab ranges</h3>
        <p className="mt-2 text-sm text-slate-600">
          Some price ranges are not covered by any commission slab. You can fix them now or continue if this is
          intentional.
        </p>
        <div className="mt-4 space-y-3">
          {gaps.map((gap, idx) => (
            <div key={`gap-${idx}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <p className="text-sm font-medium text-slate-900">
                Gap between {formatCurrency(gap.gapStart)} and {formatCurrency(gap.gapEnd)}
              </p>
              <p className="text-xs text-slate-600">
                After slab {gap.indexPrev + 1} ({formatCurrency(gap.prev.min_price)}–{gap.prev.max_price === null
                  ? "∞"
                  : formatCurrency(gap.prev.max_price)}
                ) and before slab {gap.indexNext + 1} ({formatCurrency(gap.next.min_price)}–
                {gap.next.max_price === null ? "∞" : formatCurrency(gap.next.max_price)}).
              </p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              onFix();
              onClose();
            }}
            className="w-full rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-teal-700 sm:w-auto"
          >
            Go back and fix
          </button>
          <button
            type="button"
            onClick={() => {
              onContinue();
              onClose();
            }}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            Continue anyway
          </button>
        </div>
      </div>
    </div>
  );
}

const normalizeTemplateOptions = (
  field: RateCardTemplateField | null,
  fallbackId: BasicsFieldKey,
): FieldOption[] => {
  if (!field) {
    if (fallbackId === "commission_type") return DEFAULT_COMMISSION_OPTIONS;
    return [];
  }

  const sources = [
    field.options,
    field.allowed_values,
    field.choices,
    Array.isArray(field.meta?.options) ? (field.meta?.options as RateCardTemplateField["options"]) : null,
  ];
  const raw = sources.find((candidate) => Array.isArray(candidate)) as RateCardTemplateField["options"] | undefined;

  if (!raw || !raw.length) {
    if (fallbackId === "commission_type") return DEFAULT_COMMISSION_OPTIONS;
    return [];
  }

  return raw
    .map((option) => {
      if (typeof option === "string") {
        return { value: option, label: formatOptionLabel(option) };
      }
      if (option && typeof option === "object" && option.value) {
        return { value: option.value, label: option.label ?? formatOptionLabel(option.value) };
      }
      return null;
    })
    .filter((option): option is FieldOption => Boolean(option?.value));
};

const extractFieldOptions = (field: RateCardTemplateField | null): FieldOption[] => {
  if (!field) return [];
  const sources = [
    field.options,
    field.allowed_values,
    field.choices,
    Array.isArray(field.meta?.options) ? (field.meta?.options as RateCardTemplateField["options"]) : null,
  ];
  const raw = sources.find((candidate) => Array.isArray(candidate)) as RateCardTemplateField["options"] | undefined;
  if (!raw || !raw.length) return [];
  return raw
    .map((option) => {
      if (typeof option === "string") {
        return { value: option, label: formatOptionLabel(option) };
      }
      if (option && typeof option === "object" && option.value) {
        return { value: option.value, label: option.label ?? formatOptionLabel(option.value) };
      }
      return null;
    })
    .filter((option): option is FieldOption => Boolean(option?.value));
};

const normalizeDependencies = (
  dependsOn?: RateCardTemplateField["depends_on"],
  meta?: Record<string, unknown>,
): TemplateFieldDependency[] => {
  const raw = dependsOn ?? (meta?.depends_on as RateCardTemplateField["depends_on"]);
  if (!raw) return [];
  const normalized = Array.isArray(raw) ? raw : [raw];
  return normalized
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      if (entry && typeof entry === "object") {
        return entry as TemplateFieldDependency;
      }
      return null;
    })
    .filter((entry): entry is TemplateFieldDependency => Boolean(entry));
};

const inferInputType = (
  field: RateCardTemplateField | null,
  fallback: "text" | "select" | "radio",
  optionCount: number,
): "text" | "select" | "radio" => {
  if (!field) {
    if (fallback === "radio" && optionCount > 0) return "radio";
    if (fallback === "select" && optionCount > 0) return "select";
    return fallback;
  }

  const rawType = (field.type || field.input_type || field.field_type || "")?.toString().toLowerCase();
  if (["radio", "segmented", "toggle"].includes(rawType) || optionCount > 0) {
    return rawType === "radio" || fallback === "radio" ? "radio" : "select";
  }
  if (["select", "dropdown", "combo"].includes(rawType)) {
    return "select";
  }
  return fallback;
};

const inferFeeInputType = (field: RateCardTemplateField | null, optionCount: number, key: string): "text" | "number" | "select" => {
  if (optionCount > 0) return "select";
  const declared = (field?.type || field?.input_type || field?.field_type || "").toString().toLowerCase();
  if (["number", "decimal", "currency"].includes(declared)) return "number";
  const isNumeric = /percent|fee|price|amount|value|charge|min|max|deduction|promo|collection/i.test(key);
  return isNumeric ? "number" : "text";
};

const resolveFieldKey = (field: RateCardTemplateField): string => {
  const candidate = field.form_key || field.key || normalizeFieldKey(field.label);
  return normalizeFieldKey(candidate);
};

const isFeeField = (field: RateCardTemplateField): boolean => {
  const normalizedKey = resolveFieldKey(field);
  return FEE_FIELD_KEYS.has(normalizedKey);
};

type AddRateCardWizardProps = {
  isEditingVersioned?: boolean;
  previousVersionNumber?: number;
  previousEffectiveTo?: string | null;
};

export default function AddRateCardWizard({
  isEditingVersioned = false,
  previousVersionNumber,
  previousEffectiveTo = null,
}: AddRateCardWizardProps = {}) {
  const currentUser = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const editId = params.get("editId");
  const isEditMode = Boolean(editId);
  const editingVersioned = isEditingVersioned || isEditMode;
  const [activeStep, setActiveStep] = useState(0);
  const [templateType, setTemplateType] = useState<TemplateVariant | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<RateCardTemplateMetadata | null>(null);
  const [basicsForm, setBasicsForm] = useState<Record<BasicsFieldKey, string>>({
    platform_id: "",
    category_id: "",
    commission_type: "",
  });
  const [priorVersionNumber, setPriorVersionNumber] = useState<number | undefined>(previousVersionNumber);
  const [priorEffectiveTo, setPriorEffectiveTo] = useState<string | null>(previousEffectiveTo);
  const slabIdRef = useRef(0);
  const createSlabRow = useCallback((): TieredSlab => {
    slabIdRef.current += 1;
    return {
      id: `slab-${slabIdRef.current}`,
      min_price: "",
      max_price: "",
      commission_percent: "",
      noUpperLimit: false,
      minTouched: false,
      minAutoFilled: false,
    };
  }, []);
  const [flatCommission, setFlatCommission] = useState("");
  const [tieredSlabs, setTieredSlabs] = useState<TieredSlab[]>(() =>
    normalizeSlabs([
      {
        id: "slab-initial",
        min_price: "",
        max_price: "",
        commission_percent: "",
        noUpperLimit: false,
        minTouched: false,
        minAutoFilled: false,
      },
    ]),
  );
  const createLogisticsSlabRow = useCallback(
    (seed?: Partial<LogisticsSlabInput>): LogisticsSlabInput => ({
      id: seed?.id ?? crypto.randomUUID(),
      weight_min_grams: seed?.weight_min_grams ?? "",
      weight_max_grams: seed?.weight_max_grams ?? "",
      zone: seed?.zone ?? "national",
      forward_fee: seed?.forward_fee ?? "",
      reverse_fee: seed?.reverse_fee ?? "",
    }),
    [],
  );
  const [feesForm, setFeesForm] = useState<Record<string, string>>({});
  const [feeModes, setFeeModes] = useState<Record<string, FeeValueMode>>({});
  const [taxForm, setTaxForm] = useState<Record<string, string>>({
    gst_percent: "18",
    tcs_percent: "1",
  });
  const [taxTouched, setTaxTouched] = useState<{ gst: boolean; tcs: boolean }>({ gst: false, tcs: false });
  const [settlementForm, setSettlementForm] = useState<Record<string, string>>({
    settlement_basis: "delivery_date",
  });
  const [settlementTouched, setSettlementTouched] = useState(false);
  const [prefillCard, setPrefillCard] = useState<any | null>(null);
  const [prefillLoading, setPrefillLoading] = useState<boolean>(isEditMode);
  const [basicsPrefilled, setBasicsPrefilled] = useState<boolean>(!isEditMode);
  const [slabsPrefilled, setSlabsPrefilled] = useState<boolean>(!isEditMode);
  const [feesPrefilled, setFeesPrefilled] = useState<boolean>(!isEditMode);
  const [logisticsPrefilled, setLogisticsPrefilled] = useState<boolean>(!isEditMode);
  const [taxesPrefilled, setTaxesPrefilled] = useState<boolean>(!isEditMode);
  const [settlementPrefilled, setSettlementPrefilled] = useState<boolean>(!isEditMode);
  const [validityPrefilled, setValidityPrefilled] = useState<boolean>(!isEditMode);
  const [commissionType, setCommissionType] = useState<TemplateVariant | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [optionsValidationAttempted, setOptionsValidationAttempted] = useState(false);
  const editPrefillDone = useMemo(
    () =>
      basicsPrefilled &&
      slabsPrefilled &&
      feesPrefilled &&
      logisticsPrefilled &&
      taxesPrefilled &&
      settlementPrefilled &&
      validityPrefilled,
    [
      basicsPrefilled,
      slabsPrefilled,
      feesPrefilled,
      logisticsPrefilled,
      taxesPrefilled,
      settlementPrefilled,
      validityPrefilled,
    ],
  );
  const [prefillError, setPrefillError] = useState<string | null>(null);
  const [prefillRetryTick, setPrefillRetryTick] = useState(0);
  const todayIso = new Date().toISOString().slice(0, 10);
  const [validityForm, setValidityForm] = useState<Record<string, string>>({
    effective_from: editingVersioned ? todayIso : todayIso,
    effective_to: editingVersioned && priorEffectiveTo ? priorEffectiveTo : "",
  });
  const [optionalForm, setOptionalForm] = useState<Record<string, string>>({
    return_window_days: "",
    utr_prefix: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedReviewSections, setExpandedReviewSections] = useState<Set<string>>(new Set());
  const [pendingNoUpperLimit, setPendingNoUpperLimit] = useState<{ rowId: string; index: number } | null>(
    null,
  );
  const [pendingSlabGaps, setPendingSlabGaps] = useState<SlabGap[]>([]);
  const [gapModalOpen, setGapModalOpen] = useState(false);
  const [ignoreSlabGapWarnings, setIgnoreSlabGapWarnings] = useState(false);
  const [highlightedGapIndices, setHighlightedGapIndices] = useState<number[]>([]);
  const [validityOverlapWarning, setValidityOverlapWarning] = useState(false);
  const [showOverlapPublishModal, setShowOverlapPublishModal] = useState(false);
  const [overlapModalDecision, setOverlapModalDecision] = useState<"replace" | "coexist" | null>(null);
  const [missingSections, setMissingSections] = useState<Set<string>>(new Set());
  const [stepValidationAttempted, setStepValidationAttempted] = useState(false);
  const [logisticsEnabled, setLogisticsEnabled] = useState(false);
  const [logisticsSlabs, setLogisticsSlabs] = useState<LogisticsSlabInput[]>([]);
  const [logisticsSlabError, setLogisticsSlabError] = useState<string | null>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const newSlabFocusRef = useRef<string | null>(null);

  const {
    template: fetchedTemplate,
    loading: templateLoading,
    error: templateError,
    refresh: refetchTemplate,
    fallback: templateFallback,
  } = useActiveRateCardTemplate(templateType);

  // Must be declared before any effect that uses it
  const feesFieldConfigs = useMemo((): FeeFieldConfig[] => {
    if (!activeTemplate) return [];
    const headers = activeTemplate.headers_json ?? [];
    return headers
      .filter((field) => isWizardVisibleField(field))
      .filter((field) => isFeeField(field))
      .map((field) => {
        const key = resolveFieldKey(field);
        const options = extractFieldOptions(field);
        const override = FEE_FIELD_OVERRIDES[key] ?? {};
        const inputType = override.supportsPercentToggle ? "number" : inferFeeInputType(field, options.length, key);
        const group =
          override.group ||
          field.group ||
          (typeof field.meta?.group === "string" ? field.meta.group : "") ||
          "Fees & Deductions";
        return {
          key,
          label: override.label || field.label || formatOptionLabel(key),
          helpText: override.helpText ?? field.help_text ?? field.description ?? "",
          required: Boolean(field.mandatory),
          inputType,
          options,
          group,
          templateField: field,
          dependsOn: normalizeDependencies(field.depends_on, field.meta),
          supportsPercentToggle: override.supportsPercentToggle,
          defaultMode: override.defaultMode,
        };
      });
  }, [activeTemplate]);

  const templateReady = useMemo(
    () => Boolean(templateType && activeTemplate && !templateLoading && !templateError),
    [templateType, activeTemplate, templateLoading, templateError],
  );
  const templatePending = useMemo(
    () => Boolean(templateType && (templateLoading || (!activeTemplate && !templateError))),
    [templateType, templateLoading, activeTemplate, templateError],
  );

  useEffect(() => {
    if (!templateType) {
      setActiveTemplate(null);
      return;
    }
    if (fetchedTemplate) {
      setActiveTemplate(fetchedTemplate);
    } else if (!templateLoading) {
      setActiveTemplate(null);
    }
  }, [templateType, fetchedTemplate, templateLoading]);

  useEffect(() => {
    setBasicsForm((previous) => ({
      ...previous,
      commission_type: templateType ?? "",
    }));
    if (templateType) {
      setCommissionType(templateType);
    }
  }, [templateType]);

  useEffect(() => {
    setFlatCommission("");
    setTieredSlabs(normalizeSlabs([createSlabRow()]));
  }, [templateType, createSlabRow]);

  useEffect(() => {
    if (!isEditMode || !editId) return;
    let cancelled = false;
    const load = async () => {
      setPrefillLoading(true);
      setPrefillError(null);
      try {
        const response = await fetch(`/api/rate-cards/${editId}`);
        if (!response.ok) {
          const problem = await response.json().catch(() => null);
          throw new Error(problem?.message || "Failed to load rate card");
        }
        const card = await response.json();
        if (cancelled) return;
        setPrefillCard(card);
        const commissionType = (card.commission_type === "tiered" ? "tiered" : "flat") as TemplateVariant;
        setTemplateType(commissionType);
        setPriorVersionNumber(Number(card.version_number ?? previousVersionNumber ?? 1));
        setPriorEffectiveTo(card.effective_to ?? null);
      } catch (error: any) {
        if (cancelled) return;
        setPrefillError(error?.message || "Failed to load rate card for editing.");
      } finally {
        if (!cancelled) {
          setPrefillLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [editId, isEditMode, prefillRetryTick, previousVersionNumber, setTemplateType]);

  useEffect(() => {
    if (!feesFieldConfigs.length) {
      setFeesForm({});
      setFeeModes({});
      return;
    }
    const feeKeys = feesFieldConfigs.map((field) => field.key);
    setFeesForm((previous) => {
      const next: Record<string, string> = {};
      feeKeys.forEach((key) => {
        next[key] = previous[key] ?? "";
      });
      return next;
    });
    setFeeModes((previous) => {
      const next: Record<string, FeeValueMode> = {};
      feesFieldConfigs.forEach((field) => {
        if (field.supportsPercentToggle) {
          next[field.key] = previous[field.key] ?? field.defaultMode ?? "amount";
        }
      });
      return next;
    });
  }, [feesFieldConfigs]);

  // Prefill basics
  useEffect(() => {
    if (!isEditMode || !prefillCard || !templateReady || basicsPrefilled) return;
    if (prefillCard.commission_type) {
      setCommissionType(prefillCard.commission_type);
      setTemplateType((current) => current ?? prefillCard.commission_type);
    }
    setBasicsForm({
      platform_id: prefillCard.platform_id ?? "",
      category_id: prefillCard.category_id ?? "",
      commission_type: prefillCard.commission_type ?? "",
    });
    setBasicsPrefilled(true);
  }, [basicsPrefilled, isEditMode, prefillCard, templateReady]);

  // Prefill slabs
  useEffect(() => {
    if (!isEditMode || !prefillCard || !templateReady || slabsPrefilled) return;
    const mapped: TieredSlab[] = (prefillCard.slabs ?? []).map((slab: any, index: number) => ({
      id: `prefill-slab-${index + 1}`,
      min_price:
        slab?.min_price !== undefined && slab?.min_price !== null ? sanitizePriceInput(slab.min_price) : "",
      max_price:
        slab?.max_price === null || slab?.max_price === undefined ? null : sanitizePriceInput(slab.max_price),
      commission_percent:
        slab?.commission_percent !== undefined && slab?.commission_percent !== null
          ? String(slab.commission_percent)
          : "",
      noUpperLimit: slab?.max_price === null,
      minTouched: true,
      minAutoFilled: false,
    }));
    const normalized = mapped.length ? normalizeSlabs(mapped) : normalizeSlabs([createSlabRow()]);
    setTieredSlabs(normalized);
    setSlabsPrefilled(true);
  }, [createSlabRow, isEditMode, prefillCard, slabsPrefilled, templateReady]);

  // Prefill flat commission
  useEffect(() => {
    if (!isEditMode || !prefillCard || !templateReady) return;
    if (prefillCard.commission_type === "flat" && prefillCard.commission_percent !== undefined && prefillCard.commission_percent !== null) {
      setFlatCommission(String(prefillCard.commission_percent));
    }
    if (prefillCard.commission_type && !commissionType) {
      setCommissionType(prefillCard.commission_type);
      setTemplateType((current) => current ?? prefillCard.commission_type);
    }
  }, [isEditMode, prefillCard, templateReady]);

  // Prefill taxes
  useEffect(() => {
    if (!isEditMode || !prefillCard || !templateReady || taxesPrefilled) return;
    setTaxForm({
      gst_percent:
        prefillCard.gst_percent !== undefined && prefillCard.gst_percent !== null
          ? String(prefillCard.gst_percent)
          : "",
      tcs_percent:
        prefillCard.tcs_percent !== undefined && prefillCard.tcs_percent !== null
          ? String(prefillCard.tcs_percent)
          : "",
    });
    setTaxTouched({ gst: true, tcs: true });
    setTaxesPrefilled(true);
  }, [isEditMode, prefillCard, taxesPrefilled, templateReady]);

  // Prefill settlement
  useEffect(() => {
    if (!isEditMode || !prefillCard || !templateReady || settlementPrefilled) return;
    setSettlementForm({
      settlement_basis: prefillCard.settlement_basis ?? "",
      t_plus_days:
        prefillCard.t_plus_days !== undefined && prefillCard.t_plus_days !== null
          ? String(prefillCard.t_plus_days)
          : "",
      grace_days:
        prefillCard.grace_days !== undefined && prefillCard.grace_days !== null
          ? String(prefillCard.grace_days)
          : "",
    });
    setSettlementTouched(true);
    setSettlementPrefilled(true);
  }, [isEditMode, prefillCard, settlementPrefilled, templateReady]);

  // Prefill validity
  useEffect(() => {
    if (!isEditMode || !prefillCard || !templateReady || validityPrefilled) return;
    setValidityForm({
      effective_from: prefillCard.effective_from ?? "",
      effective_to: prefillCard.effective_to ?? "",
    });
    setValidityPrefilled(true);
  }, [isEditMode, prefillCard, templateReady, validityPrefilled]);

  const checkValidityOverlap = useCallback(async () => {
    const from = (validityForm.effective_from ?? "").trim();
    if (!from) {
      setValidityOverlapWarning(false);
      return;
    }
    if (!basicsForm.platform_id || !basicsForm.category_id) {
      setValidityOverlapWarning(false);
      return;
    }
    try {
      const payload = await invokeSupabaseFunction<{ data?: any[] }>("rate-cards-v2");
      const records: any[] = Array.isArray((payload as any)?.data) ? (payload as any).data : [];
      const overlap = records
        .filter(
          (card) =>
            !card.archived &&
            card.platform_id === basicsForm.platform_id &&
            card.category_id === basicsForm.category_id &&
            (!editId || card.id !== editId),
        )
        .some((card) =>
          datesOverlap(from, (validityForm.effective_to ?? "").trim() || null, card.effective_from, card.effective_to),
        );
      setValidityOverlapWarning(overlap);
    } catch (error) {
      console.error("Failed to check validity overlap", error);
      setValidityOverlapWarning(false);
    }
  }, [basicsForm.category_id, basicsForm.platform_id, editId, validityForm.effective_from, validityForm.effective_to]);

  useEffect(() => {
    void checkValidityOverlap();
  }, [checkValidityOverlap]);

  useEffect(() => {
    if (!isEditMode) return;
    if (!prefillCard) return;
    if (!templateReady) return;
    if (!feesFieldConfigs || feesFieldConfigs.length === 0) return;
    if (feesPrefilled) return;

    const feeMap = new Map<string, any>();
    (prefillCard.fees ?? []).forEach((fee: any) => {
      if (fee?.fee_code) {
        feeMap.set(String(fee.fee_code), fee);
      }
    });
    const nextFees: Record<string, string> = {};
    const nextModes: Record<string, FeeValueMode> = {};
    feesFieldConfigs.forEach((field) => {
      const fee = feeMap.get(field.key);
      if (fee && fee.fee_value !== undefined && fee.fee_value !== null) {
        nextFees[field.key] = String(fee.fee_value);
        if (field.supportsPercentToggle) {
          nextModes[field.key] = fee.fee_type === "percent" ? "percent" : field.defaultMode ?? "amount";
        }
      }
    });
    setFeesForm(nextFees);
    if (Object.keys(nextModes).length) {
      setFeeModes((prev) => ({ ...prev, ...nextModes }));
    }
    setFeesPrefilled(true);

    setOptionalForm((prev) => ({
      ...prev,
      notes: prefillCard.notes ?? "",
    }));
  }, [feesFieldConfigs, feesPrefilled, isEditMode, prefillCard, templateReady]);

  useEffect(() => {
    if (!isEditMode || !prefillCard || logisticsPrefilled) return;

    const existingSlabs = Array.isArray(prefillCard.logistics_slabs)
      ? prefillCard.logistics_slabs
      : [];

    if (existingSlabs.length > 0) {
      const mapped = existingSlabs.map((slab: any) =>
        createLogisticsSlabRow({
          id: String(slab.id ?? crypto.randomUUID()),
          weight_min_grams:
            slab.weight_min_grams !== undefined && slab.weight_min_grams !== null
              ? Number(slab.weight_min_grams)
              : "",
          weight_max_grams:
            slab.weight_max_grams !== undefined && slab.weight_max_grams !== null
              ? Number(slab.weight_max_grams)
              : "",
          zone: slab.zone ?? "national",
          forward_fee:
            slab.forward_fee !== undefined && slab.forward_fee !== null
              ? Number(slab.forward_fee)
              : "",
          reverse_fee:
            slab.reverse_fee !== undefined && slab.reverse_fee !== null
              ? Number(slab.reverse_fee)
              : "",
        }),
      );

      setLogisticsEnabled(true);
      setLogisticsSlabs(mapped);
      validateLogisticsSlabsRealtime(mapped);
    } else {
      setLogisticsEnabled(false);
      setLogisticsSlabs([]);
      setLogisticsSlabError(null);
    }

    setLogisticsPrefilled(true);
  }, [
    createLogisticsSlabRow,
    isEditMode,
    logisticsPrefilled,
    prefillCard,
  ]);

  const templateFieldLookup = useMemo(() => {
    const map = new Map<string, RateCardTemplateField>();
    activeTemplate?.headers_json
      ?.filter((field) => isWizardVisibleField(field))
      .forEach((field) => {
      const keys = [
        field.form_key,
        field.key,
        normalizeFieldKey(field.label),
        ...(field.aliases ?? []).map((alias) => normalizeFieldKey(alias)),
      ];
      keys
        .filter(Boolean)
        .forEach((key) => {
          if (!map.has(key as string)) {
            map.set(key as string, field);
          }
        });
      });
    return map;
  }, [activeTemplate]);

  const resolveTemplateField = useCallback(
    (synonyms: string[]) => {
      for (const synonym of synonyms) {
        const normalized = normalizeFieldKey(synonym);
        if (!normalized) continue;
        const match = templateFieldLookup.get(normalized);
        if (match) return match;
      }
      return null;
    },
    [templateFieldLookup],
  );

  const taxFieldConfigs = useMemo(() => {
    return TAX_FIELD_DEFINITIONS.map((definition) => {
      const resolved = resolveTemplateField(definition.synonyms);
      const templateField = resolved && isWizardVisibleField(resolved) ? resolved : null;
      if (resolved && !templateField) return null;
      return {
        key: definition.key,
        label: templateField?.label ?? definition.defaultLabel,
        helpText: templateField?.help_text ?? templateField?.description ?? definition.defaultHelpText,
        required: Boolean(templateField?.mandatory ?? true),
        defaultValue: definition.defaultValue,
      };
    }).filter(Boolean) as TaxFieldConfig[];
  }, [resolveTemplateField]);

const settlementFieldConfigs = useMemo((): SettlementFieldConfig[] => {
  return SETTLEMENT_FIELD_DEFINITIONS.map((definition) => {
    const resolved = resolveTemplateField(definition.synonyms);
    const templateField = resolved && isWizardVisibleField(resolved) ? resolved : null;
    if (resolved && !templateField) return null;
    const normalizedKey = definition.key;
    const templateOptions = extractFieldOptions(templateField);
    const options =
      normalizedKey === "settlement_basis"
        ? templateOptions.length
            ? templateOptions
            : SETTLEMENT_BASIS_OPTIONS
        : definition.fallbackOptions && definition.fallbackOptions.length
          ? definition.fallbackOptions
          : templateOptions;
    const dependsFromTemplate = normalizeDependencies(templateField?.depends_on, templateField?.meta);
    const dependsOn = dependsFromTemplate.length
      ? dependsFromTemplate
      : SETTLEMENT_DEPENDENCY_RULES[normalizedKey] ?? [];

      const inputType =
        normalizedKey === "settlement_basis"
          ? "select"
          : definition.fallbackType === "select"
            ? "select"
            : inferFeeInputType(templateField, options.length, normalizedKey);

      const templateExample =
        typeof templateField?.example === "string" && templateField.example.trim().length > 0
          ? templateField.example
          : undefined;
      const basisDefault =
        normalizedKey === "settlement_basis"
          ? templateExample ?? definition.defaultValue ?? "delivery_date"
          : templateField?.example;

      return {
        key: normalizedKey,
        label:
          normalizedKey === "t_plus_days"
            ? definition.defaultLabel
            : normalizedKey === "grace_days"
              ? definition.defaultLabel
              : templateField?.label ?? definition.defaultLabel,
        helpText:
          templateField?.help_text ?? templateField?.description ?? definition.defaultHelpText,
        required:
          normalizedKey === "settlement_basis"
            ? true
            : normalizedKey === "t_plus_days"
              ? true
              : Boolean(templateField?.mandatory ?? false),
        inputType,
        options,
        defaultValue:
          normalizedKey === "settlement_basis"
            ? basisDefault
            : templateField?.example ?? definition.defaultValue ?? "",
        dependsOn,
      };
    }).filter(Boolean) as SettlementFieldConfig[];
  }, [resolveTemplateField]);

  useEffect(() => {
    setTaxForm(() => {
      const defaults: Record<string, string> = {};
      taxFieldConfigs.forEach((config) => {
        defaults[config.key] = config.defaultValue;
      });
      return defaults;
    });
  }, [taxFieldConfigs]);

  useEffect(() => {
    if (!settlementFieldConfigs.length) return;
    setSettlementForm((prev) => {
      const defaults: Record<string, string> = { ...prev };
      settlementFieldConfigs.forEach((field) => {
        if (!hasContent(defaults[field.key])) {
          defaults[field.key] = field.defaultValue ?? "";
        }
      });
      if (!hasContent(defaults.settlement_basis)) {
        defaults.settlement_basis = "delivery_date";
      }
      return defaults;
    });
    const basisDefault = settlementFieldConfigs.find((field) => field.key === "settlement_basis")?.defaultValue ?? "";
    if (hasContent(basisDefault)) {
      setSettlementTouched(true);
    }
  }, [settlementFieldConfigs]);

  const optionalFieldConfigs = useMemo((): OptionalFieldConfig[] => {
    if (!activeTemplate) return [];
    return OPTIONAL_FIELD_DEFINITIONS.map((definition) => {
      const resolved = resolveTemplateField(definition.synonyms);
      const templateField = resolved && isWizardVisibleField(resolved) ? resolved : null;
      if (resolved && !templateField) return null;
      const baseOptions = extractFieldOptions(templateField).length
        ? extractFieldOptions(templateField)
        : Array.isArray((definition as any).options)
          ? ((definition as any).options as FieldOption[])
          : [];
      const fieldOptions = baseOptions.filter((option) => option && option.value);
      const inputType =
        definition.key === "notes"
          ? "textarea"
          : definition.key === "return_window_days"
            ? "number"
            : fieldOptions.length
              ? "select"
              : inferFeeInputType(templateField, extractFieldOptions(templateField).length, definition.key);
      return {
        key: definition.key,
        label: templateField?.label ?? definition.defaultLabel,
        helpText: templateField?.help_text ?? templateField?.description ?? definition.defaultHelpText,
        inputType,
        required: Boolean(templateField?.mandatory ?? false),
        templateField,
        options: fieldOptions,
      };
    }).filter(Boolean) as OptionalFieldConfig[];
  }, [activeTemplate, resolveTemplateField]);

  useEffect(() => {
    setOptionalForm({
      return_window_days: "",
      return_sla_start_event: "",
      utr_prefix: "",
      notes: "",
    });
  }, [activeTemplate, optionalFieldConfigs]);

  const basicsFieldConfigs = useMemo((): BasicsFieldConfig[] => {
    return BASICS_FIELD_DEFINITIONS.map((definition) => {
      const resolved = resolveTemplateField(definition.synonyms);
      const templateField = resolved && isWizardVisibleField(resolved) ? resolved : null;
      if (resolved && !templateField) return null;
      const options = normalizeTemplateOptions(templateField, definition.id);
      const inputType = inferInputType(templateField, definition.fallbackType ?? "text", options.length);
      const required = Boolean(templateField?.mandatory ?? DEFAULT_BASICS_REQUIRED[definition.id]);
      return {
        id: definition.id,
        templateField,
        inputType,
        options,
        label: templateField?.label ?? definition.defaultLabel,
        helpText: templateField?.help_text ?? templateField?.description ?? definition.defaultHelpText,
        required,
      };
    }).filter(Boolean) as BasicsFieldConfig[];
  }, [resolveTemplateField]);

  const commissionFieldConfig = useMemo(() => {
    const resolved = resolveTemplateField([
      "commission_percent",
      "commission",
      "commission_rate",
      "commission %",
    ]);
    const templateField = resolved && isWizardVisibleField(resolved) ? resolved : null;
    return {
      templateField,
      label: templateField?.label ?? "Commission %",
      helpText:
        templateField?.help_text ??
        templateField?.description ??
        "Enter the flat commission percentage that applies to every sale.",
      required: Boolean(templateField?.mandatory ?? true),
    };
  }, [resolveTemplateField]);

  const tieredColumnConfigs = useMemo((): Record<"min" | "max" | "rate", TieredColumnConfig> => {
    return {
      min: {
        field: (() => {
          const resolved = resolveTemplateField(["min_price", "slab_min", "price_from", "min"]);
          return resolved && isWizardVisibleField(resolved) ? resolved : null;
        })(),
        fallbackLabel: "Min Price (₹)",
        fallbackHelp: "Starting price for the slab.",
      },
      max: {
        field: (() => {
          const resolved = resolveTemplateField(["max_price", "slab_max", "price_to", "max"]);
          return resolved && isWizardVisibleField(resolved) ? resolved : null;
        })(),
        fallbackLabel: "Max Price (₹)",
        fallbackHelp: "Ending price for the slab.",
      },
      rate: {
        field: (() => {
          const resolved = resolveTemplateField(["commission_percent", "slab_commission", "rate"]);
          return resolved && isWizardVisibleField(resolved) ? resolved : null;
        })(),
        fallbackLabel: "Commission %",
        fallbackHelp: "Percentage commission for orders within this range.",
      },
    };
  }, [resolveTemplateField]);

const validityFieldConfigs = useMemo(() => {
  return VALIDITY_FIELD_DEFINITIONS.map((definition) => {
    const resolved = resolveTemplateField(definition.synonyms);
    const templateField = resolved && isWizardVisibleField(resolved) ? resolved : null;
    if (resolved && !templateField) return null;
    return {
      key: definition.key,
      label: templateField?.label ?? definition.defaultLabel,
      helpText:
        definition.key === "effective_to"
          ? definition.defaultHelpText
          : templateField?.help_text ?? templateField?.description ?? definition.defaultHelpText,
      required: Boolean(templateField?.mandatory ?? definition.required),
    };
  }).filter(Boolean) as ValidityFieldConfig[];
}, [resolveTemplateField]);

  useEffect(() => {
    setValidityForm((prev) => {
      // Preserve any user edits or prefill; only seed when empty
      const nextFrom =
        hasContent(prev.effective_from) ? prev.effective_from : !isEditMode ? todayIso : prev.effective_from ?? "";
      const nextTo = prev.effective_to ?? "";
      return {
        effective_from: nextFrom,
        effective_to: nextTo,
      };
    });
  }, [activeTemplate, validityFieldConfigs, isEditMode, todayIso]);

  const steps = useMemo(
    () =>
      STEP_DEFINITIONS.map((definition) => ({
        id: definition.id,
        title: definition.title,
        description: definition.description,
        placeholder: definition.buildPlaceholder({ template: activeTemplate, templateType }),
      })),
    [activeTemplate, templateType],
  );

  const totalSteps = steps.length;
  const currentStep = steps[activeStep];
  const completionPercent = useMemo(
    () => Math.round(((activeStep + 1) / totalSteps) * 100),
    [activeStep, totalSteps],
  );

  const goToStep = (nextStep: number) => {
    setActiveStep(Math.min(Math.max(nextStep, 0), totalSteps - 1));
  };

  const goNext = () => {
    const currentStepId = currentStep?.id as keyof StepRequirementMap | undefined;
    const currentReady = currentStepId ? stepCompletionMap[currentStepId] ?? true : true;

    if (!currentReady) {
      setStepValidationAttempted(true);
      if (currentStepId) {
        setMissingSections((prev) => {
          const next = new Set(prev);
          next.add(currentStepId);
          return next;
        });
      }
      if (currentStepId === "taxes") {
        setTaxTouched((prev) => ({ ...prev, gst: true }));
      }
      if (currentStepId === "settlement") {
        setSettlementTouched(true);
      }
      return;
    }

    // Gap detection only on tiered commission step
    if (currentStep?.id === "commission" && commissionMode === "tiered" && !ignoreSlabGapWarnings) {
      const gaps = detectSlabGaps(tieredSlabs);
      setPendingSlabGaps(gaps);
      if (gaps.length > 0) {
        setGapModalOpen(true);
        return;
      }
    }
    setHighlightedGapIndices([]);

    if (currentStep?.id === "options") {
      if (optionsValidationError) {
        setOptionsValidationAttempted(true);
        return;
      }
      setOptionsValidationAttempted(false);
    }

    setStepValidationAttempted(false);
    if (currentStepId) {
      setMissingSections((prev) => {
        const next = new Set(prev);
        next.delete(currentStepId);
        return next;
      });
    }
    goToStep(activeStep + 1);
  };
  const goBack = () => goToStep(activeStep - 1);

  useEffect(() => {
    setStepValidationAttempted(false);
  }, [activeStep]);

  const handleTemplateSelect = useCallback(
    (choice: TemplateVariant) => {
      if (isEditMode) return;
      setTemplateType(choice);
      setCommissionType(choice);
      setActiveStep(0);
      setBasicsForm((previous) => ({
        ...previous,
        commission_type: choice,
      }));
      // re-evaluate dots immediately after template selection
      setIgnoreSlabGapWarnings(false);
      setHighlightedGapIndices([]);
    },
    [isEditMode],
  );

  const updateBasicsField = useCallback((field: BasicsFieldKey, value: string) => {
    setBasicsForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }, []);

  const updateTieredSlab = useCallback((rowId: string, field: TieredSlabKey, value: string) => {
    setTieredSlabs((rows) => {
      const index = rows.findIndex((row) => row.id === rowId);
      if (index === -1) return rows;

      const nextRows = rows.map((row, idx) => {
        if (idx !== index) return row;
        const sanitized = field === "min_price" || field === "max_price" ? sanitizePriceInput(value) : value;
        const patch: Partial<TieredSlab> = { [field]: sanitized };
        if (field === "max_price") patch.noUpperLimit = false;
        if (field === "min_price") {
          patch.minTouched = true;
          patch.minAutoFilled = false;
        }
        return { ...row, ...patch };
      });

      if (field === "max_price") {
        const current = nextRows[index];
        const parsedMax =
          value === null || value === "" || value === undefined ? null : Number(value);
        const minNum = Number(current.min_price ?? 0);
        if (parsedMax !== null) {
          if (Number.isNaN(parsedMax) || parsedMax < 0 || parsedMax <= minNum) {
            // allow the value to be stored so the user can see the error, but don't normalize chain
            return nextRows;
          }
        }
      }

      return normalizeSlabs(nextRows);
    });
    setIgnoreSlabGapWarnings(false);
    setHighlightedGapIndices([]);
  }, []);

  const toggleNoUpperLimit = useCallback(
    (rowId: string, enabled: boolean) => {
      setTieredSlabs((rows) => {
        const targetIndex = rows.findIndex((row) => row.id === rowId);
        if (targetIndex === -1) return rows;
        const lastIndex = rows.length - 1;
        if (targetIndex !== lastIndex) return rows;

        const next = rows.map((row, idx) => {
          if (idx !== targetIndex) return row;
          return {
            ...row,
            noUpperLimit: enabled,
            max_price: enabled ? null : "",
          };
        });
        return normalizeSlabs(next);
      });
      setIgnoreSlabGapWarnings(false);
      setHighlightedGapIndices([]);
    },
    [],
  );

  const closeNoUpperLimitModal = useCallback(() => {
    setPendingNoUpperLimit(null);
  }, []);

  const removeTieredSlab = useCallback((rowId: string) => {
    setTieredSlabs((rows) => {
      if (rows.length <= 1) return rows;
      const next = rows.filter((row) => row.id !== rowId);
      return normalizeSlabs(next);
    });
    setIgnoreSlabGapWarnings(false);
    setHighlightedGapIndices([]);
  }, []);

  useEffect(() => {
    if (!newSlabFocusRef.current) return;
    const targetId = `${newSlabFocusRef.current}-min`;
    const el = document.getElementById(targetId) as HTMLInputElement | null;
    if (el) el.focus();
    newSlabFocusRef.current = null;
  }, [tieredSlabs]);

  const addTieredSlab = useCallback(
    (opts?: { focusNew?: boolean }) => {
      setTieredSlabs((rows) => {
        if (!rows.length) return normalizeSlabs([createSlabRow()]);
        const last = rows[rows.length - 1];
        const lastMax = last.max_price === null || last.max_price === "" ? null : Number(last.max_price);
        if (last.noUpperLimit || lastMax === null || Number.isNaN(lastMax)) {
          // Require a valid max before adding a new slab
          return rows;
        }
        const newRow = createSlabRow();
        newRow.min_price = String(lastMax + 1);
        newRow.max_price = null;
        if (opts?.focusNew) {
          newSlabFocusRef.current = newRow.id;
        }
        return normalizeSlabs([...rows, newRow]);
      });
      setIgnoreSlabGapWarnings(false);
      setHighlightedGapIndices([]);
    },
    [createSlabRow],
  );

  function validateLogisticsSlabsRealtime(slabs: LogisticsSlabInput[]) {
    for (let i = 0; i < slabs.length; i += 1) {
      for (let j = i + 1; j < slabs.length; j += 1) {
        const a = slabs[i];
        const b = slabs[j];
        if (
          a.zone === b.zone &&
          a.weight_min_grams !== "" &&
          a.weight_max_grams !== "" &&
          b.weight_min_grams !== "" &&
          b.weight_max_grams !== ""
        ) {
          const aMin = Number(a.weight_min_grams);
          const aMax = Number(a.weight_max_grams);
          const bMin = Number(b.weight_min_grams);
          const bMax = Number(b.weight_max_grams);

          if (aMin < bMax && bMin < aMax) {
            setLogisticsSlabError(
              `Overlapping weight ranges detected for zone "${a.zone}". Please fix before saving.`,
            );
            return;
          }
        }
      }
    }

    const sorted = [...slabs]
      .filter(
        (slab) =>
          slab.zone === "national" &&
          slab.weight_min_grams !== "" &&
          slab.weight_max_grams !== "",
      )
      .sort((a, b) => Number(a.weight_min_grams) - Number(b.weight_min_grams));

    for (let i = 0; i < sorted.length - 1; i += 1) {
      const currentMax = Number(sorted[i].weight_max_grams);
      const nextMin = Number(sorted[i + 1].weight_min_grams);
      if (nextMin > currentMax + 1) {
        setLogisticsSlabError(
          `Gap detected between ${currentMax}g and ${nextMin}g in national zone. Orders in this range will not be reconciled.`,
        );
        return;
      }
    }

    setLogisticsSlabError(null);
  }

  const addLogisticsSlab = useCallback(() => {
    const newSlabs = [
      ...logisticsSlabs,
      createLogisticsSlabRow({
        weight_min_grams: "",
        weight_max_grams: "",
        zone: "national",
        forward_fee: "",
        reverse_fee: "",
      }),
    ];
    setLogisticsSlabs(newSlabs);
    validateLogisticsSlabsRealtime(newSlabs);
  }, [createLogisticsSlabRow, logisticsSlabs]);

  const removeLogisticsSlab = useCallback(
    (id: string) => {
      const newSlabs = logisticsSlabs.filter((slab) => slab.id !== id);
      setLogisticsSlabs(newSlabs);
      validateLogisticsSlabsRealtime(newSlabs);
    },
    [logisticsSlabs],
  );

  const updateLogisticsSlab = useCallback(
    (id: string, field: keyof LogisticsSlabInput, value: string | number) => {
      const normalizedValue =
        field === "zone"
          ? value
          : value === ""
            ? ""
            : Number(value);

      const newSlabs = logisticsSlabs.map((slab) =>
        slab.id === id ? { ...slab, [field]: normalizedValue } : slab,
      );
      setLogisticsSlabs(newSlabs);
      validateLogisticsSlabsRealtime(newSlabs);
    },
    [logisticsSlabs],
  );

  const handleLogisticsToggle = useCallback(() => {
    if (!logisticsEnabled && logisticsSlabs.length === 0) {
      const initial = [
        createLogisticsSlabRow({
          weight_min_grams: 0,
          weight_max_grams: "",
          zone: "national",
          forward_fee: "",
          reverse_fee: "",
        }),
      ];
      setLogisticsSlabs(initial);
      validateLogisticsSlabsRealtime(initial);
    }

    setLogisticsEnabled((prev) => {
      const next = !prev;
      if (!next) {
        setLogisticsSlabError(null);
      }
      return next;
    });
  }, [createLogisticsSlabRow, logisticsEnabled, logisticsSlabs.length]);

  const updateFeesField = useCallback((fieldKey: string, value: string) => {
    setFeesForm((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));
  }, []);

  const updateFeeMode = useCallback((fieldKey: string, mode: FeeValueMode) => {
    setFeeModes((prev) => ({
      ...prev,
      [fieldKey]: mode,
    }));
  }, []);

  const updateTaxField = useCallback((fieldKey: string, value: string) => {
    setTaxForm((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));
    setTaxTouched((prev) => ({
      ...prev,
      [fieldKey === "gst_percent" ? "gst" : "tcs"]: true,
    }));
  }, []);

  const updateSettlementField = useCallback((fieldKey: string, value: string) => {
    setSettlementForm((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));
    if (fieldKey === "settlement_basis") {
      setSettlementTouched(true);
    }
  }, []);

  const updateValidityField = useCallback(
    (fieldKey: string, value: string) => {
      // When editing a versioned card, prevent selecting dates earlier than today
      if (editingVersioned && fieldKey === "effective_from" && value) {
        const normalized = value.slice(0, 10);
        if (normalized < todayIso) {
          setValidityForm((prev) => ({
            ...prev,
            [fieldKey]: todayIso,
          }));
          return;
        }
      }
      setValidityForm((prev) => ({
        ...prev,
        [fieldKey]: value,
      }));
    },
    [editingVersioned, todayIso],
  );

  const updateOptionalField = useCallback((fieldKey: string, value: string) => {
    setOptionalForm((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));
  }, []);

  const buildRateCardPayload = useCallback(() => {
    const commissionType: TemplateVariant = basicsForm.commission_type === "tiered" ? "tiered" : "flat";
    const basePayload: Record<string, any> = {
      platform_id: basicsForm.platform_id?.trim(),
      category_id: basicsForm.category_id?.trim(),
      commission_type: commissionType,
      template_version: activeTemplate?.version ?? undefined,
      uploaded_by: "manual-ui",
      effective_from: validityForm.effective_from,
      effective_to: validityForm.effective_to?.trim() ? validityForm.effective_to : null,
      gst_percent: parseNumberInput(taxForm.gst_percent) ?? 0,
      tcs_percent: parseNumberInput(taxForm.tcs_percent) ?? 0,
      settlement_basis: settlementForm.settlement_basis || "delivery_date",
      t_plus_days: parseNumberInput(settlementForm.t_plus_days),
      weekly_weekday: null,
      bi_weekly_weekday: null,
      bi_weekly_which: null,
      monthly_day: null,
      grace_days: parseNumberInput(settlementForm.grace_days) ?? 0,
      notes: optionalForm.notes?.trim() || null,
    };

    if (commissionType === "flat") {
      basePayload.commission_percent = parseNumberInput(flatCommission) ?? 0;
      basePayload.slabs = [];
    } else {
      basePayload.commission_percent = null;
      basePayload.slabs = tieredSlabs
        .map((row) => {
          const commission_percent = parseNumberInput(row.commission_percent);
          if (commission_percent === null) return null;
          const max_price = row.noUpperLimit
            ? null
            : parseNumberInput(row.max_price === null ? "" : row.max_price);
          return {
            min_price: parseNumberInput(row.min_price) ?? 0,
            max_price,
            commission_percent,
          };
        })
        .filter((slab): slab is { min_price: number; max_price: number | null; commission_percent: number } => Boolean(slab));
    }

    const normalizedFees =
      feesFieldConfigs
        .filter((field) => field.inputType === "number")
        .map((field) => {
          const fee_value = parseNumberInput(feesForm[field.key]);
          if (fee_value === null) return null;
          const mode: FeeValueMode =
            field.supportsPercentToggle && feeModes[field.key] ? feeModes[field.key] : field.key.includes("percent")
              ? "percent"
              : "amount";
          const fee_type: "percent" | "amount" = mode === "percent" ? "percent" : "amount";
          return {
            fee_code: field.key,
            fee_type,
            fee_value,
          };
        })
        .filter((fee): fee is { fee_code: string; fee_type: "percent" | "amount"; fee_value: number } => Boolean(fee)) ??
      [];

    if (normalizedFees.length > 0) {
      basePayload.fees = normalizedFees;
    }

    basePayload.logistics_enabled = logisticsEnabled;
    basePayload.logistics_slabs = logisticsEnabled
      ? logisticsSlabs
          .filter(
            (slab) =>
              slab.weight_min_grams !== "" &&
              slab.weight_max_grams !== "" &&
              slab.forward_fee !== "",
          )
          .map((slab) => ({
            weight_min_grams: Number(slab.weight_min_grams),
            weight_max_grams: Number(slab.weight_max_grams),
            zone: slab.zone,
            forward_fee: Number(slab.forward_fee),
            reverse_fee: slab.reverse_fee !== "" ? Number(slab.reverse_fee) : null,
          }))
      : [];

    return basePayload;
  }, [
    basicsForm,
    feesFieldConfigs,
    feesForm,
    flatCommission,
    optionalForm,
    settlementForm,
    feeModes,
    logisticsEnabled,
    logisticsSlabs,
    taxForm,
    tieredSlabs,
    validityForm,
    activeTemplate,
  ]);

  const handleSave = useCallback(async (allowOverlapReplace = false) => {
    if (saving) return;
    if (isEditMode && (!prefillCard || prefillLoading || !editPrefillDone)) {
      setSaveError("Please wait while the existing rate card loads.");
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      if (
        logisticsEnabled &&
        logisticsSlabError &&
        logisticsSlabError.toLowerCase().includes("overlapping")
      ) {
        throw new Error(logisticsSlabError);
      }

      const payload = buildRateCardPayload();
      if (!payload.platform_id || !payload.category_id || !payload.effective_from) {
        throw new Error("Missing required fields. Please complete the form before saving.");
      }
      const endpoint = isEditMode && editId ? `/api/rate-cards/${editId}` : "/api/rate-cards";
      const method = isEditMode && editId ? "PUT" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          allow_overlap_replace: allowOverlapReplace,
          user_profile_id: currentUser?.id || null,
          user_name: currentUser?.full_name || null,
        }),
      });
      if (!response.ok) {
        const problem = await response.json().catch(() => null);
        throw new Error(problem?.message || "Failed to save rate card.");
      }
      navigate("/rate-cards");
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ?? (error as Error)?.message ?? "Failed to save rate card.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }, [
    buildRateCardPayload,
    editId,
    editPrefillDone,
    isEditMode,
    logisticsEnabled,
    logisticsSlabError,
    currentUser,
    navigate,
    prefillCard,
    prefillLoading,
    saving,
  ]);

  const commissionMode =
    (commissionType as TemplateVariant | null) ??
    (templateType as TemplateVariant | null) ??
    ((basicsForm.commission_type as TemplateVariant | null) ?? null);
  const hasUnlimitedSlab = useMemo(() => tieredSlabs.some((row) => row.noUpperLimit), [tieredSlabs]);

  const basicsComplete = useMemo(() => {
    if (!templateReady) return false;
    const templateRequiredOk = basicsFieldConfigs
      .filter((field) => field.required)
      .every((field) => Boolean((basicsForm[field.id] ?? "").toString().trim()));
    const productRequiredOk = PRODUCT_REQUIRED_FIELDS.basics.every((key) => {
      if (key === "marketplace") return Boolean((basicsForm.platform_id ?? "").toString().trim());
      if (key === "category") return Boolean((basicsForm.category_id ?? "").toString().trim());
      if (key === "commission_type") return Boolean((basicsForm.commission_type ?? "").toString().trim());
      return true;
    });
    return templateRequiredOk && productRequiredOk;
  }, [templateReady, basicsForm, basicsFieldConfigs]);

  const flatCommissionError = useMemo(() => {
    if (commissionMode !== "flat") return "";
    if (!commissionFieldConfig.required && !flatCommission.trim()) return "";
    if (!flatCommission.trim()) return "This value is required.";
    if (Number.isNaN(Number(flatCommission))) return "Enter a valid number.";
    return "";
  }, [commissionMode, flatCommission, commissionFieldConfig]);

  const tieredErrors = useMemo(() => {
    if (commissionMode !== "tiered") return [] as TieredSlabError[];
    const base = tieredSlabs.map((row, index) => {
      const errors: TieredSlabError = {};
      const minValue = Number(row.min_price);
      const maxValue = row.max_price === null ? null : Number(row.max_price);
      const rateValue = Number(row.commission_percent);
      const noUpper = Boolean(row.noUpperLimit);

      if (!row.min_price.trim()) {
        errors.min_price = "Required";
      } else if (Number.isNaN(minValue)) {
        errors.min_price = "Enter a number";
      }

      if (!noUpper) {
        const maxRaw = row.max_price === null ? "" : row.max_price.toString();
        if (!maxRaw.trim()) {
          errors.max_price = "Required";
        } else if (Number.isNaN(maxValue)) {
          errors.max_price = "Enter a number";
        } else if (!Number.isNaN(minValue) && maxValue !== null && maxValue <= minValue) {
          errors.max_price = "Must be > Min";
        }
      }

      if (!row.commission_percent.trim()) {
        errors.commission_percent = "Required";
      } else if (Number.isNaN(rateValue)) {
        errors.commission_percent = "Enter a number";
      }

      // Overlap check with next slab
      const next = tieredSlabs[index + 1];
      if (next) {
        const nextMinRaw = next.min_price ?? "";
        const nextMinValue = Number(nextMinRaw);
        const currentMaxValue =
          row.max_price === null || row.noUpperLimit ? null : Number(row.max_price);
        if (
          !row.noUpperLimit &&
          row.max_price !== null &&
          currentMaxValue !== null &&
          !Number.isNaN(currentMaxValue) &&
          nextMinRaw.toString().trim() &&
          !Number.isNaN(nextMinValue)
        ) {
          if (currentMaxValue >= nextMinValue) {
            errors.max_price =
              errors.max_price ??
              "Two commission ranges are overlapping. Each slab must cover a unique price range without overlaps — please adjust the min and max values.";
          }
        }
      }

      return errors;
    });

    const unlimitedIndexes = tieredSlabs.map((row, idx) => (row.noUpperLimit ? idx : -1)).filter((idx) => idx >= 0);
    if (unlimitedIndexes.length > 1) {
      unlimitedIndexes.forEach((idx) => {
        base[idx] = { ...base[idx], max_price: "Only one slab can be open-ended" };
      });
    } else if (unlimitedIndexes.length === 1) {
      const idx = unlimitedIndexes[0];
      if (idx !== tieredSlabs.length - 1) {
        base[idx] = { ...base[idx], max_price: "Open-ended slab must be the final slab" };
      }
    }

    return base;
  }, [tieredSlabs, commissionMode]);

  const tieredValid =
    commissionMode !== "tiered" ||
    (tieredSlabs.length > 0 &&
      tieredErrors.every((err) => !err.min_price && !err.max_price && !err.commission_percent));

  const tieredHasGaps = useMemo(() => {
    if (commissionMode !== "tiered") return false;
    return detectSlabGaps(tieredSlabs).length > 0;
  }, [commissionMode, tieredSlabs]);

  const tieredHasFinalNoLimit = useMemo(() => {
    if (commissionMode !== "tiered") return true;
    if (!tieredSlabs.length) return false;
    return Boolean(tieredSlabs[tieredSlabs.length - 1]?.noUpperLimit);
  }, [commissionMode, tieredSlabs]);

  const commissionComplete = useMemo(() => {
    if (!templateReady) return false;
    const productRequiredOk = (() => {
      if (commissionMode === "flat") {
        return Boolean(flatCommission.trim());
      }
      if (commissionMode === "tiered") {
        return tieredValid && tieredHasFinalNoLimit && !tieredHasGaps;
      }
      return false;
    })();
    return productRequiredOk;
  }, [templateReady, commissionMode, flatCommission, tieredValid, tieredHasFinalNoLimit, tieredHasGaps]);

  const getWizardValue = useCallback(
    (fieldKey: string): string => {
      if (fieldKey in feesForm) return feesForm[fieldKey];
      if (fieldKey in settlementForm) return settlementForm[fieldKey];
      if (fieldKey in taxForm) return taxForm[fieldKey];
      if (fieldKey in validityForm) return validityForm[fieldKey];
      if (fieldKey in optionalForm) return optionalForm[fieldKey];
      if (fieldKey in basicsForm) return basicsForm[fieldKey as BasicsFieldKey] ?? "";
      if (fieldKey === "commission_type") return commissionMode ?? "";
      if (fieldKey === "commission_percent") {
        return commissionMode === "flat" ? flatCommission : "";
      }
      return "";
    },
    [feesForm, settlementForm, taxForm, validityForm, optionalForm, basicsForm, commissionMode, flatCommission],
  );

  const evaluateDependencies = useCallback(
    (dependsOn: TemplateFieldDependency[]) => {
      if (!dependsOn.length) return true;
      return dependsOn.every((dependency) => {
        if (typeof dependency === "string") {
          return Boolean(getWizardValue(dependency));
        }
        if (!dependency.field) return true;
        const targetValue = getWizardValue(dependency.field);
        if (Array.isArray(dependency.values)) {
          const match = dependency.values.map(String).includes(String(targetValue ?? ""));
          return dependency.not ? !match : match;
        }
        const expected = dependency.value ?? dependency.equals;
        if (expected === undefined) {
          const truthy = Boolean(targetValue);
          return dependency.not ? !truthy : truthy;
        }
        const match = String(targetValue ?? "") === String(expected);
        return dependency.not ? !match : match;
      });
    },
    [getWizardValue],
  );

  const shouldDisplayFeeField = useCallback(
    (field: FeeFieldConfig) => evaluateDependencies(field.dependsOn),
    [evaluateDependencies],
  );

  const visibleFeeFields = useMemo(
    () => feesFieldConfigs.filter((field) => shouldDisplayFeeField(field)),
    [feesFieldConfigs, shouldDisplayFeeField],
  );

  const feeGroups = useMemo(() => {
    const groups: Record<string, FeeFieldConfig[]> = {
      "Platform Fees": [],
      "Order Outcome–Based Deductions": [],
      Other: [],
    };

    const platformKeys = new Set(["logistics_fee", "fixed_fee", "tech_fee", "platform_fee", "collection_fee_percent", "promo_contribution_percent", "technology_fee"]);
    const outcomeKeys = new Set(["return_fee", "return_logistics_fee", "cancellation_fee", "penalty", "adjustment", "penalties_adjustments"]);

    visibleFeeFields.forEach((field) => {
      const key = field.key;
      if (platformKeys.has(key)) {
        groups["Platform Fees"].push(field);
      } else if (outcomeKeys.has(key)) {
        groups["Order Outcome–Based Deductions"].push(field);
      } else {
        groups.Other.push(field);
      }
    });

    return Object.fromEntries(Object.entries(groups).filter(([, fields]) => fields.length > 0));
  }, [visibleFeeFields]);

  // Step 3 (Fees) is fully optional
  const feesComplete = true;

  const visibleSettlementFields = useMemo(
    () => settlementFieldConfigs.filter((field) => evaluateDependencies(field.dependsOn)),
    [settlementFieldConfigs, evaluateDependencies],
  );

  const optionsValidationError = useMemo(() => {
    const win = parseNumberInput(optionalForm.return_window_days);
    const sla = optionalForm.return_sla_start_event;
    if (win !== null && win > 0 && !hasContent(sla)) return true;
    return false;
  }, [optionalForm.return_window_days, optionalForm.return_sla_start_event]);

  const optionsStepReady = useMemo(() => {
    if (!optionsValidationAttempted) return true;
    return !optionsValidationError;
  }, [optionsValidationAttempted, optionsValidationError]);

  const tPlusDaysValidationError = useMemo(
    () => getTPlusDaysValidationError(settlementForm),
    [settlementForm],
  );

  const settlementComplete = useMemo(() => {
    if (!templateReady) return false;
    const productRequiredOk = PRODUCT_REQUIRED_FIELDS.settlement.every((key) => {
      if (key === "settlement_basis") return validateSettlementTerms(settlementForm);
      if (key === "t_plus_days") return !tPlusDaysValidationError;
      return true;
    });
    return productRequiredOk;
  }, [templateReady, settlementForm, tPlusDaysValidationError]);

  const validityDateError = useMemo(() => {
    const start = validityForm.effective_from?.trim();
    const end = validityForm.effective_to?.trim();
    if (!start) return "";
    const startDate = new Date(start);
    const todayDate = new Date(todayIso);
    if (Number.isNaN(startDate.valueOf())) return "";
    if (editingVersioned && startDate < todayDate) {
      return "Start date cannot be before today.";
    }
    if (!end) return "";
    const endDate = new Date(end);
    if (Number.isNaN(endDate.valueOf())) return "";
    return endDate < startDate ? "Effective To cannot be earlier than Effective From." : "";
  }, [validityForm.effective_from, validityForm.effective_to, editingVersioned, todayIso]);

  const getPreviewStatus = useCallback((fromDate: string | null, toDate: string | null) => {
    const today = new Date().toISOString().slice(0, 10);
    const from = (fromDate ?? "").trim();
    const to = (toDate ?? "").trim();
    if (from && from > today) return "Upcoming" as const;
    if (to && to < today) return "Expired" as const;
    if (from && from <= today && (!to || to >= today)) return "Active" as const;
    return "Upcoming" as const;
  }, []);

  const validityStatus = useMemo(
    () => getPreviewStatus(validityForm.effective_from, validityForm.effective_to),
    [getPreviewStatus, validityForm.effective_from, validityForm.effective_to],
  );

  const validityStatusColor = useMemo(() => {
    switch (validityStatus) {
      case "Active":
        return "bg-emerald-100 text-emerald-800";
      case "Upcoming":
        return "bg-sky-100 text-sky-700";
      case "Expired":
        return "bg-rose-100 text-rose-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  }, [validityStatus]);

  const formatPreviewDate = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return value;
    return date.toLocaleDateString("en-GB");
  };

  const validityStatusLabel = useMemo(() => {
    const from = formatPreviewDate(validityForm.effective_from);
    const to = formatPreviewDate(validityForm.effective_to);
    switch (validityStatus) {
      case "Upcoming":
        return from ? `Upcoming — activates on ${from}` : "Upcoming";
      case "Expired":
        return to ? `Expired — ended on ${to}` : "Expired";
      case "Active":
      default:
        return "Active — currently applicable";
    }
  }, [validityStatus, validityForm.effective_from, validityForm.effective_to]);

  const validityComplete = useMemo(() => {
    if (!templateReady) return false;
    const requiredFilled = validityFieldConfigs
      .filter((field) => field.required)
      .every((field) => Boolean((validityForm[field.key] ?? "").toString().trim()));
    const productRequiredOk = PRODUCT_REQUIRED_FIELDS.validity.every((key) => {
      if (key === "start_date") return Boolean((validityForm.effective_from ?? "").toString().trim());
      if (key === "end_date") return true; // optional per latest rules
      return true;
    });
    const startDate = validityForm.effective_from ? new Date(validityForm.effective_from) : null;
    const startOk =
      !editingVersioned ||
      (startDate !== null && !Number.isNaN(startDate.valueOf()) && startDate >= new Date(todayIso));
    return requiredFilled && productRequiredOk && startOk && !validityDateError;
  }, [templateReady, validityFieldConfigs, validityForm, validityDateError, editingVersioned, todayIso]);

  const optionsComplete = true;

  const taxesComplete = useMemo(() => {
    if (!templateReady) return false;
    const gstOk = Boolean((taxForm.gst_percent ?? "").toString().trim());
    const touchedOk = taxTouched.gst;
    const productRequiredOk = PRODUCT_REQUIRED_FIELDS.taxes.every((key) => {
      if (key === "gst_percentage") return gstOk;
      if (key === "tcs_percentage") return true; // optional per latest rules
      return true;
    });
    return productRequiredOk && touchedOk;
  }, [templateReady, taxForm, taxTouched]);

  const stepCompletionMap = useMemo((): StepRequirementMap => {
    return {
      basics: basicsComplete,
      commission: commissionComplete,
      fees: true,
      taxes: taxesComplete,
      settlement: settlementComplete,
      validity: validityComplete,
      options: optionsStepReady,
      review: true,
    };
  }, [basicsComplete, commissionComplete, taxesComplete, settlementComplete, validityComplete, optionsStepReady]);

  const isStepUnlocked = useCallback(
    (index: number) => {
      if (index === 0) return true;
      const requiredIds = steps.slice(0, index).map((step) => step.id as keyof StepRequirementMap);
      return requiredIds.every((id) => stepCompletionMap[id] ?? true);
    },
    [steps, stepCompletionMap],
  );

  const canNavigateToStep = useCallback(
    (targetIndex: number) => {
      if (targetIndex <= activeStep) return true;
      return isStepUnlocked(targetIndex);
    },
    [activeStep, isStepUnlocked],
  );

  const currentStepId = steps[activeStep]?.id as keyof StepRequirementMap | undefined;
  const currentStepReady = currentStepId ? stepCompletionMap[currentStepId] ?? true : true;
  const editLoadingBlocker =
    isEditMode && (!prefillCard || prefillLoading || !templateReady || !editPrefillDone);
  const nextDisabled = editLoadingBlocker || (activeStep === totalSteps - 1 ? false : !currentStepReady);
  const handleExit = useCallback(() => setShowExitModal(true), []);
  const confirmExit = useCallback(() => navigate("/rate-cards"), [navigate]);

  const handleSlabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>, row: TieredSlab, index: number) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const errors = tieredErrors[index] || {};
      const rowValid = !errors.min_price && !errors.max_price && !errors.commission_percent;
      if (!rowValid) return;
      if (row.noUpperLimit) {
        if (commissionComplete) {
          goNext();
        }
        return;
      }
      addTieredSlab({ focusNew: true });
    },
    [tieredErrors, commissionComplete, addTieredSlab],
  );

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowExitModal(false);
      }
    };
    if (showExitModal) {
      window.addEventListener("keydown", onKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showExitModal]);

  const humanizeValue = useCallback((value: string | null | undefined) => {
    if (!value || `${value}`.trim().length === 0) return "—";
    const key = `${value}`.trim().toLowerCase();
    return REVIEW_DISPLAY_LABELS[key] ?? value;
  }, []);

  const reviewSummary = useMemo(() => {
    if (!templateReady) return { loading: true, sections: [], missingCount: 0 };

    const sections: Array<{
      title: string;
      rows?: Array<{ label: string; value: React.ReactNode; required?: boolean; hasValue?: boolean }>;
      custom?: React.ReactNode;
      missingCount?: number;
    }> = [];

    const formatDateValue = (value?: string | null) => {
      if (!value) return "—";
      const date = new Date(value);
      return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleDateString("en-GB");
    };

    const formatWeekday = (value?: string | number | null) => {
      const num = Number(value);
      if (Number.isNaN(num) || num < 1 || num > 7) return value ? String(value) : "—";
      return WEEKDAY_LABELS[num - 1];
    };

    const basicsRows = [
      {
        label: "Platform",
        value: basicsForm.platform_id || "—",
        required: true,
        hasValue: hasContent(basicsForm.platform_id),
      },
      {
        label: "Category",
        value: basicsForm.category_id || "—",
        required: true,
        hasValue: hasContent(basicsForm.category_id),
      },
      {
        label: "Template Type",
        value: templateType ? humanizeValue(templateType) : "—",
        required: true,
        hasValue: Boolean(templateType),
      },
    ];

    const isFlat = commissionMode === "flat";
    const commissionRows = isFlat
      ? [
          {
            label: "Commission Type",
            value: "Flat %",
            required: true,
            hasValue: true,
          },
          {
            label: "Commission %",
            value: flatCommission ? `${flatCommission}%` : "—",
            required: true,
            hasValue: hasContent(flatCommission),
          },
        ]
      : [];
    const tieredMissing =
      !isFlat &&
      (!tieredSlabs.length ||
        tieredSlabs.some(
          (row) => !hasContent(row.min_price) || !hasContent(row.commission_percent),
        ));
    const tieredContent = !isFlat ? (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Min Price</th>
              <th className="px-4 py-2 text-left">Max Price</th>
              <th className="px-4 py-2 text-left">Commission %</th>
            </tr>
          </thead>
          <tbody>
            {tieredSlabs.map((slab) => (
              <tr key={slab.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  <span className="font-semibold text-slate-800">
                    {hasContent(slab.min_price) ? formatCurrency(slab.min_price) : "—"}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className="font-semibold text-slate-800">
                    {slab.noUpperLimit ? "∞" : hasContent(slab.max_price) ? formatCurrency(slab.max_price) : "—"}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className="font-semibold text-slate-800">
                    {hasContent(slab.commission_percent) ? `${slab.commission_percent}%` : "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : null;

    const taxRows = [
      {
        label: "GST %",
        value: taxForm.gst_percent || "—",
        required: true,
        hasValue: hasContent(taxForm.gst_percent),
      },
      {
        label: "TCS %",
        value: taxForm.tcs_percent || "—",
        required: true,
        hasValue: hasContent(taxForm.tcs_percent),
      },
    ];

    const settlementRows = [
      {
        label: "Settlement Anchor",
        value: settlementForm.settlement_basis
          ? SETTLEMENT_LABELS[settlementForm.settlement_basis] ?? humanizeValue(settlementForm.settlement_basis)
          : "—",
        required: true,
        hasValue: hasContent(settlementForm.settlement_basis),
      },
      {
        label: "Expected Payout After (Days)",
        value: hasContent(settlementForm.t_plus_days) ? settlementForm.t_plus_days : "—",
        required: true,
        hasValue: !tPlusDaysValidationError,
      },
      {
        label: "Grace Days",
        value: hasContent(settlementForm.grace_days) ? settlementForm.grace_days : "—",
        required: false,
        hasValue: true,
      },
    ];

    const validityRows = [
      {
        label: "Effective From",
        value: formatDateValue(validityForm.effective_from),
        required: true,
        hasValue: hasContent(validityForm.effective_from),
      },
      {
        label: "Effective To",
        value: formatDateValue(validityForm.effective_to),
        required: false,
        hasValue: hasContent(validityForm.effective_to),
      },
    ];

    const additionalRows = optionalFieldConfigs.map((field) => {
      const rawValue = optionalForm[field.key];
      const displayValue =
        field.key === "return_sla_start_event" ? humanizeValue(rawValue) : humanizeValue(rawValue);
      return {
        label: field.label,
        value: displayValue,
        required: field.required,
        hasValue: hasContent(rawValue),
      };
    });

    sections.push({ title: "Scope & Template", rows: basicsRows });
    sections.push({
      title: "Commission Structure",
      rows: isFlat ? commissionRows : undefined,
      custom: !isFlat ? tieredContent : undefined,
      missingCount: !isFlat && tieredMissing ? 1 : 0,
    });
    let feesMissingCount = 0;
    let feesCustom: React.ReactNode;
    const feeGroupEntries = Object.entries(feeGroups);
    if (!feeGroupEntries.length) {
      feesCustom = <p className="text-sm text-slate-500">No fee or deduction fields for this template.</p>;
    } else {
      feesCustom = (
        <div className="space-y-4">
          {feeGroupEntries.map(([groupLabel, fields]) => (
            <div key={groupLabel}>
              <p className="text-sm font-semibold text-slate-700">{groupLabel}</p>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                {fields.map((field) => {
                  const value = feesForm[field.key]?.trim() || "";
                  return (
                    <div
                      key={field.key}
                      className="mb-2 flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
                    >
                      <dt className="text-slate-500">{field.label}</dt>
                      <dd className="text-slate-900 font-semibold">{value || "—"}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ))}
        </div>
      );
      feesMissingCount = feeGroupEntries
        .flatMap(([_, fields]) => fields)
        .filter((field) => field.required)
        .reduce((count, field) => {
          const value = feesForm[field.key]?.trim();
          return count + (hasContent(value) ? 0 : 1);
        }, 0);
    }
    sections.push({
      title: "Fees & Deductions",
      custom: feesCustom,
      missingCount: feesMissingCount,
    });
    sections.push({ title: "Taxes", rows: taxRows });
    sections.push({ title: "Settlement Terms", rows: settlementRows });
    sections.push({
      title: "Validity",
      rows: validityRows,
      missingCount: validityDateError ? 1 : 0,
    });
    sections.push({ title: "Additional Information", rows: additionalRows });

    const missingCount = sections.reduce(
      (count, section) =>
        count +
        (section.rows?.filter((row) => row.required && !row.hasValue).length ?? 0) +
        (section.missingCount ?? 0),
      0,
    );

    return { loading: false, sections, missingCount };
  }, [
    basicsForm,
    commissionMode,
    feeGroups,
    feesForm,
    flatCommission,
    optionalFieldConfigs,
    optionalForm,
    settlementForm,
    taxForm,
    templateReady,
    templateType,
    tPlusDaysValidationError,
    tieredSlabs,
    validityDateError,
    validityForm,
  ]);

  useEffect(() => {
    if (reviewSummary.loading) return;
    if (!reviewSummary.sections?.length) return;
    setExpandedReviewSections((prev) => {
      if (prev.size > 0) return prev;
      return new Set([reviewSummary.sections[0].title]);
    });
  }, [reviewSummary.loading, reviewSummary.sections]);

  useEffect(() => {
    if (reviewSummary.missingCount === 0) {
      setMissingSections(new Set());
    }
  }, [reviewSummary.missingCount]);

  const handlePublishClick = useCallback(async () => {
    if (reviewSummary.missingCount > 0) {
      if (tPlusDaysValidationError) {
        setSaveError(T_PLUS_DAYS_VALIDATION_MESSAGE);
      }
      const missingTitles: string[] = [];
      reviewSummary.sections.forEach((section) => {
        const hasMissing =
          (section.rows?.some((row) => row.required && !row.hasValue) ?? false) || (section.missingCount ?? 0) > 0;
        if (hasMissing) missingTitles.push(section.title);
      });

      if (missingTitles.length) {
        setExpandedReviewSections((prev) => {
          const next = new Set(prev);
          missingTitles.forEach((t) => next.add(t));
          return next;
        });
        const missingStepIds = new Set<string>();
        missingTitles.forEach((title) => {
          const stepId = SECTION_STEP_MAP[title];
          if (stepId) missingStepIds.add(stepId);
        });
        setMissingSections(missingStepIds);
        setStepValidationAttempted(true);

        // Scroll to first missing section
        const firstTitle = missingTitles[0];
        const el = sectionRefs.current.get(firstTitle);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
      return;
    }

    setSaveError(null);

    // If overlap warning already known, show modal
    if (validityOverlapWarning) {
      setShowOverlapPublishModal(true);
      return;
    }

    // Call server validation to check overlap before publish
    try {
      const payload = buildRateCardPayload();
      const response = await fetch("/api/rate-cards/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: "",
          marketplace: payload.platform_id,
          category: payload.category_id,
          template_type: payload.template_type ?? payload.commission_type,
          effective_from: payload.effective_from,
          effective_to: payload.effective_to ?? null,
          source: "wizard",
        }),
      });
      if (!response.ok) {
        setShowOverlapPublishModal(true);
        return;
      }
      const result = await response.json();
      if (result.conflictType && result.conflictType !== "NO_CONFLICT") {
        setShowOverlapPublishModal(true);
        return;
      }
      void handleSave(false);
    } catch (err) {
      // fallback: block and show modal if validation call fails
      setShowOverlapPublishModal(true);
    }
  }, [
    buildRateCardPayload,
    handleSave,
    reviewSummary.missingCount,
    reviewSummary.sections,
    tPlusDaysValidationError,
    validityOverlapWarning,
  ]);

  const renderBasicsFieldControl = (field: BasicsFieldConfig, missing?: boolean) => {
    const value = basicsForm[field.id] ?? "";
    const baseClasses =
      "w-full rounded-xl border px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:outline-none focus:ring-2";
    const borderClasses = missing
      ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
      : "border-slate-300 focus:border-teal-500 focus:ring-teal-200";

    if (field.inputType === "select" && field.options.length) {
      return (
        <select
          id={`wizard-${field.id}`}
          name={field.id}
          value={value}
          onChange={(event) => updateBasicsField(field.id, event.target.value)}
          className={`${baseClasses} bg-white ${borderClasses}`}
          aria-invalid={missing ? "true" : "false"}
        >
          <option value="">Select Settlement Basis</option>
          {field.options.map((option) => (
            <option key={`${field.id}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.inputType === "radio" && field.options.length) {
      return (
        <div className="flex flex-wrap gap-3">
          {field.options.map((option) => {
            const checked = value === option.value;
          return (
            <label
              key={`${field.id}-${option.value}`}
              className={`cursor-pointer rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                checked
                  ? "border-teal-300 bg-teal-50 text-teal-700 shadow-sm"
                  : `text-slate-600 hover:border-teal-200 hover:bg-slate-50 ${
                      missing ? "border-rose-300 bg-rose-50" : "border-slate-200"
                    }`
              }`}
            >
              <input
                type="radio"
                className="sr-only"
                  name={field.id}
                  value={option.value}
                  checked={checked}
                  onChange={() => handleTemplateSelect(option.value as TemplateVariant)}
                />
                {option.label}
              </label>
            );
          })}
        </div>
      );
    }

    return (
      <input
        id={`wizard-${field.id}`}
        name={field.id}
        type="text"
        value={value}
        onChange={(event) => updateBasicsField(field.id, event.target.value)}
        placeholder={`Enter ${field.label}`}
        className={`${baseClasses} ${borderClasses}`}
        aria-invalid={missing ? "true" : "false"}
      />
    );
  };

  const renderFeeFieldControl = (field: FeeFieldConfig, missing?: boolean) => {
    const value = feesForm[field.key] ?? "";
    const mode = field.supportsPercentToggle ? feeModes[field.key] ?? field.defaultMode ?? "amount" : "amount";
    const baseClasses =
      "w-full rounded-xl border px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:outline-none focus:ring-2";
    const borderClasses = missing
      ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
      : "border-slate-300 focus:border-teal-500 focus:ring-teal-200";
    if (field.inputType === "select" && field.options.length) {
      return (
        <select
          id={`fee-${field.key}`}
          value={value}
          onChange={(event) => updateFeesField(field.key, event.target.value)}
          className={`${baseClasses} bg-white ${borderClasses}`}
          aria-invalid={missing ? "true" : "false"}
        >
          <option value="">Select {field.label}</option>
          {field.options.map((option) => (
            <option key={`${field.key}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    const isNumber = field.inputType === "number";

    if (field.supportsPercentToggle) {
      return (
        <div className="space-y-3">
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold text-slate-600 shadow-sm">
            <button
              type="button"
              onClick={() => updateFeeMode(field.key, "amount")}
              className={`rounded-full px-3 py-1 transition ${
                mode === "amount" ? "bg-white text-teal-700 shadow-sm ring-1 ring-teal-200" : "hover:text-teal-600"
              }`}
            >
              Flat ₹
            </button>
            <button
              type="button"
              onClick={() => updateFeeMode(field.key, "percent")}
              className={`rounded-full px-3 py-1 transition ${
                mode === "percent" ? "bg-white text-teal-700 shadow-sm ring-1 ring-teal-200" : "hover:text-teal-600"
              }`}
            >
              %
            </button>
          </div>
          <input
            id={`fee-${field.key}`}
            type="number"
            inputMode="decimal"
            step="0.01"
            value={value}
            onChange={(event) => updateFeesField(field.key, event.target.value)}
            placeholder={mode === "percent" ? "Enter % value" : "Enter flat amount"}
            className={`${baseClasses} ${borderClasses}`}
            aria-invalid={missing ? "true" : "false"}
          />
        </div>
      );
    }

    return (
      <input
        id={`fee-${field.key}`}
        type={isNumber ? "number" : "text"}
        inputMode={isNumber ? "decimal" : "text"}
        step={isNumber ? "0.01" : undefined}
        value={value}
        onChange={(event) => updateFeesField(field.key, event.target.value)}
        placeholder={`Enter ${field.label}`}
        className={`${baseClasses} ${borderClasses}`}
        aria-invalid={missing ? "true" : "false"}
      />
    );
  };

  const renderSettlementFieldControl = (field: SettlementFieldConfig, missing?: boolean) => {
    const value = settlementForm[field.key] ?? field.defaultValue ?? "";
    const anchor = settlementForm.settlement_basis || "delivery_date";
    const baseClasses =
      "w-full rounded-xl border px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:outline-none focus:ring-2";
    const borderClasses = missing
      ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
      : "border-slate-300 focus:border-teal-500 focus:ring-teal-200";
    if (field.inputType === "select") {
      const options = field.options.length
        ? field.options
        : field.key === "settlement_basis"
            ? SETTLEMENT_BASIS_OPTIONS
            : SETTLEMENT_FIELD_DEFINITIONS.find((definition) => definition.key === field.key)?.fallbackOptions ?? [];
      return (
        <select
          id={`settlement-${field.key}`}
          value={value}
          onChange={(event) => updateSettlementField(field.key, event.target.value)}
          className={`${baseClasses} bg-white ${borderClasses}`}
          aria-invalid={missing ? "true" : "false"}
        >
          <option value="" disabled hidden>{`Select ${field.label}`}</option>
          {options
            .filter((option) => option.value !== "")
            .map((option) => (
              <option key={`${field.key}-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
        </select>
      );
    }

    const isNumber = field.inputType === "number";
    const placeholder =
      field.key === "t_plus_days"
        ? anchor === "settlement_generation"
          ? "e.g. 5 days after settlement"
          : "e.g. 7 days after delivery"
        : field.key === "grace_days"
          ? "e.g. 2"
          : `Enter ${field.label}`;
    return (
      <input
        id={`settlement-${field.key}`}
        type={isNumber ? "number" : "text"}
        step={field.key === "t_plus_days" ? "1" : isNumber ? "0.01" : undefined}
        min={field.key === "t_plus_days" ? 1 : undefined}
        inputMode={isNumber ? "decimal" : "text"}
        value={value}
        onChange={(event) => updateSettlementField(field.key, event.target.value)}
        placeholder={placeholder}
        className={`${baseClasses} ${borderClasses}`}
        aria-invalid={missing ? "true" : "false"}
      />
    );
  };

  const renderCommissionStep = () => {
    if (!templateReady) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6">
          <StepSkeleton lines={8} />
        </div>
      );
    }

    if (commissionMode === "tiered") {
      const minLabel = tieredColumnConfigs.min.field?.label ?? tieredColumnConfigs.min.fallbackLabel;
      const maxLabel = tieredColumnConfigs.max.field?.label ?? tieredColumnConfigs.max.fallbackLabel;
      const rateLabel = tieredColumnConfigs.rate.field?.label ?? tieredColumnConfigs.rate.fallbackLabel;

      const renderTooltipIcon = (text: string) => (
        <div className="group relative flex items-center">
          <Info className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg group-hover:block">
            <p className="text-[12px] leading-snug text-slate-600">{text}</p>
          </div>
        </div>
      );

          return (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-5 py-4 text-sm text-slate-700">
                <p className="text-sm font-semibold text-slate-800">How Tiered Commission Works</p>
                <p className="mt-1 text-sm text-slate-700">
              Different commission percentages apply to different item price ranges. Each order is matched to exactly
              one slab based on its item price.
            </p>
            <p className="mt-1 text-xs text-slate-500">Price ranges must be continuous and non-overlapping.</p>
          </div>

          <div className="space-y-5">
            {tieredSlabs.map((row, index) => {
              const errors = tieredErrors[index] || {};
              const isHighlighted = highlightedGapIndices.includes(index);
              const isLast = index === tieredSlabs.length - 1;
              const isFinalNoLimit = isLast && row.noUpperLimit;

              return (
                <div
                  key={row.id}
                  className={`relative rounded-2xl border p-6 shadow-sm transition hover:shadow-md ${
                    isFinalNoLimit ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"
                  }`}
                  style={
                    isHighlighted
                      ? { backgroundColor: "#FF5A5A33", borderColor: "#ff5a5ab3", borderWidth: 1 }
                      : undefined
                  }
                >
                  {isFinalNoLimit && (
                    <div className="mb-2 inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                      <span>Final slab</span>
                      <span className="text-[10px] font-normal text-emerald-600">Covers all higher order values</span>
                    </div>
                  )}
                  <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-8 slab-row items-start">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <span>{minLabel}</span>
                        {renderTooltipIcon(
                          tieredColumnConfigs.min.field?.help_text ??
                            "Lowest order item price included in this slab (inclusive).",
                        )}
                      </div>
                      <input
                        id={`${row.id}-min`}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={row.min_price}
                        onChange={(event) => updateTieredSlab(row.id, "min_price", event.target.value)}
                        onKeyDown={(event) => handleSlabKeyDown(event, row, index)}
                        readOnly
                        placeholder={row.minAutoFilled ? "Auto-filled" : `Enter ${minLabel}`}
                        className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200 ${
                          errors.min_price ? "border-rose-300 ring-rose-100" : "border-slate-300"
                        } bg-slate-100 text-slate-500 cursor-not-allowed`}
                      />
                      {errors.min_price && <p className="text-xs text-rose-500">{errors.min_price}</p>}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <span>{maxLabel}</span>
                        {renderTooltipIcon(
                          tieredColumnConfigs.max.field?.help_text ??
                            "Highest order item price included in this slab. Use 'No Limit' for the final slab.",
                        )}
                      </div>
                      <div className="flex items-center gap-2 w-full">
                        {row.noUpperLimit && isLast ? (
                          <div className="flex-1 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                            <span className="font-semibold text-slate-700">∞ No Limit</span>
                          </div>
                        ) : (
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={row.max_price ?? ""}
                            onChange={(event) => updateTieredSlab(row.id, "max_price", event.target.value)}
                            onKeyDown={(event) => handleSlabKeyDown(event, row, index)}
                            placeholder={isLast ? "Enter max price or set No Limit" : `Enter ${maxLabel}`}
                            className={`rc-input flex-1 rounded-xl border px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200 ${
                              errors.max_price ? "border-rose-300 ring-rose-100" : "border-slate-300"
                            }`}
                            style={{ pointerEvents: "auto" }}
                            disabled={row.noUpperLimit}
                          />
                        )}
                        <div className="group relative">
                          <NoLimitChip
                            active={Boolean(row.noUpperLimit)}
                            onToggle={() => toggleNoUpperLimit(row.id, !row.noUpperLimit)}
                            disabled={!isLast}
                          />
                          <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg group-hover:block">
                            <p className="text-[12px] leading-snug text-slate-600">
                              Final open-ended slab. No additional slabs can be added after this.
                            </p>
                          </div>
                        </div>
                      </div>
                      {row.noUpperLimit && isLast && (
                        <p className="text-xs text-slate-500">∞ No Limit active — cannot add more slabs.</p>
                      )}
                      {errors.max_price && <p className="text-xs text-rose-500">{errors.max_price}</p>}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <span>{rateLabel}</span>
                        {renderTooltipIcon(
                          tieredColumnConfigs.rate.field?.help_text ??
                            "Marketplace commission percentage applied to items in this price range.",
                        )}
                      </div>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={row.commission_percent}
                        onChange={(event) => updateTieredSlab(row.id, "commission_percent", event.target.value)}
                        onKeyDown={(event) => handleSlabKeyDown(event, row, index)}
                        placeholder={`Enter ${rateLabel}`}
                        className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200 ${
                          errors.commission_percent ? "border-rose-300 ring-rose-100" : "border-slate-300"
                        }`}
                      />
                      {errors.commission_percent && (
                        <p className="text-xs text-rose-500">{errors.commission_percent}</p>
                      )}
                    </div>

                    <div className="flex h-full items-center justify-end self-center">
                      <div className="group relative">
                        <button
                          type="button"
                          onClick={() => removeTieredSlab(row.id)}
                          disabled={index === 0 || tieredSlabs.length <= 1}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Remove slab"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        {index === 0 && (
                          <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg group-hover:block">
                            The first slab is mandatory and cannot be removed.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {commissionMode === "tiered" && (!tieredHasFinalNoLimit || tieredHasGaps) && (
            <p className="text-sm text-rose-600">
              Your price slabs must cover all order values. Add a final slab with “No Limit” to continue.
            </p>
          )}

          <p className="text-xs text-slate-500">
            If commission terms change in the future, you can create a new rate card. Past orders will continue to use
            the rate card that was active at the time.
          </p>

          <div className="mt-6 border-t border-slate-200 pt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => addTieredSlab()}
              disabled={hasUnlimitedSlab}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add Slab
            </button>
            {hasUnlimitedSlab && (
              <p className="text-xs text-slate-500">No more slabs allowed after ∞ No Limit.</p>
            )}
          </div>

          {tieredErrors.some((err) => err.min_price || err.max_price || err.commission_percent) && (
            <p className="text-red-500 text-sm mt-4">Complete every slab row with valid ranges before continuing.</p>
          )}

          {pendingNoUpperLimit && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-slate-900">Make this the final slab?</h3>
                <p className="mt-2 text-sm text-slate-600">
                  A slab with no upper limit must be the last slab in the structure.
                </p>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeNoUpperLimitModal}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const { rowId } = pendingNoUpperLimit;
                      setPendingNoUpperLimit(null);
                      toggleNoUpperLimit(rowId, true);
                    }}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-5 py-4 text-sm text-slate-600">
          Enter a single commission percentage that applies across every price point covered by this rate card.
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6">
          <div className="flex items-center gap-2">
            <label htmlFor="flat-commission" className="text-sm font-semibold text-slate-800">
              {commissionFieldConfig.label}
              <span className="ml-1 text-rose-500">*</span>
            </label>
            <div className="group relative flex items-center" tabIndex={0}>
              <Info className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-72 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg group-hover:block group-focus-within:block">
                <p className="text-[12px] font-semibold text-slate-800">Commission Percentage</p>
                <p className="mt-1 text-[12px] leading-snug text-slate-600">
                  This is the marketplace commission charged on the order’s sale value before taxes. It applies uniformly
                  to all orders covered by this rate card.
                </p>
              </div>
            </div>
          </div>
          <input
            id="flat-commission"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={flatCommission}
            onChange={(event) => setFlatCommission(event.target.value)}
            placeholder="Enter commission %"
          className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200 ${
              flatCommissionError ? "border-rose-300 ring-rose-100" : "border-slate-300"
            }`}
          />
          <p className="mt-2 text-xs text-slate-500">
            This commission percentage will apply to all orders covered by this rate card, regardless of item price.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            If commission terms change in the future, you can create a new rate card. Past orders will continue to use the rate card that was active at the time.
          </p>
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="text-sm font-semibold text-slate-800">How Flat Commission Works</p>
            <p className="mt-1 text-sm text-slate-600">
              A single commission percentage is applied uniformly across all orders covered by this rate card. This works best when marketplace fees do not vary by item price.
            </p>
          </div>
          <div className="mt-3">
            <button
              type="button"
              className="text-sm font-semibold text-teal-700 hover:text-teal-800"
              onClick={() => {
                setTemplateType("tiered");
                setCommissionType("tiered");
                setBasicsForm((prev) => ({ ...prev, commission_type: "tiered" }));
                setActiveStep(1);
              }}
            >
              Need price-based commissions? Switch to Tiered Rate Card.
            </button>
          </div>
          {flatCommissionError && (
            <p className="mt-3 text-[11px] text-rose-500">{flatCommissionError}</p>
          )}
        </div>
      </div>
    );
  };

  const renderFeesStep = () => {
    if (!templateReady) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6">
          <StepSkeleton lines={8} />
        </div>
      );
    }

    if (!visibleFeeFields.length) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-6 text-sm text-slate-500">
          No fee fields detected in the active template. This step will unlock once template metadata includes fee
          definitions.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-5 py-4 text-sm text-slate-600">
          Configure platform and logistics fees used during reconciliation.
        </div>
        {Object.entries(feeGroups).map(([groupLabel, fields]) => (
          <div
            key={groupLabel}
            className={`rounded-2xl border border-slate-100 bg-white px-5 py-6 shadow-sm ${
              groupLabel === "Platform Fees" ? "mt-2 mb-4" : ""
            }`}
          >
            <div className="border-b border-slate-100 pb-4">
              <p className="text-base font-semibold text-slate-900">{groupLabel}</p>
              <p className="text-sm text-slate-500">
                Used to explain and validate platform deductions during reconciliation.
              </p>
            </div>
            <div className="mt-4 space-y-5">
              {fields.map((field) => {
                const isNonDeterministic =
                  field.key === "penalty" || field.key === "adjustment" || field.key === "penalties_adjustments";
                return (
                  <div key={field.key} className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <label htmlFor={`fee-${field.key}`} className="text-sm font-semibold text-slate-800">
                        {field.label}
                      </label>
                      <div className="flex items-center gap-2">
                        {!field.required && (
                          <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">Optional</span>
                        )}
                        {isNonDeterministic && (
                          <div className="group relative">
                            <Info className="h-4 w-4 text-slate-400" aria-hidden="true" />
                            <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-72 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg group-hover:block">
                              These charges vary by marketplace and are not calculated from rate cards during reconciliation. They are captured as reported in settlements.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {field.supportsPercentToggle ? (
                      <div className="pt-1">{renderFeeFieldControl(field)}</div>
                    ) : (
                      renderFeeFieldControl(field)
                    )}
                    {field.helpText && (
                      <p className="text-xs text-slate-500">
                        {field.helpText} {!field.required ? "Optional — leave blank if not applicable." : ""}
                      </p>
                    )}
                    {!field.helpText && !field.required && (
                      <p className="text-xs text-slate-500">Optional — leave blank if not applicable.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className="rounded-2xl border border-slate-100 bg-white px-5 py-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <p className="text-base font-semibold text-slate-900">Logistics Fees</p>
              <p className="text-sm text-slate-500">
                Configure weight-based shipping fees for marketplace fulfilled orders.
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogisticsToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                logisticsEnabled ? "bg-teal-500" : "bg-slate-200"
              }`}
              aria-pressed={logisticsEnabled}
              aria-label="Toggle logistics fees"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  logisticsEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {logisticsEnabled && (
            <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-500">
                Applies to: Marketplace Fulfilled Orders
              </p>

              {logisticsSlabs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs text-slate-500">
                        <th className="py-2 pr-3 text-left">Weight Range (g)</th>
                        <th className="py-2 pr-3 text-left">Zone</th>
                        <th className="py-2 pr-3 text-left">Forward Fee (₹)</th>
                        <th className="py-2 pr-3 text-left">Reverse Fee (₹)</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {logisticsSlabs.map((slab) => (
                        <tr key={slab.id} className="border-b border-slate-50">
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={slab.weight_min_grams}
                                onChange={(e) =>
                                  updateLogisticsSlab(slab.id, "weight_min_grams", e.target.value)
                                }
                                className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
                              />
                              <span className="text-slate-400">–</span>
                              <input
                                type="number"
                                min="0"
                                placeholder="500"
                                value={slab.weight_max_grams}
                                onChange={(e) =>
                                  updateLogisticsSlab(slab.id, "weight_max_grams", e.target.value)
                                }
                                className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
                              />
                            </div>
                          </td>
                          <td className="py-2 pr-3">
                            <select
                              value={slab.zone}
                              onChange={(e) =>
                                updateLogisticsSlab(
                                  slab.id,
                                  "zone",
                                  e.target.value as LogisticsZone,
                                )
                              }
                              className="rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
                            >
                              <option value="local">Local</option>
                              <option value="regional">Regional</option>
                              <option value="national">National</option>
                            </select>
                          </td>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-slate-400">₹</span>
                              <input
                                type="number"
                                min="0"
                                placeholder="48"
                                value={slab.forward_fee}
                                onChange={(e) =>
                                  updateLogisticsSlab(slab.id, "forward_fee", e.target.value)
                                }
                                className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
                              />
                            </div>
                          </td>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-slate-400">₹</span>
                              <input
                                type="number"
                                min="0"
                                placeholder="65"
                                value={slab.reverse_fee}
                                onChange={(e) =>
                                  updateLogisticsSlab(slab.id, "reverse_fee", e.target.value)
                                }
                                className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
                              />
                            </div>
                          </td>
                          <td className="py-2">
                            <button
                              type="button"
                              onClick={() => removeLogisticsSlab(slab.id)}
                              className="text-slate-400 transition-colors hover:text-red-500"
                              aria-label="Remove logistics slab"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center">
                  <p className="text-sm text-slate-500">No logistics slabs added yet.</p>
                </div>
              )}

              {logisticsSlabError && (
                <p
                  className={`flex items-center gap-1 text-xs ${
                    logisticsSlabError.toLowerCase().includes("overlapping")
                      ? "text-red-600"
                      : "text-amber-600"
                  }`}
                >
                  <span>⚠</span>
                  <span>{logisticsSlabError}</span>
                </p>
              )}

              <button
                type="button"
                onClick={addLogisticsSlab}
                className="flex items-center gap-1 text-sm font-medium text-teal-600 transition-colors hover:text-teal-700"
              >
                <span>+</span> Add Logistics Slab
              </button>
            </div>
          )}
        </div>
        {(() => {
          const platformKeys = ["tech_fee", "platform_fee", "collection_fee_percent", "promo_contribution_percent"];
          const hasPlatformValue = platformKeys.some((key) => hasContent(feesForm[key]));
          const hasPlatformGroup = feeGroups["Platform Fees"] && feeGroups["Platform Fees"].length > 0;
          if (hasPlatformGroup && !hasPlatformValue) {
            return (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 flex items-start gap-2">
                <Info className="h-4 w-4 text-slate-400 mt-[2px]" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">No platform fees configured</p>
                  <p className="text-sm text-slate-600">This rate card will assume zero platform deductions.</p>
                </div>
              </div>
            );
          }
          return null;
        })()}
      </div>
    );
  };

  const renderTaxesStep = () => {
    if (!templateReady) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6">
          <StepSkeleton lines={5} />
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-slate-100 bg-white px-5 py-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-base font-semibold text-slate-900">Taxes</p>
            <p className="text-sm text-slate-500">Define statutory tax rates for reporting and payout visibility.</p>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Version {activeTemplate?.version}
          </span>
        </div>
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-sm text-slate-700">
          <p className="text-sm font-semibold text-slate-800">How Taxes Are Used</p>
          <p className="mt-1 text-sm text-slate-700">
            These tax rates are used to explain and validate tax amounts shown in marketplace settlements. Actual tax
            values are always derived from marketplace payout data.
          </p>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {taxFieldConfigs.map((field) => (
            <div key={field.key} className="space-y-2">
              <label htmlFor={`tax-${field.key}`} className="text-sm font-semibold text-slate-800">
                {field.label}
                {field.key === "gst_percent" ? (
                  <span className="ml-1 text-rose-500">*</span>
                ) : (
                  <span className="ml-2 text-xs font-semibold text-slate-400">Optional</span>
                )}
              </label>
              {(() => {
                const missing = field.key === "gst_percent" && (!hasContent(taxForm.gst_percent) || !taxTouched.gst);
                return (
                  <>
                    <input
                      id={`tax-${field.key}`}
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={taxForm[field.key] ?? field.defaultValue}
                      onChange={(event) => updateTaxField(field.key, event.target.value)}
                      placeholder={`Enter ${field.label}`}
                      className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:outline-none focus:ring-2 ${
                        missing ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200" : "border-slate-300 focus:border-teal-500 focus:ring-teal-200"
                      }`}
                    />
                    {missing && <p className="text-[12px]" style={{ color: "#e06666" }}>Required</p>}
                  </>
                );
              })()}
              {field.helpText && <p className="text-xs text-slate-500">{field.helpText}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSettlementStep = () => {
    if (!templateReady) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6">
          <StepSkeleton lines={6} />
        </div>
      );
    }

    const basisField = settlementFieldConfigs.find((field) => field.key === "settlement_basis");
    const dependentFields = visibleSettlementFields.filter((field) => field.key !== "settlement_basis");

    const basisMissing =
      basisField?.required && (!hasContent(settlementForm[basisField.key]) || !settlementTouched);

    return (
      <div className="space-y-7">
        {basisField && (
          <div className="rounded-2xl border border-slate-100 bg-white px-5 py-6 shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-semibold text-slate-900">Settlement Anchor</p>
                <p className="text-[13px] text-slate-500">This is the event from which payout timelines are calculated.</p>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {SETTLEMENT_BASIS_OPTIONS.map((option) => {
                  const selected = settlementForm.settlement_basis === option.value;
                  return (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => updateSettlementField(basisField.key, option.value)}
                      className={`text-left rounded-2xl border px-3.5 py-2.5 transition ${
                        selected
                          ? "border-2 border-teal-300 bg-teal-50/80 shadow-sm"
                          : "border-slate-200 hover:border-teal-200 hover:bg-slate-50"
                      }`}
                      aria-pressed={selected}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-[4px] h-4 w-4 rounded-full border ${
                            selected ? "border-teal-500 bg-teal-500" : "border-slate-300"
                          }`}
                        />
                        <div>
                          <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
                            {option.label}
                            {option.value === "delivery_date" && (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-[1px] text-[10px] font-semibold text-emerald-700 border border-emerald-100">
                                Recommended
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">{option.description}</p>
                        </div>
                        <input
                          type="radio"
                          className="sr-only"
                          name="settlement_basis"
                          value={option.value}
                          checked={selected}
                          onChange={() => updateSettlementField(basisField.key, option.value)}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">
                Payouts will be tracked from{" "}
                {settlementForm.settlement_basis === "settlement_generation"
                  ? "settlement generation date."
                  : "delivery date."}
              </p>
              {basisMissing && <p className="text-[12px]" style={{ color: "#e06666" }}>Required</p>}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-100 bg-white px-5 py-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4">
              <p className="text-base font-semibold text-slate-900">Payout Details</p>
              <p className="text-[13px] text-slate-500">
              Set the expected payout window and grace days so delayed and missing payment alerts stay accurate.
              </p>
            </div>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              {dependentFields.map((field) => {
              const currentValue = settlementForm[field.key] ?? "";
              const fieldError =
                field.key === "t_plus_days"
                  ? tPlusDaysValidationError
                  : field.required && !hasContent(currentValue)
                    ? "Required"
                    : "";
              const missing = Boolean(fieldError);
              const spacingClass =
                field.key === "grace_days" ? "space-y-2 pt-6 mt-4 border-t border-slate-100" : "space-y-2";
              return (
                <div key={field.key} className={spacingClass}>
                  <label htmlFor={`settlement-${field.key}`} className="text-sm font-semibold text-slate-800">
                    {field.label}
                    {field.required && <span className="ml-1 text-rose-500">*</span>}
                  </label>
                  {renderSettlementFieldControl(field, missing)}
                  {fieldError && (
                    <p className="text-[12px]" style={{ color: "#e06666" }}>
                      {field.key === "t_plus_days" ? T_PLUS_DAYS_VALIDATION_MESSAGE : fieldError}
                    </p>
                  )}
                  {field.helpText && (
                    <p className="text-xs text-slate-500">{field.helpText}</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-2.5 text-[13px] text-slate-600 flex items-start gap-2">
            <Info className="h-4 w-4 text-slate-400 mt-[2px]" aria-hidden="true" />
            <p>
              <span className="font-semibold text-slate-700">How ReconEasy uses settlement terms</span>
              <br />
              Settlement anchor, expected payout days, and grace days are used to estimate expected payout dates and detect delayed
              payments. Actual payout dates and amounts are always derived from marketplace settlement data.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderValidityStep = () => {
    if (!templateReady) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6">
          <StepSkeleton lines={4} />
        </div>
      );
    }

      return (
        <div className="rounded-2xl border border-slate-100 bg-white px-5 py-6 shadow-sm">
          <div className="border-b border-slate-100 pb-4">
              <p className="text-base font-semibold text-slate-900">Validity Period</p>
              <div className="flex flex-col gap-1">
                <p className="text-sm text-slate-500">Set the date range for which this rate card remains active.</p>
                <div
                  className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${validityStatusColor}`}
                >
                  <span>Preview Status: {validityStatusLabel}</span>
                  <div className="group relative flex items-center">
                    <Info className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                    <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg group-hover:block group-focus-within:block">
                      <p className="text-[12px] font-semibold text-slate-800">Preview Status</p>
                      <p className="mt-1 text-[12px] leading-snug text-slate-600">
                        {validityStatus === "Upcoming"
                          ? "This rate card will apply only after the effective start date."
                          : validityStatus === "Expired"
                            ? "This rate card is no longer applied to new orders."
                            : "This rate card is currently used for reconciliation."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            {validityFieldConfigs.map((field) => (
              <div key={field.key} className="space-y-2">
                    <label htmlFor={`validity-${field.key}`} className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  {field.label}
                  {field.key === "effective_from" ? (
                    <span className="ml-1 text-rose-500">*</span>
                  ) : (
                    <>
                      <span className="ml-2 text-xs font-semibold text-slate-400">Optional</span>
                      {field.key === "effective_to" && (
                        <div className="group relative">
                          <Info className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                          <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg group-hover:block group-focus-within:block">
                            If left empty, this rate card remains active until a newer rate card replaces it.
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </label>
                {(() => {
                  const missing = field.key === "effective_from" && !hasContent(validityForm.effective_from);
                  return (
                    <>
                      <input
                        id={`validity-${field.key}`}
                        type="date"
                        min={editingVersioned ? todayIso : undefined}
                        value={validityForm[field.key] ?? ""}
                        onChange={(event) => updateValidityField(field.key, event.target.value)}
                        title={
                          editingVersioned
                            ? "Past dates are locked because editing creates a new version."
                            : undefined
                        }
                        className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:outline-none focus:ring-2 ${
                          missing
                            ? "border-rose-200 focus:border-rose-300 focus:ring-rose-100"
                            : "border-slate-300 focus:border-teal-500 focus:ring-teal-200"
                        } ${
                          editingVersioned
                            ? "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                            : ""
                      }`}
                      />
                      {missing && <p className="text-[12px]" style={{ color: "#d87070" }}>Required</p>}
                      {editingVersioned && (
                        <p className="text-xs text-slate-500">
                          Past dates are locked because editing creates a new version.
                        </p>
                      )}
                      {field.key === "effective_to" && validityDateError && (
                        <p className="text-xs text-rose-500">{validityDateError}</p>
                      )}
                    </>
                  );
                })()}
                {field.helpText && <p className="text-xs text-slate-500">{field.helpText}</p>}
              </div>
            ))}
          </div>
          {validityOverlapWarning && (
            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-[2px]" aria-hidden="true" />
              <p>
                ⚠️ This rate card overlaps with an existing rate card. ReconEasy will apply the most recent applicable
                rate card during reconciliation.
              </p>
            </div>
          )}
          <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-slate-700 flex items-start gap-2">
            <Info className="h-4 w-4 text-teal-500 mt-[2px]" aria-hidden="true" />
            <p>
              Dates are evaluated using the marketplace’s local calendar date. This determines which rate card applies to
              an order and does not affect payout delay calculations.
            </p>
          </div>
        </div>
      );
  };

  const renderAdditionalStep = () => {
    if (!templateReady) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6">
          <StepSkeleton lines={4} />
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-slate-100 bg-white px-5 py-6 shadow-sm">
        <div className="border-b border-slate-100 pb-4">
          <p className="text-base font-semibold text-slate-900">Additional Information</p>
          <p className="text-sm text-slate-500">Optional settings and notes pulled from the template.</p>
        </div>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {(() => {
            const renderOptionalField = (field: OptionalFieldConfig) => {
              const returnWindowValue = parseNumberInput(optionalForm.return_window_days);
              const dynamicRequired =
                field.key === "return_sla_start_event" && returnWindowValue !== null && returnWindowValue > 0;
              const isTextArea = field.inputType === "textarea";
              const isSelect = field.inputType === "select";
              const showOptional = !(field.required || dynamicRequired);
              return (
                <div
                  key={field.key}
                  className={`space-y-2 ${isTextArea ? "md:col-span-2" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <label htmlFor={`optional-${field.key}`} className="text-sm font-semibold text-slate-800">
                      {field.label}
                    </label>
                    {showOptional ? (
                      <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">Optional</span>
                    ) : (
                      <span className="ml-1 text-rose-500">*</span>
                    )}
                    {(field.key === "return_window_days" ||
                      field.key === "return_sla_start_event" ||
                      field.key === "utr_prefix") && (
                      <div className="group relative ml-2 mt-[2px]">
                        <Info className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-72 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg group-hover:block">
                          {field.key === "return_window_days"
                            ? "This defines return expectations. ReconEasy will use this to detect delayed or disputed returns once return tracking is enabled."
                            : field.key === "return_sla_start_event"
                              ? "This will be used in future to calculate return delays when marketplace or warehouse return data is available."
                              : "Some marketplaces use consistent prefixes in UTR numbers. This improves automatic settlement matching."}
                        </div>
                      </div>
                    )}
                  </div>
                  {isTextArea ? (
                    <textarea
                      id={`optional-${field.key}`}
                      value={optionalForm[field.key] ?? ""}
                      onChange={(event) => updateOptionalField(field.key, event.target.value)}
                      placeholder={
                        field.key === "notes"
                          ? "Any internal context about this rate card (e.g., special terms, marketplace conversations, exceptions)."
                          : `Enter ${field.label}`
                      }
                      rows={4}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                    />
                  ) : isSelect ? (
                    <select
                      id={`optional-${field.key}`}
                      value={optionalForm[field.key] ?? ""}
                      onChange={(event) => updateOptionalField(field.key, event.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                    >
                      <option value="" disabled hidden>
                        {field.key === "return_sla_start_event" ? "Choose when return SLA starts" : `Select ${field.label}`}
                      </option>
                      {(field.options ?? []).filter((option) => option.value).map((option) => (
                        <option key={`${field.key}-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`optional-${field.key}`}
                      type={field.inputType === "number" ? "number" : "text"}
                      value={optionalForm[field.key] ?? ""}
                      onChange={(event) => updateOptionalField(field.key, event.target.value)}
                      placeholder={`Enter ${field.label}`}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                    />
                  )}
                  {field.key === "return_sla_start_event" && optionsValidationAttempted && optionsValidationError && (
                    <p className="text-[12px]" style={{ color: "#d87070" }}>
                      Select when the return SLA starts to track delayed or missing returns.
                    </p>
                  )}
                  {field.helpText && <p className="text-xs text-slate-500">{field.helpText}</p>}
                </div>
              );
            };

            const returnFields = optionalFieldConfigs.filter(
              (field) => field.key === "return_window_days" || field.key === "return_sla_start_event",
            );
            const remainingFields = optionalFieldConfigs.filter(
              (field) => field.key !== "return_window_days" && field.key !== "return_sla_start_event",
            );

            return (
              <>
                {returnFields.length > 0 && (
                  <div className="md:col-span-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="grid gap-4 md:grid-cols-2">
                      {returnFields.map((field) => renderOptionalField(field))}
                    </div>
                  </div>
                )}
                {remainingFields.map((field) => renderOptionalField(field))}
              </>
            );
          })()}
        </div>
      </div>
    );
  };

  const renderReviewStep = () => {
    if (reviewSummary.loading) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6">
          <StepSkeleton lines={6} />
        </div>
      );
    }

    const toggleSection = (title: string) => {
      setExpandedReviewSections((prev) => {
        const next = new Set(prev);
        if (next.has(title)) {
          next.delete(title);
        } else {
          next.add(title);
        }
        return next;
      });
    };

    const { sections, missingCount } = reviewSummary;

    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3 rounded-xl bg-white px-5 py-4 shadow-sm border border-emerald-100 mb-6">
          <CheckCircle className="h-6 w-6 text-emerald-500 mt-0.5" />
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Your rate card is ready to publish</h3>
            <p className="text-sm text-gray-500">Review all the details below before publishing.</p>
          </div>
        </div>

        {validityOverlapWarning && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This rate card overlaps with an existing one. You can replace the old card or keep both active.
          </div>
        )}

        {missingCount > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 space-y-1">
            <p>Missing required fields:</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {sections
                .filter((section) => {
                  const missingRows = section.rows?.filter((row) => row.required && !row.hasValue) ?? [];
                  return missingRows.length > 0 || (section.missingCount ?? 0) > 0;
                })
                .map((section) => {
                  const missingRows = section.rows?.filter((row) => row.required && !row.hasValue) ?? [];
                  return (
                    <li
                      key={`summary-${section.title}`}
                      className="cursor-pointer underline-offset-2 hover:underline"
                      onClick={() => {
                        toggleSection(section.title);
                        const el = sectionRefs.current.get(section.title);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      {section.title}
                      {missingRows.length
                        ? ` → ${missingRows.map((row) => row.label).join(", ")}`
                        : ""}
                    </li>
                  );
                })}
            </ul>
            <p className="text-xs text-amber-700">Fix the highlighted sections to publish this rate card.</p>
          </div>
        )}

        {sections.map((section) => {
          const missingRows = section.rows?.filter((row) => row.required && !row.hasValue) ?? [];
          const hasMissing = missingRows.length > 0 || (section.missingCount ?? 0) > 0;
          return (
          <div
            key={section.title}
            className="rounded-2xl border border-slate-100 bg-white shadow-sm"
            ref={(node) => {
              if (node) sectionRefs.current.set(section.title, node);
            }}
          >
            <button
              type="button"
              onClick={() => toggleSection(section.title)}
              className="flex w-full items-center justify-between px-5 py-4"
              aria-expanded={expandedReviewSections.has(section.title)}
            >
              <p className="text-base font-semibold text-slate-900">{section.title}</p>
              <ChevronDown
                className={`h-4 w-4 text-slate-500 transition-transform ${
                  expandedReviewSections.has(section.title) ? "rotate-180" : ""
                }`}
              />
            </button>
            {expandedReviewSections.has(section.title) && (
              <div className="px-5 pb-6 border-t border-slate-100">
                {["Settlement Terms", "Validity", "Additional Information"].includes(section.title) && (
                  <p className="mt-3 text-xs text-slate-500">
                    {section.title === "Settlement Terms" &&
                      "Why this matters: These rules determine when payouts are expected and when delays are flagged during reconciliation."}
                    {section.title === "Validity" &&
                      "Why this matters: Validity dates decide which rate card is applied to orders during reconciliation."}
                    {section.title === "Additional Information" &&
                      "Why this matters: These settings define return expectations and will be used once return reconciliation is enabled."}
                  </p>
                )}
                {hasMissing && (
                  <div className="mt-2 text-xs text-rose-600">
                    {missingRows.length
                      ? missingRows.map((row) => <p key={`${section.title}-${row.label}`}>{`${row.label} is required.`}</p>)
                      : <p>Missing required information in this section.</p>}
                  </div>
                )}
                {section.rows ? (
                  <dl
                    className={`mt-4 grid ${
                      ["Fees & Deductions", "Settlement Terms", "Additional Information"].includes(section.title)
                        ? "gap-3"
                        : "gap-4"
                    }`}
                  >
                    {section.rows.map((row) => {
                      const missing = row.required && !row.hasValue;
                      const isDense = ["Fees & Deductions", "Settlement Terms", "Additional Information"].includes(
                        section.title,
                      );
                      const rowPadding = isDense ? "py-2.5" : "py-3";
                      const rowMargin = isDense ? "mb-1.5" : "mb-2";
                      const displayValue = hasContent(row.value) ? row.value : "—";
                      return (
                        <div
                          key={row.label}
                          className={`${rowMargin} grid gap-1 rounded-2xl border px-4 ${rowPadding} sm:grid-cols-2 sm:items-center ${
                            missing ? "border-rose-200 bg-rose-50/60" : "border-slate-100"
                          }`}
                        >
                          <dt className="flex items-center gap-2 text-sm font-medium text-slate-600">
                            {row.label}
                            {missing && <span className="text-xs font-normal text-rose-600">Required</span>}
                          </dt>
                          <dd className={`text-sm font-semibold ${missing ? "text-rose-600" : "text-slate-900"}`}>
                            {displayValue}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                ) : (
                  <div className="mt-4">{section.custom}</div>
                )}
                {section.title === "Validity" && validityDateError && (
                  <p className="mt-3 text-xs text-rose-600">{validityDateError}</p>
                )}
              </div>
            )}
          </div>
        )})}

        {saveError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{saveError}</div>
        )}

      </div>
    );
  };

  const renderStepContent = () => {
    if (!currentStep) return null;

    if (currentStep.id === "basics") {
      const versionLabel = activeTemplate?.version ? activeTemplate.version : "v3.3";
      const fieldCount = activeTemplate?.headers_json?.length ?? 0;
      const updatedAt = activeTemplate?.updated_at ? new Date(activeTemplate.updated_at) : null;
      const updatedLabel = updatedAt
        ? new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }).format(updatedAt)
        : "—";

      return (
        <div className="space-y-8">
          {isEditMode && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex flex-col gap-1">
              <span className="font-semibold">
                Editing {commissionType === "tiered" ? "Tiered" : "Flat"} Rate Card — Version {priorVersionNumber ?? "—"} → New Version
              </span>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 font-semibold text-white">
                  {commissionType === "tiered" ? "TIERED RATE CARD" : "FLAT RATE CARD"}
                </span>
                {prefillCard?.effective_from && (
                  <span className="text-emerald-700">
                    Effective From (old): {prefillCard.effective_from}
                  </span>
                )}
                <span className="text-emerald-700">New Effective From: auto-calculated by backend</span>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {TEMPLATE_CHOICES.map((choice) => {
              const isActive = commissionType === choice.key;
              const disabled = (templateLoading && isActive) || isEditMode;
              const isLocked = isEditMode;
              const cardClasses = [
                "relative flex h-full flex-col rounded-2xl border px-4 py-4 text-left transition",
                isActive ? "border-green-500 bg-green-50 shadow-sm" : "border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50",
                disabled ? "cursor-not-allowed" : "",
                isLocked && !isActive ? "pointer-events-none opacity-60" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={choice.key}
                  type="button"
                  onClick={() => handleTemplateSelect(choice.key)}
                  aria-pressed={isActive}
                  className={cardClasses}
                  title={isEditMode ? "Cannot change type while editing an existing rate card." : undefined}
                  disabled={disabled}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{choice.heading}</p>
                      <p className="text-sm text-slate-500">{choice.blurb}</p>
                    </div>
                    {isActive && (
                      <span className="absolute top-2 right-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded">
                        Selected
                      </span>
                    )}
                  </div>
                  <ul className="mt-4 space-y-1 text-sm text-slate-600">
                    {choice.points.map((point) => (
                      <li key={`${choice.key}-${point}`}>• {point}</li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-5 py-4">
            {!templateType && (
              <p className="text-sm text-slate-600">
                Choose a rate card structure to configure fees and calculations in the next steps.
              </p>
            )}
            {templateType && templateLoading && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-600">Fetching {templateType} template…</p>
                <StepSkeleton lines={5} />
              </div>
            )}
            {templateType && templateError && !templateLoading && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <p>{templateError}</p>
                <button
                  type="button"
                  onClick={refetchTemplate}
                  className="mt-2 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-white"
                >
                  Retry
                </button>
              </div>
            )}
            {templateType && templateReady && activeTemplate && (
              <div className="space-y-4">
                {templateFallback && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    ⚠️ Using fallback template ({activeTemplate.version}). Live template service unavailable.
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Selected Template</p>
                    <p className="text-xs text-slate-500">
                      {templateType === "tiered" ? "Tiered" : "Flat"} • Version {versionLabel}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    Using the latest available template for this rate card type.
                  </span>
                </div>
                <dl className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Version</dt>
                    <dd className="font-semibold text-slate-900">{versionLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Template Coverage</dt>
                    <dd className="flex items-center gap-2 font-semibold text-slate-900">
                      {fieldCount} fields
                      <div className="relative inline-block align-middle">
                        <div className="group relative flex cursor-pointer items-center justify-center rounded-full bg-slate-100 px-1.5 py-1 text-[11px] font-semibold text-slate-600">
                          ⓘ
                          <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg group-hover:block">
                            <p className="text-[11px] font-semibold text-slate-800">Template Coverage</p>
                            <p className="mt-1 text-[12px] leading-snug text-slate-600">
                              These are all the fields this template supports across CSV imports and reconciliation. Some fields may not appear in this wizard based on visibility rules.
                            </p>
                          </div>
                        </div>
                      </div>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Last updated</dt>
                    <dd className="font-semibold text-slate-900">{updatedLabel}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>

          {templateType && templatePending && (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <StepSkeleton lines={8} />
            </div>
          )}

          {templateReady && (
            <div className="space-y-6 rounded-2xl border border-slate-100 bg-white px-5 py-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <p className="text-base font-semibold text-slate-900">Scope</p>
                  <p className="text-sm text-slate-500">Define which orders this rate card applies to.</p>
                </div>
              </div>

              <div className="grid gap-x-6 gap-y-8 md:grid-cols-2">
                {basicsFieldConfigs.map((field, index) => {
                  const missing = field.required && !hasContent(basicsForm[field.id]);
                  return (
                    <div
                      key={field.id}
                      className={`space-y-2 pb-6 ${
                        index >= basicsFieldConfigs.length - 2 ? "" : "border-b border-slate-100 md:border-b-0"
                      }`}
                    >
                      <label htmlFor={`wizard-${field.id}`} className="text-sm font-semibold text-slate-800">
                        {field.label}
                        {field.required && <span className="ml-1 text-rose-500">*</span>}
                      </label>
                      {renderBasicsFieldControl(field, missing)}
                      {missing && <p className="text-[12px]" style={{ color: "#e06666" }}>Required</p>}
                      {field.helpText && <p className="text-xs text-slate-500">{field.helpText}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (currentStep.id === "commission") {
      return renderCommissionStep();
    }

    if (currentStep.id === "fees") {
      return renderFeesStep();
    }

    if (currentStep.id === "taxes") {
      return renderTaxesStep();
    }

    if (currentStep.id === "settlement") {
      return renderSettlementStep();
    }

    if (currentStep.id === "validity") {
      return renderValidityStep();
    }

    if (currentStep.id === "options") {
      return renderAdditionalStep();
    }

    if (currentStep.id === "review") {
      return renderReviewStep();
    }

    return (
      <div className="space-y-6 text-slate-600">
        <div className="rounded-2xl border border-dashed border-teal-100 bg-teal-50/40 px-5 py-4 text-sm">
          {templatePending ? <StepSkeleton lines={6} /> : currentStep.placeholder}
        </div>
        <p className="text-sm text-slate-500">
          This is a placeholder area. Once the wizard steps are wired up, real form sections and validation will replace
          this text for the <span className="font-medium text-slate-700">{currentStep.title}</span> step.
        </p>
      </div>
    );
  };

  if (isEditMode && (prefillLoading || !templateReady || !prefillCard || prefillError)) {
    const showError = Boolean(prefillError || templateError);
    return (
      <div className="min-h-screen bg-slate-50/80 py-10 px-4 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-4 rounded-3xl border border-slate-100 bg-white p-8 text-slate-700 shadow-sm">
          {showError ? (
            <>
              <p className="text-base font-semibold text-rose-700">Unable to load rate card</p>
              <p className="text-sm text-slate-600 text-center">
                {prefillError || templateError || "Something went wrong while fetching the existing rate card."}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPrefillRetryTick((v) => v + 1)}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-teal-700"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/rate-cards")}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Back to list
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-slate-900">Loading rate card…</p>
              <p className="text-sm text-slate-500">Please wait while we fetch the existing details.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50/80 py-10 px-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 lg:flex-row relative">
          <div className="absolute right-4 top-4">
            <button
              type="button"
              onClick={handleExit}
              className="flex items-center gap-1 text-slate-600 text-sm font-medium px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:text-slate-800 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-200 transition-all duration-150 shadow-sm hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 select-none"
              aria-label="Close wizard and return to rate cards"
              title="Close wizard and return to rate cards"
            >
              <X size={16} strokeWidth={2} />
              Exit
            </button>
          </div>
          <aside className="rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-sm backdrop-blur lg:sticky lg:top-8 lg:h-fit lg:w-72">
            <div className="mb-6 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-500">Rate Card Wizard</p>
              {editingVersioned ? (
                <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 border border-emerald-100">
                  Creating Version {(priorVersionNumber ?? 0) + 1} – Effective {todayIso}
                </div>
              ) : null}
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">
                {isEditMode ? "Edit Rate Card" : "Create Rate Card"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Step {activeStep + 1} of {totalSteps}
              </p>
              <div className="mt-4 h-2 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
          <nav aria-label="Wizard steps" className="space-y-3">
            {steps.map((step, index) => {
              const isActive = index === activeStep;
              const stepKey = step.id as keyof StepRequirementMap;
              const isComplete = (stepCompletionMap[stepKey] ?? false) && index < activeStep;
              const disabled = !canNavigateToStep(index);
              const stepHasError =
                !(stepCompletionMap[step.id as keyof StepRequirementMap] ?? true) || missingSections.has(step.id);
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    goToStep(index);
                  }}
                  disabled={disabled}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                    isActive
                      ? "border-teal-200 bg-teal-50 shadow-sm"
                      : "border-slate-100 bg-white hover:border-teal-100 hover:bg-slate-50 hover:-translate-y-0.5"
                  } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold ${
                        isComplete
                          ? "border-transparent bg-teal-500 text-white"
                          : isActive
                            ? "border-teal-500 bg-white text-teal-600"
                            : "border-slate-300 bg-slate-50 text-slate-500"
                      }`}
                    >
                      {isComplete ? <Check className="h-4 w-4" /> : index + 1}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${isActive ? "text-teal-700" : "text-slate-700"}`}>
                        {step.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{step.description}</p>
                    </div>
                    {stepHasError && <span className="mt-1 h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />}
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="flex-1">
          <div className="flex h-full flex-col rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100/80 px-6 py-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">Step {activeStep + 1}</p>
              <h2 className="text-2xl font-semibold text-slate-900">{currentStep?.title}</h2>
              <p className="mt-2 text-sm text-slate-500">{currentStep?.description}</p>
            </div>

            <div className="flex-1 px-6 py-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${currentStep?.id ?? "step"}-${activeTemplate?.version ?? "none"}-${templateType ?? "na"}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                >
                  {renderStepContent()}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 bg-white">
              {activeStep === totalSteps - 1 ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <p className="text-xs text-slate-500 max-w-3xl">
                    Once published, this rate card will appear in the Rate Cards table and will be automatically used for reconciliation when its effective dates apply.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={goBack}
                      disabled={activeStep === 0}
                      className="w-full rounded-xl border-slate-200 text-slate-600 hover:text-slate-900 sm:w-auto"
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      onClick={handlePublishClick}
                      disabled={saving || reviewSummary.loading || reviewSummary.missingCount > 0}
                      className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow transition hover:shadow-lg hover:from-teal-600 hover:to-emerald-600 sm:w-auto disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {saving ? "Saving…" : isEditMode ? "Save Changes" : "Publish Rate Card"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={goBack}
                    disabled={activeStep === 0}
                    className="w-full rounded-xl border-slate-200 text-slate-600 hover:text-slate-900 sm:w-auto"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    onClick={goNext}
                    disabled={nextDisabled}
                    title={nextDisabled ? "Please complete required fields before continuing." : undefined}
                    className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow transition hover:shadow-lg hover:from-teal-600 hover:to-emerald-600 sm:w-auto disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </Button>
                </div>
              )}
              {stepValidationAttempted && !currentStepReady && (
                <p className="mt-2 text-xs text-rose-600 text-center">Please complete required fields before continuing.</p>
              )}
            </div>
        </div>
    </section>
    </div>
  </div>
      {showExitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowExitModal(false)}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-lg rounded-2xl bg-white border border-slate-200 px-7 py-8 shadow-xl transition-all duration-150 ease-out"
            onClick={(event) => event.stopPropagation()}
            style={{ transform: "translateZ(0)" }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={24} className="text-red-500/80 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Are you sure you want to exit?</h2>
                <p className="text-sm text-slate-500 leading-relaxed mt-1">
                  Your progress in this rate card wizard will be lost.
                </p>
                {isEditMode && prefillCard && (
                  <span className="inline-block text-xs px-2 py-1 rounded-md bg-slate-100 text-slate-600 mt-3">
                    Editing Version {prefillCard?.version_number ?? priorVersionNumber ?? "—"} •{" "}
                    {prefillCard?.platform_id ?? "—"} / {prefillCard?.category_id ?? "—"}
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all shadow-sm hover:shadow"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmExit}
                className="px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-all shadow-sm hover:shadow flex items-center gap-2"
              >
                <LogOut size={16} />
                Exit Wizard
              </button>
            </div>
          </div>
        </div>
      )}
      {showOverlapPublishModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowOverlapPublishModal(false)}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-lg rounded-2xl bg-white border border-slate-200 px-7 py-8 shadow-xl transition-all duration-150 ease-out"
            onClick={(event) => event.stopPropagation()}
            style={{ transform: "translateZ(0)" }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={24} className="text-amber-500 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Overlapping Rate Card Detected</h2>
                <p className="text-sm text-slate-600 leading-relaxed mt-1">
                  This rate card overlaps with an existing rate card for the same marketplace, category, and template type.
                  You can choose to replace the existing rate card (it will expire one day before the new card’s effective date) or keep both active (ReconEasy will apply the most recent applicable card).
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={() => setShowOverlapPublishModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all shadow-sm hover:shadow"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOverlapPublishModal(false);
                  void handleSave(true);
                }}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-sm hover:shadow"
              >
                Replace Existing Card
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOverlapPublishModal(false);
                  void handleSave(false);
                }}
                className="px-4 py-2 rounded-lg bg-teal-500 text-white hover:bg-teal-600 transition-all shadow-sm hover:shadow"
              >
                Keep Both Active
              </button>
            </div>
          </div>
        </div>
      )}
      <SlabGapWarningModal
        open={gapModalOpen && pendingSlabGaps.length > 0}
        gaps={pendingSlabGaps}
        onClose={() => {
          setGapModalOpen(false);
          setPendingSlabGaps([]);
        }}
        onFix={() => {
          setHighlightedGapIndices(
            pendingSlabGaps
              .flatMap((gap) => [gap.indexPrev, gap.indexNext])
              .filter((v, idx, arr) => arr.indexOf(v) === idx),
          );
          setGapModalOpen(false);
        }}
        onContinue={() => {
          setIgnoreSlabGapWarnings(true);
          setGapModalOpen(false);
          setPendingSlabGaps([]);
          goToStep(activeStep + 1);
        }}
      />
    </>
  );
}
