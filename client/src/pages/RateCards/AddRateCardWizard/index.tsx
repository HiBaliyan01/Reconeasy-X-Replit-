import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, Trash2, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { invokeSupabaseFunction } from "@/utils/supabaseFunctions";
import { Button } from "@/components/ui/button";
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
  settlement: ["settlement_basis"],
  validity: ["start_date", "end_date"],
  commission_structure: ["flat_or_tiered_structure_valid"],
};

function validateSettlementTerms(form: Record<string, string>) {
  return Boolean(form.settlement_basis && form.settlement_basis.trim() !== "");
}

const SETTLEMENT_BASIS_OPTIONS = [
  { value: "order", label: "Order (T+ days)" },
  { value: "item", label: "Item" },
  { value: "shipment", label: "Shipment" },
  { value: "weekly", label: "Weekly" },
  { value: "bi_weekly", label: "Bi-Weekly" },
  { value: "monthly", label: "Monthly" },
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
  inputType: "text" | "number" | "textarea";
  required: boolean;
  templateField: RateCardTemplateField | null;
};

const STEP_DEFINITIONS: WizardStepDefinition[] = [
  {
    id: "basics",
    title: "Basics",
    description: "Start with the foundational context for this rate card.",
    buildPlaceholder: ({ template, templateType }) => {
      if (!templateType) {
        return "Select a template type to unlock the guided basics form.";
      }
      if (!template) {
        return "Loading the selected template (v3.3) metadata so Basics can configure its fields.";
      }
      return `Basics is now aligned to the ${templateType === "tiered" ? "Tiered" : "Flat"} template ${
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
    description: "Specify GST, TCS, and other statutory taxes.",
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
    title: "Additional Options",
    description: "Add optional automation, alerts, or notes.",
    buildPlaceholder: ({ template }) =>
      template
        ? `Additional Options inherit optional columns from version ${template.version}—notes, alerts, and automation toggles.`
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
  {
    id: "commission_type",
    synonyms: ["commission_type", "template_type", "commission basis"],
    defaultLabel: "Commission Type",
    defaultHelpText: "Pick whether this card is Flat or Tiered before moving ahead.",
    fallbackType: "radio",
  },
];

const TEMPLATE_CHOICES: Array<{ key: TemplateVariant; heading: string; blurb: string; points: string[] }> = [
  {
    key: "flat",
    heading: "Flat Rate Card",
    blurb: "Simple commission % across all price points.",
    points: ["Fast setup", "Best for stable categories", "Loads template v3.3 automatically"],
  },
  {
    key: "tiered",
    heading: "Tiered Rate Card",
    blurb: "Different commissions per price slab.",
    points: ["Price break intelligence", "Optimized for scale", "Loads template v3.3 automatically"],
  },
];

const DEFAULT_COMMISSION_OPTIONS: FieldOption[] = [
  { value: "flat", label: "Flat" },
  { value: "tiered", label: "Tiered" },
];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SETTLEMENT_LABELS: Record<string, string> = {
  t_plus: "T+ Days",
  weekly: "Weekly",
  bi_weekly: "Bi-weekly",
  monthly: "Monthly",
};

const TAX_FIELD_DEFINITIONS = [
  {
    key: "gst_percent",
    synonyms: ["gst_percent", "gst", "tax_percent", "gst_rate"],
    defaultLabel: "GST %",
    defaultHelpText: "Statutory GST percentage applied on marketplace fees.",
    defaultValue: "18",
  },
  {
    key: "tcs_percent",
    synonyms: ["tcs_percent", "tcs", "tax_collected_source"],
    defaultLabel: "TCS %",
    defaultHelpText: "Marketplace TCS deduction percentage.",
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
    defaultHelpText: "Date from which this rate card becomes active.",
    required: true,
  },
  {
    key: "effective_to",
    synonyms: ["effective_to", "valid_to", "end_date"],
    defaultLabel: "Effective To",
    defaultHelpText: "Optional end date. Leave blank to keep the card active indefinitely.",
    required: false,
  },
];

const OPTIONAL_FIELD_DEFINITIONS = [
  {
    key: "return_window_days",
    synonyms: ["return_window_days", "return_window", "return_period"],
    defaultLabel: "Return Window (Days)",
    defaultHelpText: "Number of days customers have to return the product.",
  },
  {
    key: "utr_prefix",
    synonyms: ["utr_prefix", "payment_reference"],
    defaultLabel: "UTR Prefix",
    defaultHelpText: "Prefix added to UTR/payment references for this rate card.",
  },
  {
    key: "notes",
    synonyms: ["notes", "remarks", "comments"],
    defaultLabel: "Notes",
    defaultHelpText: "Add any additional context or instructions.",
  },
];

const FEE_FIELD_KEYS = new Set([
  "storage_fee",
  "logistics_fee",
  "return_fee",
  "tech_fee",
  "collection_fee_percent",
  "cancellation_fee",
  "promo_contribution_percent",
  "damage_deduction_percent",
  "penalty_type",
  "penalty_value",
  "global_min_price",
  "global_max_price",
]);

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
    synonyms: ["settlement_basis", "settlement_type", "basis"],
    defaultLabel: "Settlement Basis",
    defaultHelpText: "Choose how payouts are scheduled for this rate card.",
    defaultValue: "t_plus",
    fallbackType: "select",
    fallbackOptions: [
      { value: "t_plus", label: "T+ Days" },
      { value: "weekly", label: "Weekly" },
      { value: "bi_weekly", label: "Bi-weekly" },
      { value: "monthly", label: "Monthly" },
    ],
  },
  {
    key: "t_plus_days",
    synonyms: ["t_plus_days", "t_plus", "tplus"],
    defaultLabel: "T+ Days",
    defaultHelpText: "Number of days after delivery when the payout is released.",
    defaultValue: "",
  },
  {
    key: "weekly_weekday",
    synonyms: ["weekly_weekday", "weekly_day", "weekday"],
    defaultLabel: "Weekly Payout Day",
    defaultHelpText: "Day of the week when payouts are processed.",
    defaultValue: "",
  },
  {
    key: "bi_weekly_weekday",
    synonyms: ["bi_weekly_weekday", "biweekly_weekday"],
    defaultLabel: "Bi-Weekly Payout Day",
    defaultHelpText: "Day of the week when bi-weekly payouts occur.",
    defaultValue: "",
  },
  {
    key: "bi_weekly_which",
    synonyms: ["bi_weekly_which", "biweekly_which"],
    defaultLabel: "Bi-Weekly Cycle",
    defaultHelpText: "Which week of the cycle (e.g., Week 1 or Week 2).",
    defaultValue: "",
  },
  {
    key: "monthly_day",
    synonyms: ["monthly_day", "payout_day_of_month"],
    defaultLabel: "Monthly Payout Day",
    defaultHelpText: "Day of the month when payouts occur.",
    defaultValue: "",
  },
  {
    key: "grace_days",
    synonyms: ["grace_days", "grace_period"],
    defaultLabel: "Grace Days",
    defaultHelpText: "Buffer days allowed before payout is considered delayed.",
    defaultValue: "0",
  },
];

const SETTLEMENT_DEPENDENCY_RULES: Record<string, TemplateFieldDependency[]> = {
  t_plus_days: [{ field: "settlement_basis", value: "t_plus" }],
  weekly_weekday: [{ field: "settlement_basis", value: "weekly" }],
  bi_weekly_weekday: [{ field: "settlement_basis", value: "bi_weekly" }],
  bi_weekly_which: [{ field: "settlement_basis", value: "bi_weekly" }],
  monthly_day: [{ field: "settlement_basis", value: "monthly" }],
};

const hasContent = (value: any) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return true;
  return Boolean(value);
};

const parseNumberInput = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = value.toString().trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

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
  const group = (field.group || (typeof field.meta?.group === "string" ? (field.meta?.group as string) : ""))?.toLowerCase();
  const normalizedKey = resolveFieldKey(field);
  if (FEE_FIELD_KEYS.has(normalizedKey)) return true;
  if (group.includes("fee") || group.includes("deduction") || group.includes("penalty") || group.includes("pricing")) {
    return true;
  }
  return false;
};

export default function AddRateCardWizard() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [templateType, setTemplateType] = useState<TemplateVariant | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<RateCardTemplateMetadata | null>(null);
  const [basicsForm, setBasicsForm] = useState<Record<BasicsFieldKey, string>>({
    platform_id: "",
    category_id: "",
    commission_type: "",
  });
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
  const [tieredSlabs, setTieredSlabs] = useState<TieredSlab[]>(() => [
    {
      id: "slab-initial",
      min_price: "",
      max_price: "",
      commission_percent: "",
      noUpperLimit: false,
      minTouched: false,
      minAutoFilled: false,
    },
  ]);
  const [feesForm, setFeesForm] = useState<Record<string, string>>({});
  const [taxForm, setTaxForm] = useState<Record<string, string>>({
    gst_percent: "18",
    tcs_percent: "1",
  });
  const [taxTouched, setTaxTouched] = useState<{ gst: boolean; tcs: boolean }>({ gst: false, tcs: false });
  const [settlementForm, setSettlementForm] = useState<Record<string, string>>({});
  const [settlementTouched, setSettlementTouched] = useState(false);
  const [validityForm, setValidityForm] = useState<Record<string, string>>({
    effective_from: "",
    effective_to: "",
  });
  const [optionalForm, setOptionalForm] = useState<Record<string, string>>({
    return_window_days: "",
    utr_prefix: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingNoUpperLimit, setPendingNoUpperLimit] = useState<{ rowId: string; index: number } | null>(
    null,
  );
  const [pendingSlabGaps, setPendingSlabGaps] = useState<SlabGap[]>([]);
  const [gapModalOpen, setGapModalOpen] = useState(false);
  const [ignoreSlabGapWarnings, setIgnoreSlabGapWarnings] = useState(false);
  const [highlightedGapIndices, setHighlightedGapIndices] = useState<number[]>([]);

  const {
    template: fetchedTemplate,
    loading: templateLoading,
    error: templateError,
    refresh: refetchTemplate,
  } = useActiveRateCardTemplate(templateType);

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
  }, [templateType]);

  useEffect(() => {
    setFlatCommission("");
    setTieredSlabs([createSlabRow()]);
  }, [templateType, createSlabRow]);

  useEffect(() => {
    if (!activeTemplate) {
      setFeesForm({});
      return;
    }
    const feeKeys = (activeTemplate.headers_json ?? [])
      .filter((field): field is RateCardTemplateField => Boolean(field))
      .filter((field) => isFeeField(field))
      .map((field) => resolveFieldKey(field));
    setFeesForm((previous) => {
      const next: Record<string, string> = {};
      feeKeys.forEach((key) => {
        next[key] = previous[key] ?? "";
      });
      return next;
    });
  }, [activeTemplate]);

  const templateFieldLookup = useMemo(() => {
    const map = new Map<string, RateCardTemplateField>();
    activeTemplate?.headers_json?.forEach((field) => {
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
      const templateField = resolveTemplateField(definition.synonyms);
      return {
        key: definition.key,
        label: templateField?.label ?? definition.defaultLabel,
        helpText: templateField?.help_text ?? templateField?.description ?? definition.defaultHelpText,
        required: Boolean(templateField?.mandatory ?? true),
        defaultValue: definition.defaultValue,
      };
    });
  }, [resolveTemplateField]);

  const settlementFieldConfigs = useMemo((): SettlementFieldConfig[] => {
    return SETTLEMENT_FIELD_DEFINITIONS.map((definition) => {
      const templateField = resolveTemplateField(definition.synonyms);
      const normalizedKey = definition.key;
      const templateOptions = extractFieldOptions(templateField);
    const options =
      normalizedKey === "settlement_basis"
        ? templateOptions.length
            ? templateOptions
            : SETTLEMENT_BASIS_OPTIONS
        : templateOptions;
    const dependsFromTemplate = normalizeDependencies(templateField?.depends_on, templateField?.meta);
    const dependsOn = dependsFromTemplate.length
      ? dependsFromTemplate
      : SETTLEMENT_DEPENDENCY_RULES[normalizedKey] ?? [];

      const inputType =
        normalizedKey === "settlement_basis"
          ? "select"
          : inferFeeInputType(templateField, options.length, normalizedKey);

      return {
        key: normalizedKey,
        label: templateField?.label ?? definition.defaultLabel,
        helpText: templateField?.help_text ?? templateField?.description ?? definition.defaultHelpText,
        required: normalizedKey === "settlement_basis" ? true : Boolean(templateField?.mandatory ?? false),
        inputType,
        options,
        defaultValue: templateField?.example ?? definition.defaultValue ?? "",
        dependsOn,
      };
    });
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
    setSettlementForm(() => {
      const defaults: Record<string, string> = {};
      settlementFieldConfigs.forEach((field) => {
        defaults[field.key] = field.defaultValue ?? "";
      });
      return defaults;
    });
  }, [settlementFieldConfigs]);

  const optionalFieldConfigs = useMemo((): OptionalFieldConfig[] => {
    if (!activeTemplate) return [];
    return OPTIONAL_FIELD_DEFINITIONS.map((definition) => {
      const templateField = resolveTemplateField(definition.synonyms);
      const inputType =
        definition.key === "notes"
          ? "textarea"
          : inferFeeInputType(templateField, extractFieldOptions(templateField).length, definition.key);
      return {
        key: definition.key,
        label: templateField?.label ?? definition.defaultLabel,
        helpText: templateField?.help_text ?? templateField?.description ?? definition.defaultHelpText,
        inputType,
        required: Boolean(templateField?.mandatory ?? false),
        templateField,
      };
    });
  }, [activeTemplate, resolveTemplateField]);

  useEffect(() => {
    setOptionalForm({
      return_window_days: "",
      utr_prefix: "",
      notes: "",
    });
  }, [activeTemplate, optionalFieldConfigs]);

  const basicsFieldConfigs = useMemo((): BasicsFieldConfig[] => {
    return BASICS_FIELD_DEFINITIONS.map((definition) => {
      const templateField = resolveTemplateField(definition.synonyms);
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
    });
  }, [resolveTemplateField]);

  const commissionFieldConfig = useMemo(() => {
    const templateField = resolveTemplateField([
      "commission_percent",
      "commission",
      "commission_rate",
      "commission %",
    ]);
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
        field: resolveTemplateField(["min_price", "slab_min", "price_from", "min"]),
        fallbackLabel: "Min Price (₹)",
        fallbackHelp: "Starting price for the slab.",
      },
      max: {
        field: resolveTemplateField(["max_price", "slab_max", "price_to", "max"]),
        fallbackLabel: "Max Price (₹)",
        fallbackHelp: "Ending price for the slab.",
      },
      rate: {
        field: resolveTemplateField(["commission_percent", "slab_commission", "rate"]),
        fallbackLabel: "Commission %",
        fallbackHelp: "Percentage commission for orders within this range.",
      },
    };
  }, [resolveTemplateField]);

  const feesFieldConfigs = useMemo((): FeeFieldConfig[] => {
    if (!activeTemplate) return [];
    const headers = activeTemplate.headers_json ?? [];
    return headers
      .filter((field) => isFeeField(field))
      .map((field) => {
        const key = resolveFieldKey(field);
        const options = extractFieldOptions(field);
        const inputType = inferFeeInputType(field, options.length, key);
        const group =
          field.group ||
          (typeof field.meta?.group === "string" ? (field.meta?.group as string) : "") ||
          "Fees & Deductions";
        return {
          key,
          label: field.label || formatOptionLabel(key),
          helpText: field.help_text ?? field.description ?? "",
          required: Boolean(field.mandatory),
          inputType,
          options,
          group,
          templateField: field,
          dependsOn: normalizeDependencies(field.depends_on, field.meta),
        };
      });
  }, [activeTemplate]);

  const validityFieldConfigs = useMemo(() => {
    return VALIDITY_FIELD_DEFINITIONS.map((definition) => {
      const templateField = resolveTemplateField(definition.synonyms);
      return {
        key: definition.key,
        label: templateField?.label ?? definition.defaultLabel,
        helpText: templateField?.help_text ?? templateField?.description ?? definition.defaultHelpText,
        required: Boolean(templateField?.mandatory ?? definition.required),
      };
    });
  }, [resolveTemplateField]);

  useEffect(() => {
    setValidityForm({
      effective_from: "",
      effective_to: "",
    });
  }, [activeTemplate, validityFieldConfigs]);

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

  const templateReady = Boolean(templateType && activeTemplate && !templateLoading && !templateError);
  const templatePending = Boolean(templateType && (templateLoading || (!activeTemplate && !templateError)));

  const goToStep = (nextStep: number) => {
    setActiveStep(Math.min(Math.max(nextStep, 0), totalSteps - 1));
  };

  const goNext = () => {
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
    goToStep(activeStep + 1);
  };
  const goBack = () => goToStep(activeStep - 1);

  const handleTemplateSelect = useCallback((choice: TemplateVariant) => {
    setTemplateType(choice);
    setActiveStep(0);
    setBasicsForm((previous) => ({
      ...previous,
      commission_type: choice,
    }));
    // re-evaluate dots immediately after template selection
    setIgnoreSlabGapWarnings(false);
    setHighlightedGapIndices([]);
  }, []);

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
        const patch: Partial<TieredSlab> = { [field]: value };
        if (field === "max_price") patch.noUpperLimit = false;
        if (field === "min_price") {
          patch.minTouched = true;
          patch.minAutoFilled = false;
        }
        return { ...row, ...patch };
      });

      if (field === "max_price") {
        const current = nextRows[index];
        const next = nextRows[index + 1];
        const parsedMax =
          value === null || value === "" || value === undefined ? null : Number(value);
        const maxIsValid = parsedMax !== null && !Number.isNaN(parsedMax);
        const hasError = !maxIsValid || current.noUpperLimit;
        if (next && !hasError) {
          const nextMinBlank =
            (!next.minTouched && ((next.min_price ?? "").toString().trim() === "")) ||
            next.minAutoFilled;
          if (nextMinBlank) {
            nextRows[index + 1] = {
              ...next,
              min_price: String(parsedMax + 1),
              minAutoFilled: true,
              minTouched: false,
            };
          }
        }
      }

      return nextRows;
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

        if (enabled && targetIndex !== lastIndex) {
          setPendingNoUpperLimit({ rowId, index: targetIndex });
          return rows;
        }

        return rows.map((row) => {
          if (row.id !== rowId) {
            return enabled ? { ...row, noUpperLimit: false } : row;
          }
          return {
            ...row,
            noUpperLimit: enabled,
            max_price: enabled ? null : "",
          };
        });
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
    setTieredSlabs((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.id !== rowId)));
    setIgnoreSlabGapWarnings(false);
    setHighlightedGapIndices([]);
  }, []);

  const addTieredSlab = useCallback(() => {
    setTieredSlabs((rows) => [...rows, createSlabRow()]);
    setIgnoreSlabGapWarnings(false);
    setHighlightedGapIndices([]);
  }, [createSlabRow]);

  const updateFeesField = useCallback((fieldKey: string, value: string) => {
    setFeesForm((prev) => ({
      ...prev,
      [fieldKey]: value,
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

  const updateValidityField = useCallback((fieldKey: string, value: string) => {
    setValidityForm((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));
  }, []);

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
      effective_from: validityForm.effective_from,
      effective_to: validityForm.effective_to?.trim() ? validityForm.effective_to : null,
      gst_percent: parseNumberInput(taxForm.gst_percent) ?? 0,
      tcs_percent: parseNumberInput(taxForm.tcs_percent) ?? 0,
      settlement_basis: settlementForm.settlement_basis || "t_plus",
      t_plus_days: parseNumberInput(settlementForm.t_plus_days),
      weekly_weekday: parseNumberInput(settlementForm.weekly_weekday),
      bi_weekly_weekday: parseNumberInput(settlementForm.bi_weekly_weekday),
      bi_weekly_which: settlementForm.bi_weekly_which || null,
      monthly_day: settlementForm.monthly_day || null,
      grace_days: parseNumberInput(settlementForm.grace_days) ?? 0,
      global_min_price: parseNumberInput(feesForm.global_min_price),
      global_max_price: parseNumberInput(feesForm.global_max_price),
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
        .filter(
          (field) =>
            field.inputType === "number" && field.key !== "global_min_price" && field.key !== "global_max_price",
        )
        .map((field) => {
          const fee_value = parseNumberInput(feesForm[field.key]);
          if (fee_value === null) return null;
          const fee_type: "percent" | "amount" = field.key.includes("percent") ? "percent" : "amount";
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

    return basePayload;
  }, [
    basicsForm,
    feesFieldConfigs,
    feesForm,
    flatCommission,
    optionalForm,
    settlementForm,
    taxForm,
    tieredSlabs,
    validityForm,
  ]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaveError(null);
    setSaving(true);
    try {
      const payload = buildRateCardPayload();
      if (!payload.platform_id || !payload.category_id || !payload.effective_from) {
        throw new Error("Missing required fields. Please complete the form before saving.");
      }
      await invokeSupabaseFunction<{ id?: string }>("rate-cards-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      navigate("/rate-cards");
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ?? (error as Error)?.message ?? "Failed to save rate card.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }, [buildRateCardPayload, navigate, saving]);

  const commissionMode = (templateType ?? (basicsForm.commission_type as TemplateVariant | null)) ?? null;
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

  const commissionComplete = useMemo(() => {
    if (!templateReady) return false;
    const productRequiredOk = (() => {
      if (commissionMode === "flat") {
        return Boolean(flatCommission.trim());
      }
      if (commissionMode === "tiered") {
        return tieredValid;
      }
      return false;
    })();
    return productRequiredOk;
  }, [templateReady, commissionMode, flatCommission, tieredValid]);

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
    const groups: Record<string, FeeFieldConfig[]> = {};
    visibleFeeFields.forEach((field) => {
      const key = field.group || "Fees & Deductions";
      if (!groups[key]) groups[key] = [];
      groups[key].push(field);
    });
    return groups;
  }, [visibleFeeFields]);

  // Step 3 (Fees) is fully optional
  const feesComplete = true;

  const visibleSettlementFields = useMemo(
    () => settlementFieldConfigs.filter((field) => evaluateDependencies(field.dependsOn)),
    [settlementFieldConfigs, evaluateDependencies],
  );

  const settlementComplete = useMemo(() => {
    if (!templateReady) return false;
    const productRequiredOk = PRODUCT_REQUIRED_FIELDS.settlement.every((key) => {
      if (key === "settlement_basis") return validateSettlementTerms(settlementForm);
      return true;
    });
    const touchedOk = settlementTouched;
    return productRequiredOk && touchedOk;
  }, [templateReady, settlementForm, settlementTouched]);

  const validityDateError = useMemo(() => {
    const start = validityForm.effective_from?.trim();
    const end = validityForm.effective_to?.trim();
    if (!start || !end) return "";
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) {
      return "";
    }
    return endDate < startDate ? "End date cannot be before the start date." : "";
  }, [validityForm.effective_from, validityForm.effective_to]);

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
    return requiredFilled && productRequiredOk && !validityDateError;
  }, [templateReady, validityFieldConfigs, validityForm, validityDateError]);

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
      options: true,
      review: true,
    };
  }, [basicsComplete, commissionComplete, taxesComplete, settlementComplete, validityComplete]);

  const isStepUnlocked = useCallback(
    (index: number) => {
      if (index === 0) return true;
      const requiredIds = steps.slice(0, index).map((step) => step.id as keyof StepRequirementMap);
      return requiredIds.every((id) => stepCompletionMap[id] ?? true);
    },
    [steps, stepCompletionMap],
  );

  const currentStepId = steps[activeStep]?.id as keyof StepRequirementMap | undefined;
  const currentStepReady = currentStepId ? stepCompletionMap[currentStepId] ?? true : true;
  const nextDisabled = activeStep === totalSteps - 1 ? false : !currentStepReady;

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
          <option value="">Select {field.label}</option>
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
          <option value="">Select {field.label}</option>
          {options.map((option) => (
            <option key={`${field.key}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    const isNumber = field.inputType === "number";
    return (
      <input
        id={`settlement-${field.key}`}
        type={isNumber ? "number" : "text"}
        step={isNumber ? "0.01" : undefined}
        inputMode={isNumber ? "decimal" : "text"}
        value={value}
        onChange={(event) => updateSettlementField(field.key, event.target.value)}
        placeholder={`Enter ${field.label}`}
        className={`${baseClasses} ${borderClasses}`}
        aria-invalid={missing ? "true" : "false"}
      />
    );
  };

  const renderTieredTableCell = (
    label: string,
    helpText: string,
    value: string,
    onChange: (inputValue: string) => void,
    error?: string,
    options?: {
      disabled?: boolean;
      placeholder?: string;
      trailingControl?: ReactNode;
      helperNote?: string;
    },
    highlight?: boolean,
  ) => (
    <div className="space-y-1">
      <div className={options?.trailingControl ? "flex items-start gap-3" : undefined}>
        <div className={options?.trailingControl ? "flex-1" : undefined}>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={options?.disabled}
            className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200 ${
              error ? "border-rose-300 ring-rose-100" : "border-slate-300"
            } ${options?.disabled ? "bg-slate-100 text-slate-500" : ""}`}
            placeholder={options?.placeholder ?? `Enter ${label}`}
          />
        </div>
        {options?.trailingControl ? <div className="pt-1">{options.trailingControl}</div> : null}
      </div>
      <div className="text-xs text-slate-500">
        <p>{helpText}</p>
        {options?.helperNote && <p className="mt-0.5 text-slate-500">{options.helperNote}</p>}
        {error && (
          <p className="mt-0.5 text-[12px]" style={{ color: "#e06666" }}>
            {error}
          </p>
        )}
        {highlight && (
          <p className="mt-1 text-[12px]" style={{ color: "#e06666" }}>
            Check this slab: there is a gap after or before this range.
          </p>
        )}
      </div>
    </div>
  );

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

      return (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-5 py-4 text-sm text-slate-600">
            Configure slabs exactly as defined in template version {activeTemplate?.version}. Each range should map to
            a unique commission band.
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">{minLabel}</th>
                  <th className="px-4 py-3 text-left">{maxLabel}</th>
                  <th className="px-4 py-3 text-left">{rateLabel}</th>
                  <th className="px-4 py-3 text-right" aria-label="Row actions"></th>
                </tr>
              </thead>
              <tbody>
                {tieredSlabs.map((row, index) => {
                  const errors = tieredErrors[index] || {};
                  const isHighlighted = highlightedGapIndices.includes(index);
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-slate-100"
                      style={
                        isHighlighted
                          ? { backgroundColor: "#FF5A5A33", borderColor: "#ff5a5ab3", borderWidth: 1 }
                          : undefined
                      }
                    >
                      <td className="px-4 py-3 align-top">
                        {renderTieredTableCell(
                          minLabel,
                          tieredColumnConfigs.min.field?.help_text ?? tieredColumnConfigs.min.fallbackHelp,
                          row.min_price,
                          (value) => updateTieredSlab(row.id, "min_price", value),
                          errors.min_price,
                          row.minAutoFilled ? { helperNote: "Suggested automatically from previous slab." } : undefined,
                          isHighlighted,
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div
                          className="space-y-1"
                          style={
                            isHighlighted
                              ? {
                                  backgroundColor: "#FF5A5A33",
                                  borderColor: "#ff5a5ab3",
                                  borderWidth: 1,
                                  borderStyle: "solid",
                                  borderRadius: "0.75rem",
                                  padding: "0.5rem",
                                }
                              : undefined
                          }
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              {row.noUpperLimit ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                                    ∞ (Auto)
                                  </span>
                                  <p className="text-xs text-slate-500">
                                    This slab has no upper limit. It will apply to all prices above the minimum.
                                  </p>
                                  <p className="text-xs text-slate-500">You can edit this later.</p>
                                </div>
                              ) : (
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.01"
                                  value={row.max_price ?? ""}
                                  onChange={(event) => updateTieredSlab(row.id, "max_price", event.target.value)}
                                  className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200 ${
                                    errors.max_price ? "border-rose-300 ring-rose-100" : "border-slate-300"
                                  }`}
                                  placeholder={`Enter ${maxLabel}`}
                                />
                              )}
                            </div>
                            <div className="pt-1">
                              <label className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                  checked={Boolean(row.noUpperLimit)}
                                  onChange={(event) => toggleNoUpperLimit(row.id, event.target.checked)}
                                />
                                <span>No upper limit</span>
                              </label>
                            </div>
                          </div>
                          <div className="text-xs text-slate-500">
                            <p>{tieredColumnConfigs.max.field?.help_text ?? tieredColumnConfigs.max.fallbackHelp}</p>
                            {errors.max_price && <p className="mt-0.5 text-rose-500">{errors.max_price}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {renderTieredTableCell(
                          rateLabel,
                          tieredColumnConfigs.rate.field?.help_text ?? tieredColumnConfigs.rate.fallbackHelp,
                          row.commission_percent,
                          (value) => updateTieredSlab(row.id, "commission_percent", value),
                          errors.commission_percent,
                        )}
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <button
                          type="button"
                          onClick={() => removeTieredSlab(row.id)}
                          disabled={tieredSlabs.length <= 1}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Remove row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pendingNoUpperLimit && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-slate-900">Make this the final slab?</h3>
                <p className="mt-2 text-sm text-slate-600">
                  A slab with no upper limit must be the last slab in the structure. Please remove or adjust slabs
                  below this one, then try again. You can always edit this rate card later if changes are needed.
                </p>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={closeNoUpperLimitModal}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
      onClick={addTieredSlab}
              disabled={hasUnlimitedSlab}
              title={hasUnlimitedSlab ? "Cannot add slabs after a no-upper-limit slab" : undefined}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                hasUnlimitedSlab
                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                  : "border-slate-200 text-slate-700 hover:border-teal-200 hover:bg-teal-50"
              }`}
            >
              <Plus className="h-4 w-4" />
              Add Slab
            </button>
            {hasUnlimitedSlab && (
              <p className="text-xs text-slate-500">
                You cannot add more slabs after a “No upper limit” slab. You can edit this later.
              </p>
            )}
            {!tieredValid && (
              <p className="text-sm text-rose-500">Complete every slab row with valid ranges before continuing.</p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-5 py-4 text-sm text-slate-600">
          Enter a single commission percentage that applies across every price point for template version
          {" "}
          {activeTemplate?.version}.
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6">
          <label htmlFor="flat-commission" className="text-sm font-semibold text-slate-800">
            {commissionFieldConfig.label}
            <span className="ml-1 text-rose-500">*</span>
          </label>
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
            {commissionFieldConfig.helpText}
            {flatCommissionError && <span className="ml-2 text-rose-500">{flatCommissionError}</span>}
          </p>
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
        {Object.entries(feeGroups).map(([groupLabel, fields]) => (
          <div key={groupLabel} className="rounded-2xl border border-slate-100 bg-white px-5 py-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4">
              <p className="text-base font-semibold text-slate-900">{groupLabel}</p>
              <p className="text-sm text-slate-500">Mapped directly from the template metadata.</p>
            </div>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              {fields.map((field) => {
                return (
                  <div key={field.key} className="space-y-2 pb-3">
                    <label htmlFor={`fee-${field.key}`} className="text-sm font-semibold text-slate-800">
                      {field.label}
                      {field.required ? (
                        <span className="ml-1 text-rose-500">*</span>
                      ) : (
                        <span className="ml-2 text-xs font-semibold text-slate-400">Optional</span>
                      )}
                    </label>
                    {renderFeeFieldControl(field)}
                    {field.helpText && <p className="text-xs text-slate-500">{field.helpText}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
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
            <p className="text-sm text-slate-500">Map GST and TCS percentages for this rate card.</p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Version {activeTemplate?.version}
          </span>
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
      <div className="space-y-6">
        {basisField && (
          <div className="rounded-2xl border border-slate-100 bg-white px-5 py-6 shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-semibold text-slate-900">Settlement Basis</p>
                <p className="text-sm text-slate-500">Select how payouts are triggered.</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <label htmlFor={`settlement-${basisField.key}`} className="text-sm font-semibold text-slate-800">
                {basisField.label}
                {basisField.required ? (
                  <span className="ml-1 text-rose-500">*</span>
                ) : (
                  <span className="ml-2 text-xs font-semibold text-slate-400">Optional</span>
                )}
              </label>
              {renderSettlementFieldControl(basisField, basisMissing)}
              {basisMissing && <p className="text-[12px]" style={{ color: "#e06666" }}>Required</p>}
              {basisField.helpText && <p className="text-xs text-slate-500">{basisField.helpText}</p>}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-100 bg-white px-5 py-6 shadow-sm">
          <div className="border-b border-slate-100 pb-4">
            <p className="text-base font-semibold text-slate-900">Payout Details</p>
            <p className="text-sm text-slate-500">Fields adjust automatically based on the selected basis.</p>
          </div>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            {dependentFields.length === 0 ? (
              <p className="col-span-2 text-sm text-slate-500">
                Select a settlement basis to configure additional payout rules.
              </p>
            ) : (
              dependentFields.map((field) => {
                const missing = field.required && !hasContent(settlementForm[field.key]);
                return (
                  <div key={field.key} className="space-y-2">
                    <label htmlFor={`settlement-${field.key}`} className="text-sm font-semibold text-slate-800">
                      {field.label}
                      {field.required ? (
                        <span className="ml-1 text-rose-500">*</span>
                      ) : (
                        <span className="ml-2 text-xs font-semibold text-slate-400">Optional</span>
                      )}
                    </label>
                    {renderSettlementFieldControl(field, missing)}
                    {missing && <p className="text-[12px]" style={{ color: "#e06666" }}>Required</p>}
                    {field.helpText && <p className="text-xs text-slate-500">{field.helpText}</p>}
                  </div>
                );
              })
            )}
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
            <p className="text-sm text-slate-500">Set the date range for which this rate card remains active.</p>
          </div>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            {validityFieldConfigs.map((field) => (
              <div key={field.key} className="space-y-2">
                <label htmlFor={`validity-${field.key}`} className="text-sm font-semibold text-slate-800">
                  {field.label}
                  {field.key === "effective_from" ? (
                    <span className="ml-1 text-rose-500">*</span>
                  ) : (
                    <span className="ml-2 text-xs font-semibold text-slate-400">Optional</span>
                  )}
                </label>
                {(() => {
                  const missing = field.key === "effective_from" && !hasContent(validityForm.effective_from);
                  return (
                    <>
                      <input
                        id={`validity-${field.key}`}
                        type="date"
                        value={validityForm[field.key] ?? ""}
                        onChange={(event) => updateValidityField(field.key, event.target.value)}
                        className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:outline-none focus:ring-2 ${
                          missing ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200" : "border-slate-300 focus:border-teal-500 focus:ring-teal-200"
                        }`}
                      />
                      {missing && <p className="text-[12px]" style={{ color: "#e06666" }}>Required</p>}
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
          <p className="text-base font-semibold text-slate-900">Additional Options</p>
          <p className="text-sm text-slate-500">Optional settings and notes pulled from the template.</p>
        </div>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {optionalFieldConfigs.map((field) => (
            <div key={field.key} className={`space-y-2 ${field.inputType === "textarea" ? "md:col-span-2" : ""}`}>
              <label htmlFor={`optional-${field.key}`} className="text-sm font-semibold text-slate-800">
                {field.label}
                {field.required ? (
                  <span className="ml-1 text-rose-500">*</span>
                ) : (
                  <span className="ml-2 text-xs font-semibold text-slate-400">Optional</span>
                )}
              </label>
              {field.inputType === "textarea" ? (
                <textarea
                  id={`optional-${field.key}`}
                  value={optionalForm[field.key] ?? ""}
                  onChange={(event) => updateOptionalField(field.key, event.target.value)}
                  placeholder={`Enter ${field.label}`}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
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
              {field.helpText && <p className="text-xs text-slate-500">{field.helpText}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderReviewStep = () => {
    if (!templateReady) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6">
          <StepSkeleton lines={6} />
        </div>
      );
    }

    const sections: Array<{
      title: string;
      rows?: Array<{ label: string; value: React.ReactNode; required?: boolean; hasValue?: boolean }>;
      custom?: React.ReactNode;
      missingCount?: number;
    }> = [];

    const formatDateValue = (value?: string | null) => {
      if (!value) return "";
      const date = new Date(value);
      return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("en-GB");
    };

    const formatWeekday = (value?: string | number | null) => {
      const num = Number(value);
      if (Number.isNaN(num) || num < 1 || num > 7) return value ? String(value) : "";
      return WEEKDAY_LABELS[num - 1];
    };

    const basicsRows = [
      {
        label: "Platform",
        value: basicsForm.platform_id || "",
        required: true,
        hasValue: hasContent(basicsForm.platform_id),
      },
      {
        label: "Category",
        value: basicsForm.category_id || "",
        required: true,
        hasValue: hasContent(basicsForm.category_id),
      },
      {
        label: "Template Type",
        value: templateType ? templateType.toUpperCase() : "—",
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
            value: flatCommission ? `${flatCommission}%` : "",
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
                    {slab.min_price ? formatCurrency(slab.min_price) : "—"}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className="font-semibold text-slate-800">
                    {slab.noUpperLimit ? "∞" : slab.max_price ? formatCurrency(slab.max_price) : "—"}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className="font-semibold text-slate-800">
                    {slab.commission_percent ? `${slab.commission_percent}%` : "—"}
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
        value: taxForm.gst_percent || "",
        required: true,
        hasValue: hasContent(taxForm.gst_percent),
      },
      {
        label: "TCS %",
        value: taxForm.tcs_percent || "",
        required: true,
        hasValue: hasContent(taxForm.tcs_percent),
      },
    ];

    const settlementRows = [
      {
        label: "Basis",
        value: settlementForm.settlement_basis
          ? SETTLEMENT_LABELS[settlementForm.settlement_basis] ?? settlementForm.settlement_basis
          : "",
        required: true,
        hasValue: hasContent(settlementForm.settlement_basis),
      },
      {
        label: "T+ Days",
        value: settlementForm.t_plus_days || "",
        required: settlementForm.settlement_basis === "t_plus",
        hasValue: settlementForm.settlement_basis === "t_plus" ? hasContent(settlementForm.t_plus_days) : true,
      },
      {
        label: "Weekly Day",
        value: formatWeekday(settlementForm.weekly_weekday),
        required: settlementForm.settlement_basis === "weekly",
        hasValue: settlementForm.settlement_basis === "weekly" ? hasContent(settlementForm.weekly_weekday) : true,
      },
      {
        label: "Bi-Weekly Day",
        value: formatWeekday(settlementForm.bi_weekly_weekday),
        required: settlementForm.settlement_basis === "bi_weekly",
        hasValue:
          settlementForm.settlement_basis === "bi_weekly"
            ? hasContent(settlementForm.bi_weekly_weekday)
            : true,
      },
      {
        label: "Bi-Weekly Cycle",
        value: settlementForm.bi_weekly_which || "",
        required: settlementForm.settlement_basis === "bi_weekly",
        hasValue:
          settlementForm.settlement_basis === "bi_weekly" ? hasContent(settlementForm.bi_weekly_which) : true,
      },
      {
        label: "Monthly Day",
        value:
          settlementForm.monthly_day?.toLowerCase() === "eom"
            ? "End of Month"
            : settlementForm.monthly_day || "",
        required: settlementForm.settlement_basis === "monthly",
        hasValue: settlementForm.settlement_basis === "monthly" ? hasContent(settlementForm.monthly_day) : true,
      },
      {
        label: "Grace Days",
        value: settlementForm.grace_days || "",
        required: true,
        hasValue: hasContent(settlementForm.grace_days),
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

    const additionalRows = optionalFieldConfigs.map((field) => ({
      label: field.label,
      value: optionalForm[field.key] || "",
      required: field.required,
      hasValue: hasContent(optionalForm[field.key]),
    }));

    sections.push({ title: "Basics", rows: basicsRows });
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
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
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
    sections.push({ title: "Additional Options", rows: additionalRows });

    const missingCount = sections.reduce(
      (count, section) =>
        count +
        (section.rows?.filter((row) => row.required && !row.hasValue).length ?? 0) +
        (section.missingCount ?? 0),
      0,
    );

    return (
      <div className="space-y-6">
        <div className="mt-4 space-y-1">
          <h3 className="text-xl font-semibold text-slate-900">Review & Confirm Rate Card</h3>
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            <Info className="h-4 w-4 text-slate-400" aria-hidden="true" />
            You’ll be able to edit this rate card later if anything needs to be changed.
          </p>
        </div>

        {missingCount > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Some required information is still missing. Please review the highlighted fields before saving.
          </div>
        )}

        {sections.map((section) => (
          <div key={section.title} className="rounded-2xl border border-slate-100 bg-white px-5 py-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4">
              <p className="text-base font-semibold text-slate-900">{section.title}</p>
            </div>
            {section.rows ? (
              <dl className="mt-4 grid gap-4">
                {section.rows.map((row) => {
                  const missing = row.required && !row.hasValue;
                  return (
                    <div
                      key={row.label}
                      className="grid gap-1 rounded-2xl border border-slate-100 px-4 py-3 sm:grid-cols-2 sm:items-center"
                    >
                      <dt className="text-sm font-medium text-slate-600">{row.label}</dt>
                      <dd className={`text-sm font-semibold ${missing ? "text-rose-600" : "text-slate-900"}`}>
                        {hasContent(row.value) ? row.value : "—"}
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
        ))}

        {saveError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{saveError}</div>
        )}

        <div className="flex justify-end">
          <Button
            type="button"
            size="lg"
            onClick={handleSave}
            disabled={saving || missingCount > 0}
            className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow hover:shadow-lg hover:from-teal-600 hover:to-emerald-600 sm:w-auto disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Publish Rate Card"}
          </Button>
        </div>
        <p className="text-xs text-slate-500 text-right">
          Your rate card will appear in the Rate Cards table immediately after publishing.
        </p>
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
          <div className="grid gap-4 md:grid-cols-2">
            {TEMPLATE_CHOICES.map((choice) => {
              const isActive = templateType === choice.key;
              const disabled = templateLoading && isActive;
              return (
                <button
                  key={choice.key}
                  type="button"
                  onClick={() => handleTemplateSelect(choice.key)}
                  aria-pressed={isActive}
                  className={`flex h-full flex-col rounded-2xl border px-4 py-4 text-left transition ${
                    isActive
                      ? "border-teal-300 bg-teal-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50"
                  } ${disabled ? "cursor-wait opacity-70" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{choice.heading}</p>
                      <p className="text-sm text-slate-500">{choice.blurb}</p>
                    </div>
                    {isActive && (
                      <span className="inline-flex items-center rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
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
                Pick a template to pull the latest (v3.3) metadata from Supabase before the wizard unlocks additional steps.
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Active template loaded</p>
                    <p className="text-xs text-slate-500">
                      {templateType === "tiered" ? "Tiered" : "Flat"} • Version {versionLabel}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {fieldCount} fields mapped
                  </span>
                </div>
                <dl className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Version</dt>
                    <dd className="font-semibold text-slate-900">{versionLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Headers</dt>
                    <dd className="font-semibold text-slate-900">{fieldCount}</dd>
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
                  <p className="text-base font-semibold text-slate-900">Basics</p>
                  <p className="text-sm text-slate-500">Tell us where this card will live before we add details.</p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-teal-600">Template synced</span>
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

  return (
    <>
      <div className="min-h-screen bg-slate-50/80 py-10 px-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 lg:flex-row">
        <aside className="rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-sm backdrop-blur lg:sticky lg:top-8 lg:h-fit lg:w-72">
          <div className="mb-6 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-500">Rate Card Wizard</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Create Rate Card</h1>
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
              const isComplete = index < activeStep;
              const disabled = !isStepUnlocked(index);
              const stepHasError = !(stepCompletionMap[step.id as keyof StepRequirementMap] ?? true);
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

            <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                    {activeStep === totalSteps - 1 ? "Finish" : "Next"}
                  </Button>
                </div>
              </div>
            </div>
        </section>
        </div>
      </div>
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
