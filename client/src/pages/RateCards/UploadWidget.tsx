import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  Upload,
  UploadCloud,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Modal from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

import ImportConfirmModal from "./ImportConfirmModal";
import PreviewModal from "./components/PreviewModal";
import { useCsvImport } from "./hooks/useCsvImport";
import { invokeSupabaseFunction } from "@/utils/supabaseFunctions";

type RowOut = RateCardImport.ParsedRow & {
  message: string;
  tooltip?: string;
  existing?: {
    id: string;
    label: string;
    date_range: string;
  };
  suggestions?: Array<
    | { type: "shift_from"; new_from: string; reason: string }
    | { type: "clip_to"; new_to: string; reason: string }
    | { type: "skip"; reason: string }
  >;
  payload?: any;
};

type ParseRowResponse = {
  status: RateCardImport.RowStatus;
  message: string;
  tooltip?: string;
  normalized?: any;
  errors?: string[];
  overlap?: {
    type: "exact" | "similar";
    reason: string;
  };
  archivedMatch?: {
    id: string;
    label: string;
    date_range: string;
    type: "exact" | "overlap";
  };
};

const STATUS_STYLES: Record<RateCardImport.RowStatus, { label: string; className: string; icon: React.ReactNode }> = {
  valid: {
    label: "Valid",
    className:
      "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  similar: {
    label: "Similar",
    className:
      "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-900",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  duplicate: {
    label: "Exact duplicate",
    className:
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-900",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  error: {
    label: "Error",
    className:
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-900",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

const SUMMARY_TILES: Array<{
  key: keyof RateCardImport.ParseSummary | "total";
  label: string;
  tone: "default" | "success" | "warning" | "danger";
}> = [
  { key: "total", label: "Total", tone: "default" },
  { key: "valid", label: "Valid", tone: "success" },
  { key: "similar", label: "Similar", tone: "warning" },
  { key: "duplicate", label: "Exact duplicate", tone: "danger" },
  { key: "error", label: "Errors", tone: "danger" },
];

const toneClasses: Record<"default" | "success" | "warning" | "danger", string> = {
  default:
    "bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-900/40 dark:text-slate-200 dark:border-slate-800",
  success:
    "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900",
  warning:
    "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900",
  danger:
    "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900",
};

type TemplateVariant = "flat" | "tiered";

const ACTIVE_TEMPLATE_VERSION = "v3.2";

type TemplateField = {
  key?: string;
  label: string;
  description?: string;
  example?: string;
  aliases?: string[];
  mandatory?: boolean;
};

type TemplateSampleUrls = {
  csv?: string;
  xlsx?: string;
};

type TemplateMetadata = {
  template_type: TemplateVariant;
  version: string;
  headers_json: TemplateField[];
  sample_data_url: TemplateSampleUrls;
  description?: string;
  created_at?: string;
  updated_at?: string;
};

type TemplateApiRecord = Omit<TemplateMetadata, "sample_data_url"> & {
  sample_data_url?: string | TemplateSampleUrls | null;
};

const parseSampleDataUrl = (value?: string | TemplateSampleUrls | null): TemplateSampleUrls => {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        return parseSampleDataUrl(parsed as TemplateSampleUrls);
      }
    } catch (error) {
      // ignore JSON parse failures, fall through to treat as direct URL
    }
    const isUrl = /^https?:\/\//i.test(value);
    return isUrl ? { csv: value } : {};
  }
  const result: TemplateSampleUrls = {};
  if (value.csv) result.csv = value.csv;
  if (value.xlsx) result.xlsx = value.xlsx;
  return result;
};

type ValidateUploadResponse = {
  status: "success" | "error";
  template_type?: TemplateVariant;
  version?: string;
  mapped?: string[];
  missing_mandatory?: string[];
  unmapped?: string[];
  row_preview?: Array<Record<string, string>>;
  rows?: Array<Record<string, string>>;
  issues?: string[];
  headers?: Array<{ label: string; mandatory?: boolean }>;
  message?: string;
};

type ValidationPreviewState = {
  info: ValidateUploadResponse;
  fileName: string;
  headers: Array<{ label: string; mandatory: boolean }>;
  rowPreview: Array<Record<string, string>>;
  rows: Array<Record<string, string>>;
};

const splitCsvLine = (line: string) => {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
};

const canonicalizeHeader = (value: string) =>
  value
    .replace(/\ufeff/g, "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[₹%()\/+.,_-]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const HEADER_ALIASES: Record<string, string[]> = {
  commission: ["commission percent"],
  "commission type": ["type"],
  "tech fee": ["technology fee"],
  "logistics fee": ["logistics"],
  "storage fee": ["storage"],
  "return logistics fee": ["return fee", "reverse logistics fee"],
  gst: ["gst tax"],
  tcs: ["tax collected at source"],
  "settlement cycle days": [
    "settlement days",
    "settlement cycle",
    "settlement",
    "t days",
    "t plus days",
    "t+ days",
    "t+days",
  ],
  "min price": ["slab min price", "minimum price"],
  "max price": ["slab max price", "maximum price"],
  "commission tier": ["commission percent tier", "tier commission"],
};

const EXPECTED_HEADERS = [
  { display: "Marketplace", key: "marketplace" },
  { display: "Category", key: "category" },
  { display: "Commission Type", key: "commission type" },
  { display: "Commission %", key: "commission %" },
  { display: "Tech Fee ₹", key: "tech fee" },
  { display: "Logistics Fee ₹", key: "logistics fee" },
  { display: "Storage Fee ₹", key: "storage fee" },
  { display: "Return Logistics Fee ₹", key: "return logistics fee" },
  { display: "GST %", key: "gst" },
  { display: "TCS %", key: "tcs" },
  { display: "Settlement Cycle (Days)", key: "settlement cycle days" },
];

const EXPECTED_TIERED_HEADERS = [
  { display: "Marketplace", key: "marketplace" },
  { display: "Category", key: "category" },
  { display: "Commission Type", key: "commission type" },
  { display: "Min Price ₹", key: "min price" },
  { display: "Max Price ₹", key: "max price" },
  { display: "Commission % (Tier)", key: "commission % tier" },
  { display: "Tech Fee ₹", key: "tech fee" },
  { display: "Logistics Fee ₹", key: "logistics fee" },
  { display: "Return Logistics Fee ₹", key: "return logistics fee" },
  { display: "GST %", key: "gst" },
  { display: "TCS %", key: "tcs" },
  { display: "Settlement Cycle (Days)", key: "settlement cycle days" },
];

const buildAcceptedCanon = (expected: { key: string }[]) => {
  const map = new Map<string, Set<string>>();
  for (const { key } of expected) {
    const canonical = canonicalizeHeader(key);
    const forms = new Set<string>();
    forms.add(canonical);
    (HEADER_ALIASES[canonical] ?? []).forEach((alias) => {
      forms.add(canonicalizeHeader(alias));
    });
    map.set(canonical, forms);
  }
  return map;
};

const acceptedFlatCanon = buildAcceptedCanon(EXPECTED_HEADERS);
const acceptedTieredCanon = buildAcceptedCanon(EXPECTED_TIERED_HEADERS);

const findMissingHeaders = (
  expected: { display: string; key: string }[],
  accepted: Map<string, Set<string>>,
  uploadedCanon: string[]
) => {
  const missing: string[] = [];
  for (const { display, key } of expected) {
    const canonical = canonicalizeHeader(key);
    const acceptedForms = accepted.get(canonical);
    if (!acceptedForms) continue;
    const found = uploadedCanon.some((header) =>
      Array.from(acceptedForms).some((form) => header === form || header.includes(form) || form.includes(header))
    );
    if (!found) {
      missing.push(display);
    }
  }
  return missing;
};

interface TemplatePickerModalProps {
  templates: TemplateMetadata[];
  templatesLoading: boolean;
  templateType: TemplateVariant;
  setTemplateType: React.Dispatch<React.SetStateAction<TemplateVariant>>;
  lastUsedType: TemplateVariant | null;
  onClose: () => void;
  onAfterClose?: () => void;
  onDownload: (template: TemplateMetadata | null) => void | Promise<void>;
  onViewGuide: (template: TemplateMetadata | null) => void;
  downloading: boolean;
  open: boolean;
  missingHeaders?: { type: TemplateVariant | null; headers: string[] };
}

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const CARD_ICONS: Record<TemplateVariant, React.ReactNode> = {
  flat: <FileSpreadsheet className="h-5 w-5 text-emerald-600" strokeWidth={2} />,
  tiered: <BarChart3 className="h-5 w-5 text-emerald-600" strokeWidth={2} />,
};

const TemplatePickerModal: React.FC<TemplatePickerModalProps> = ({
  templates,
  templatesLoading,
  templateType,
  setTemplateType,
  lastUsedType,
  onClose,
  onAfterClose,
  onDownload,
  onViewGuide,
  downloading,
  open,
  missingHeaders,
}) => {
  const [visible, setVisible] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const [hoveredTemplate, setHoveredTemplate] = useState<TemplateVariant | null>(null);

  useEffect(() => {
    if (open) {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      frameRef.current = requestAnimationFrame(() => {
        setVisible(true);
      });
      return () => {
        if (frameRef.current) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
      };
    }

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setVisible(false);
    closeTimeoutRef.current = window.setTimeout(() => {
      onAfterClose?.();
    }, 150);

    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [open, onAfterClose]);

  useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, []);

  const handleRequestClose = useCallback(() => {
    if (downloading) return;
    setVisible(false);
    setHoveredTemplate(null);
    onClose();
  }, [downloading, onClose]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleRequestClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleRequestClose]);

  const selectedType = hoveredTemplate ?? templateType;
  const selectedTemplate = templates.find((tpl) => tpl.template_type === templateType) ?? null;
  const hoveredTemplateMeta = templates.find((tpl) => tpl.template_type === selectedType) ?? selectedTemplate;
  const lastUpdated = hoveredTemplateMeta?.updated_at ?? hoveredTemplateMeta?.created_at ?? null;
  const lastUpdatedLabel = formatDate(lastUpdated);
  const lastUpdatedFull = lastUpdated
    ? new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(lastUpdated))
    : null;
  const hasSelection = Boolean(selectedTemplate);
  const missingLabel = missingHeaders?.type ?? null;
  const lastUsedLabel = lastUsedType ? lastUsedType.toUpperCase() : 'NONE';

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-sm transition-opacity duration-150 ease-out",
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onClick={handleRequestClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-picker-title"
    >
      <div
        className={cn(
          "relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all duration-150 ease-out transform-gpu",
          "dark:border-slate-700 dark:bg-slate-900",
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="template-picker-title"
              className="text-xl font-semibold text-slate-900 dark:text-slate-100"
            >
              Choose rate card format
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Pick the layout that matches your commission model.
            </p>
          </div>
          {downloading && (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" aria-hidden="true" />
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="uppercase tracking-wide">Last used: {lastUsedLabel}</span>
          {hoveredTemplateMeta?.version && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
              {hoveredTemplateMeta.version}
            </span>
          )}
          {lastUpdatedFull && <span>{lastUpdatedFull}</span>}
        </div>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {templatesLoading ? (
            Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-2xl border border-slate-200 bg-slate-100/80 p-4"
              >
                <div className="mb-3 h-6 w-24 rounded-full bg-slate-200" />
                <div className="mb-2 h-4 w-32 rounded-full bg-slate-200" />
                <div className="mb-2 h-4 w-20 rounded-full bg-slate-200" />
                <div className="h-4 w-40 rounded-full bg-slate-200" />
              </div>
            ))
          ) : templates.length ? (
            templates.map((template) => {
              const active = template.template_type === templateType;
              const missingHintActive = missingLabel === template.template_type;
              const metaSummary = template.template_type === 'tiered' ? 'Price-based slabs' : 'Simple fixed commission';
              const Icon = CARD_ICONS[template.template_type];
              return (
                <button
                  key={template.template_type}
                  type="button"
                  onClick={() => {
                    if (downloading) return;
                    setTemplateType(template.template_type);
                    localStorage.setItem('rc_template_pref', template.template_type);
                  }}
                  onMouseEnter={() => setHoveredTemplate(template.template_type)}
                  onMouseLeave={() => setHoveredTemplate(null)}
                  disabled={downloading}
                  aria-pressed={active}
                  className={cn(
                    "group relative flex h-full w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition",
                    "hover:shadow-sm dark:border-slate-700 dark:bg-slate-800",
                    active && "border-emerald-500 ring-2 ring-emerald-300 dark:ring-emerald-500/50"
                  )}
                >
                  {active && (
                    <span className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50">
                      {Icon}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          {template.template_type === 'tiered' ? 'Tiered' : 'Flat'} Rate Card
                        </span>
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                          {template.version}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{metaSummary}</p>
                    </div>
                  </div>
                  {missingHintActive && missingHeaders?.headers.length ? (
                    <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-200">
                      Missing: {missingHeaders.headers.join(', ')}
                    </div>
                  ) : null}
                </button>
              );
            })
          ) : (
            <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              No templates available. Please check Supabase configuration.
            </div>
          )}
        </div>
        <div className="mt-6 space-y-4">
          {hoveredTemplateMeta?.version && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                {hoveredTemplateMeta.version}
              </span>
              {lastUpdatedFull && <span>Last updated {lastUpdatedFull}</span>}
            </div>
          )}
          <Button
            onClick={() => onDownload(selectedTemplate)}
            disabled={!hasSelection || downloading}
            className="h-11 w-full gap-2 rounded-2xl bg-slate-900 text-white shadow-sm hover:bg-slate-800"
            aria-pressed={downloading}
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download Template
          </Button>
          <button
            type="button"
            onClick={() => {
              if (!hasSelection) return;
              onViewGuide(selectedTemplate);
            }}
            disabled={!hasSelection}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-2xl border border-transparent bg-teal-50 px-4 py-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60",
              !hasSelection && "opacity-60"
            )}
          >
            <Info className="h-4 w-4 text-teal-600" /> View Column Guide
          </button>
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={downloading}
              className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ColumnGuideModalProps {
  template: TemplateMetadata | null;
  open: boolean;
  onClose: () => void;
}

const ColumnGuideModal: React.FC<ColumnGuideModalProps> = ({ template, open, onClose }) => {
  if (!template) return null;

  const formatLabel = template.template_type === 'tiered' ? 'Tiered' : 'Flat';
  const updatedLabel = formatDate(template.updated_at ?? template.created_at);
  const headers = template.headers_json ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidthClass="max-w-4xl"
      title={`${formatLabel} Rate Card Column Guide`}
    >
      <div className="space-y-6">
        <div className="rounded-2xl bg-teal-50 px-6 py-4 text-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-teal-900">
                {formatLabel} template · {template.version}
              </p>
              <p className="text-xs text-teal-700">
                Reference these fields before uploading your CSV. Mandatory columns are marked with *.
              </p>
            </div>
            {updatedLabel && (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-teal-700 shadow-sm">
                Updated {updatedLabel}
              </span>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
          <div className="max-h-[420px] overflow-auto">
            <table className="min-w-full text-sm text-slate-700">
              <thead className="sticky top-0 bg-white shadow-sm">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Header name</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Mandatory</th>
                  <th className="px-4 py-3 text-right">Example</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((field, idx) => {
                  const mandatory = Boolean(field.mandatory);
                  return (
                    <tr
                      key={`${field.label}-${idx}`}
                      className={cn(
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50',
                        'transition-colors hover:bg-slate-100',
                        mandatory && 'bg-teal-50/70'
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {mandatory ? `${field.label} *` : field.label}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {field.description ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                            mandatory
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {mandatory ? 'Required' : 'Optional'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {field.example ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

interface UploadWidgetProps {
  onImportComplete?: () => void;
  onUploadMetaChange?: (meta: { filename: string; uploadedAt: string }) => void;
}

const UploadWidget: React.FC<UploadWidgetProps> = ({ onImportComplete, onUploadMetaChange }) => {
  const {
    parseResult,
    uploading,
    parseError,
    parseFile,
    reset,
    importRows,
    importing,
    importError,
    importResult,
  } = useCsvImport();
  const [lastUploadMeta, setLastUploadMeta] = useState<{ filename: string; uploadedAt: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<"valid" | "valid+similar" | null>(null);
  const [confirmedRows, setConfirmedRows] = useState<Record<string, boolean>>({});
  const [skippedRows, setSkippedRows] = useState<Record<string, boolean>>({});
  const [rowOverrides, setRowOverrides] = useState<Record<string, Partial<RowOut>>>({});
  const [editorState, setEditorState] = useState<
    | null
    | {
        row: RowOut;
        mode: "adjust" | "fix";
        values: {
          effective_from: string;
          effective_to: string;
        };
      }
  >(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  const [templateCatalog, setTemplateCatalog] =
    useState<Partial<Record<TemplateVariant, TemplateMetadata>>>({});
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [columnGuideTemplate, setColumnGuideTemplate] = useState<TemplateMetadata | null>(null);
  const [columnGuideOpen, setColumnGuideOpen] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templatePickerMounted, setTemplatePickerMounted] = useState(false);
  const [templateType, setTemplateType] = useState<TemplateVariant>(
    localStorage.getItem('rc_template_pref') === 'tiered' ? 'tiered' : 'flat'
  );
  const [lastUsedType, setLastUsedType] = useState<TemplateVariant | null>(() => {
    const stored = localStorage.getItem('rc_template_pref');
    return stored === 'tiered' || stored === 'flat' ? stored : null;
  });
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [templateToast, setTemplateToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const [missingHeaderHint, setMissingHeaderHint] = useState<{ type: TemplateVariant | null; headers: string[] }>({
    type: null,
    headers: [],
  });
  const [validationSummary, setValidationSummary] = useState<{ total: number; valid: number; invalid: number } | null>(
    null
  );
  const [validationResults, setValidationResults] = useState<Map<number, string[]>>(new Map());
  const [invalidHighlightRows, setInvalidHighlightRows] = useState<Set<number>>(new Set());
  const highlightTimerRef = useRef<number | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importSummary, setImportSummary] = useState<{ success: number; skipped: number } | null>(null);
  const [failedRows, setFailedRows] = useState<any[]>([]);
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<ValidationPreviewState | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [validatedFile, setValidatedFile] = useState<File | null>(null);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const openTemplatePicker = useCallback(() => {
    const stored = localStorage.getItem('rc_template_pref') === 'tiered' ? 'tiered' : 'flat';
    setTemplateType(stored);
    setTemplatePickerMounted(true);
    setShowTemplatePicker(true);
  }, [setTemplatePickerMounted, setShowTemplatePicker, setTemplateType]);

  const showTempToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setTemplateToast(msg);
    toastTimeoutRef.current = window.setTimeout(() => setTemplateToast(null), 2500);
  }, []);

  useEffect(() => {
    setLastUsedType(templateType);
  }, [templateType]);

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      setTemplatesLoading(true);
      try {
        const response = await invokeSupabaseFunction<{ status?: string; templates?: TemplateApiRecord[] }>(
          'get_rate_card_templates'
        );
        if (cancelled) return;
        const records = Array.isArray(response?.templates) ? response.templates : [];
        const next: Partial<Record<TemplateVariant, TemplateMetadata>> = {};
        records.forEach((record) => {
          if (record.template_type !== 'flat' && record.template_type !== 'tiered') return;
          next[record.template_type] = {
            ...record,
            headers_json: Array.isArray(record.headers_json) ? record.headers_json : [],
            sample_data_url: parseSampleDataUrl(record.sample_data_url),
          };
        });
        setTemplateCatalog(next);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load rate card templates', error);
        showTempToast('⚠️ Could not load templates. Please refresh.');
      } finally {
        if (!cancelled) {
          setTemplatesLoading(false);
        }
      }
    };

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [showTempToast]);

  const readFileAsBase64 = useCallback(
    (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result === 'string') {
            const base64 = result.includes(',') ? result.split(',').pop() ?? '' : result;
            resolve(base64);
          } else {
            reject(new Error('Failed to read file'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      }),
    []
  );

  const templatesList = useMemo(() => {
    const entries = Object.values(templateCatalog).filter(
      (value): value is TemplateMetadata => Boolean(value)
    );
    const order: TemplateVariant[] = ['flat', 'tiered'];
    return entries.sort((a, b) => order.indexOf(a.template_type) - order.indexOf(b.template_type));
  }, [templateCatalog]);

  const handleReset = useCallback(() => {
    reset();
    setTemplatePickerMounted(false);
    setTemplateType(localStorage.getItem('rc_template_pref') === 'tiered' ? 'tiered' : 'flat');
    setValidationSummary(null);
    setValidationResults(new Map());
    setInvalidHighlightRows(new Set());
    setImportProgress(0);
    setImportSummary(null);
    setFailedRows([]);
    setPreviewState(null);
    setPreviewOpen(false);
    setValidatedFile(null);
    setValidationError(null);
  }, [reset]);

  const handleViewColumnGuide = useCallback(
    (template: TemplateMetadata | null) => {
      if (!template) {
        showTempToast('⚠️ Please select a template type first.');
        return;
      }
      setColumnGuideTemplate(template);
      setColumnGuideOpen(true);
      setShowTemplatePicker(false);
      setTemplatePickerMounted(false);
    },
    [showTempToast]
  );

  const handleCloseColumnGuide = useCallback(() => {
    setColumnGuideOpen(false);
    setColumnGuideTemplate(null);
  }, []);

  const validateUploadedHeaders = useCallback(async (file: File): Promise<TemplateVariant | null> => {
    try {
      const sample = await file.slice(0, 64 * 1024).text();
      const firstLine = sample
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0);

      if (!firstLine) {
        showTempToast('⚠️ Header mismatch: please re-download the latest template.');
        setMissingHeaderHint({ type: null, headers: [] });
        return null;
      }

      const headers = splitCsvLine(firstLine.replace(/\ufeff/g, ""));
      const uploadedCanon = headers.map(canonicalizeHeader).filter((header) => header.length > 0);

      const missingFlat = findMissingHeaders(EXPECTED_HEADERS, acceptedFlatCanon, uploadedCanon);
      const missingTiered = findMissingHeaders(EXPECTED_TIERED_HEADERS, acceptedTieredCanon, uploadedCanon);

      if (missingFlat.length === 0) {
        setMissingHeaderHint({ type: null, headers: [] });
        return "flat";
      }

      if (missingTiered.length === 0) {
        setMissingHeaderHint({ type: null, headers: [] });
        return "tiered";
      }

      let bestType: TemplateVariant | null = null;
      let bestMissing: string[] = [];
      let bestPresentCount = 0;

      const consider = (type: TemplateVariant, missing: string[], expectedLength: number) => {
        const presentCount = expectedLength - missing.length;
        if (presentCount <= 0) return;
        if (
          presentCount > bestPresentCount ||
          (presentCount === bestPresentCount && missing.length < bestMissing.length)
        ) {
          bestType = type;
          bestMissing = missing;
          bestPresentCount = presentCount;
        }
      };

      consider("flat", missingFlat, EXPECTED_HEADERS.length);
      consider("tiered", missingTiered, EXPECTED_TIERED_HEADERS.length);

      if (!bestType) {
        showTempToast('⚠️ Header mismatch: please re-download the latest template.');
        setMissingHeaderHint({ type: null, headers: [] });
        return null;
      }

      setMissingHeaderHint({ type: bestType, headers: bestMissing });
      if (bestMissing.length) {
        showTempToast(`⚠️ Missing columns: ${bestMissing.join(', ')}.`);
      }
      return null;
    } catch (error) {
      console.error('Failed to validate headers', error);
      showTempToast('⚠️ Header mismatch: please re-download the latest template.');
      setMissingHeaderHint({ type: null, headers: [] });
      return null;
    }
  }, [showTempToast, setMissingHeaderHint]);

  const handlePreviewClose = useCallback(() => {
    setPreviewOpen(false);
    setPreviewState(null);
    setValidatedFile(null);
  }, []);

  const handleValidateFile = useCallback(
    async (file: File) => {
      const extension = file.name.toLowerCase().split('.').pop();
      if (!extension || !['csv', 'xlsx', 'xls'].includes(extension)) {
        setValidationError('Unsupported file type. Please upload a CSV or XLSX file.');
        showTempToast('⚠️ Unsupported file type. Please upload a CSV or XLSX file.');
        return;
      }

      setValidationError(null);
      setValidationLoading(true);

      try {
        const base64 = await readFileAsBase64(file);
        const response = await invokeSupabaseFunction<ValidateUploadResponse>('validate_rate_card_upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: base64, file_name: file.name }),
        });
        setValidationLoading(false);

        if (response.status === 'error' || !response.template_type) {
          const message = response.message || 'Validation failed. Please review your template.';
          setValidationError(message);
          showTempToast(`⚠️ ${message}`);
          return;
        }

        const headers = response.headers?.length
          ? response.headers.map((field) => ({ label: field.label, mandatory: Boolean(field.mandatory) }))
          : (() => {
              const keys = response.row_preview && response.row_preview.length ? Object.keys(response.row_preview[0]) : [];
              return keys.map((label) => ({ label, mandatory: (response.missing_mandatory ?? []).includes(label) }));
            })();

        setPreviewState({
          info: response,
          fileName: file.name,
          headers,
          rowPreview: response.row_preview ?? [],
          rows: response.rows ?? response.row_preview ?? [],
        });
        setValidatedFile(file);
        setPreviewOpen(true);
        if (response.version && response.version !== ACTIVE_TEMPLATE_VERSION) {
          showTempToast(`⚠️ Old template (${response.version}) detected – please update to ${ACTIVE_TEMPLATE_VERSION}`);
        } else {
          showTempToast('✅ Validated successfully');
        }
      } catch (error) {
        console.error('validate_rate_card_upload error', error);
        setValidationLoading(false);
        setValidationError('Validation failed. Please try again.');
        showTempToast('⚠️ Validation failed. Please try again.');
      }
    },
    [readFileAsBase64, showTempToast]
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDropActive(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setDropActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDropActive(false);
      if (validationLoading) return;
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      setValidationError(null);
      await handleValidateFile(file);
    },
    [handleValidateFile, validationLoading]
  );

  const handleValidate = useCallback(
    async (rows: any[]) => {
      try {
        const data = await invokeSupabaseFunction<any>('rate-cards-import?action=validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows }),
        });
        if (data?.summary?.invalid > 0) {
          showTempToast(`⚠️ Found ${data.summary.invalid} invalid row(s). Check errors below.`);
        } else if (data?.summary?.valid) {
          showTempToast('✅ All rows validated successfully!');
        }
        return data;
      } catch (error) {
        console.error('Validation error:', error);
        showTempToast('⚠️ Validation failed. Please try again.');
        return null;
      }
    },
    [showTempToast]
  );

  const processFileForImport = useCallback(
    async (file: File) => {
      try {
        const detectedTemplate = await validateUploadedHeaders(file);
        if (!detectedTemplate) {
          return;
        }
        setTemplateType(detectedTemplate);
        setMissingHeaderHint({ type: null, headers: [] });
        setValidationSummary(null);
        setValidationResults(new Map());

        const result = await parseFile(file);
        const validationPayload = result.rows.map((row) => ({
          ...row,
          ...(row.payload ?? {}),
        }));
        const validationResponse = await handleValidate(validationPayload);
        if (validationResponse?.results) {
          const nextMap = new Map<number, string[]>();
          validationResponse.results.forEach((item: any) => {
            if (!item) return;
            const rowNumber = Number(item.row);
            if (!Number.isFinite(rowNumber)) return;
            if (Array.isArray(item.errors) && item.errors.length) {
              nextMap.set(rowNumber, item.errors);
            }
          });
          setValidationResults(nextMap);
          if (nextMap.size) {
            const highlightSet = new Set<number>(nextMap.keys());
            setInvalidHighlightRows(highlightSet);
            if (highlightTimerRef.current) {
              window.clearTimeout(highlightTimerRef.current);
            }
            highlightTimerRef.current = window.setTimeout(() => {
              setInvalidHighlightRows(new Set());
              highlightTimerRef.current = null;
            }, 2000);
          } else {
            setInvalidHighlightRows(new Set());
          }
        } else {
          setValidationResults(new Map());
          setInvalidHighlightRows(new Set());
        }
        setValidationSummary(validationResponse?.summary ?? null);
        const meta = { filename: result.file_name ?? file.name, uploadedAt: result.uploaded_at };
        setLastUploadMeta(meta);
        onUploadMetaChange?.(meta);
      } catch (error) {
        console.error("Failed to parse rate card file", error);
        showTempToast('⚠️ Failed to process file.');
      }
    },
    [handleValidate, onUploadMetaChange, parseFile, showTempToast, validateUploadedHeaders]
  );

  const handleConfirmPreview = useCallback(async () => {
    if (!previewState) return;
    if (previewState.info.missing_mandatory?.length) return;

    const rows = previewState.rows ?? [];
    const templateType = previewState.info.template_type ?? 'flat';
    const version = previewState.info.version ?? ACTIVE_TEMPLATE_VERSION;

    setConfirmingImport(true);
    try {
      const payload = {
        template_type: templateType,
        version,
        file_name: previewState.fileName,
        uploaded_by: null,
        data: rows,
        issues: {
          mapped: previewState.info.mapped ?? [],
          missing_mandatory: previewState.info.missing_mandatory ?? [],
          unmapped: previewState.info.unmapped ?? [],
        },
        validation_status: (previewState.info.unmapped?.length ?? 0) > 0 ? 'warning' : 'success',
      } as const;

      const response = await invokeSupabaseFunction<{ status: string; message?: string }>(
        'import_rate_card_data',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (response.status !== 'success') {
        throw new Error(response.message || 'Import failed');
      }

      showTempToast(`✅ Imported ${previewState.fileName} (${rows.length} rows)`);
      onImportComplete?.();
      handlePreviewClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed. Please try again.';
      console.error('Import after preview failed', error);
      showTempToast(`⚠️ Import failed – ${message}`);
    } finally {
      setConfirmingImport(false);
    }
  }, [handlePreviewClose, onImportComplete, previewState, showTempToast]);

  useEffect(() => {
    if (showTemplatePicker) {
      setTemplatePickerMounted(true);
    }
  }, [showTemplatePicker]);

  useEffect(() => {
    if (!parseResult) {
      setValidationSummary(null);
      setValidationResults(new Map());
      setInvalidHighlightRows(new Set());
      setFailedRows([]);
      setImportSummary(null);
      setImportProgress(0);
    }
  }, [parseResult]);

  useEffect(() => {
    if (!validationResults.size) return;
    const firstInvalid = Math.min(...Array.from(validationResults.keys()));
    if (!Number.isFinite(firstInvalid)) return;
    const rowElement = document.getElementById(`rate-row-${firstInvalid}`);
    if (rowElement) {
      rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [validationResults]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

 const mergedRows = useMemo<RowOut[]>(() => {
    const base = (parseResult?.rows ?? []) as RowOut[];
    return base.map((row) => {
      const override = rowOverrides[row.row_id];
      if (!override) return row;
      return {
        ...row,
        ...override,
        payload: override.payload ?? row.payload,
        effective_from: override.effective_from ?? (row as RowOut).effective_from,
        effective_to:
          override.effective_to !== undefined ? override.effective_to : (row as RowOut).effective_to,
      } as RowOut;
    });
  }, [parseResult, rowOverrides]);

  const summaryValues = useMemo(() => {
    const counts = {
      total: mergedRows.length || parseResult?.summary?.total || 0,
      valid: 0,
      similar: 0,
      duplicate: 0,
      error: 0,
    };

    if (!mergedRows.length) {
      return {
        ...counts,
        valid: parseResult?.summary?.valid ?? 0,
        similar: parseResult?.summary?.similar ?? 0,
        duplicate: parseResult?.summary?.duplicate ?? 0,
        error: parseResult?.summary?.error ?? 0,
      };
    }

    for (const row of mergedRows) {
      if (row.status === "valid") counts.valid += 1;
      else if (row.status === "similar") counts.similar += 1;
      else if (row.status === "duplicate") counts.duplicate += 1;
      else if (row.status === "error") counts.error += 1;
    }

    return counts;
  }, [mergedRows, parseResult?.summary?.duplicate, parseResult?.summary?.error, parseResult?.summary?.similar, parseResult?.summary?.total, parseResult?.summary?.valid]);

const unresolvedSimilarCount = useMemo(
  () =>
    mergedRows.filter(
      (row) =>
        row.status === "similar" &&
        !skippedRows[row.row_id] &&
        !confirmedRows[row.row_id]
    ).length,
  [mergedRows, skippedRows, confirmedRows]
);

const unresolvedErrorCount = useMemo(
  () => mergedRows.filter((row) => row.status === "error" && !skippedRows[row.row_id]).length,
  [mergedRows, skippedRows]
);

  const eligibleValidRows = useMemo(
    () => mergedRows.filter((row) => row.status === "valid" && !skippedRows[row.row_id]),
    [mergedRows, skippedRows]
  );

  const eligibleSimilarRows = useMemo(
    () =>
      mergedRows.filter(
        (row) =>
          row.status === "similar" &&
          !skippedRows[row.row_id] &&
          confirmedRows[row.row_id]
      ),
    [mergedRows, skippedRows, confirmedRows]
  );

const hasEligibleRows = eligibleValidRows.length > 0 || eligibleSimilarRows.length > 0;

const guardrailsBlocking = unresolvedSimilarCount > 0 || unresolvedErrorCount > 0;

  const collectOverrides = useCallback(
    (ids: string[]) => {
      const overrides: Record<string, unknown> = {};
      for (const id of ids) {
        if (!id) continue;
        const payload = rowOverrides[id]?.payload;
        if (payload && typeof payload === "object") {
          overrides[id] = payload;
        }
      }
      return Object.keys(overrides).length ? overrides : undefined;
    },
    [rowOverrides]
  );

  useEffect(() => {
    setConfirmedRows({});
    const duplicateDefaults: Record<string, boolean> = {};
    if (parseResult?.rows) {
      for (const row of parseResult.rows) {
        if (row.status === "duplicate") {
          duplicateDefaults[row.row_id] = true;
        }
      }
    }
    setSkippedRows(duplicateDefaults);
    setRowOverrides({});
    setEditorState(null);
    setEditorError(null);
    setEditorSaving(false);
  }, [parseResult?.analysis_id]);

  const handleFileInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || validationLoading) return;
      await handleValidateFile(file);
    },
    [handleValidateFile, validationLoading]
  );

  const handleOpenConfirm = () => {
    if (!hasEligibleRows || importing) return;
    setConfirmOpen(true);
  };

  const handleCancelConfirm = () => {
    if (importing) return;
    setConfirmOpen(false);
  };

  const handleImportValid = async () => {
    setPendingChoice("valid");
    try {
      const eligibleRowIds = eligibleValidRows
        .filter((row) => !isRowInvalid(row.row))
        .map((row) => ({ id: row.row_id, rowNumber: row.row }));

      const skippedCount = eligibleValidRows.length - eligibleRowIds.length;

      if (!eligibleRowIds.length) {
        showTempToast('⚠️ No valid rows available to import.');
        return;
      }

      if (skippedCount > 0) {
        showTempToast(`⚠️ Skipped ${skippedCount} invalid row${skippedCount === 1 ? '' : 's'}.`);
      }

      const rowIds = Array.from(new Set(eligibleRowIds.map((item) => item.id)));

      setImportProgress(0);
      const response = await importRows({
        includeSimilar: false,
        rowIds,
        overrides: collectOverrides(rowIds),
        onProgress: (index, total) => {
          const percent = total > 0 ? Math.round((index / total) * 100) : 100;
          setImportProgress(percent);
        },
      });
      if (response) {
        const successCount = response.results.filter((item) => item.status === 'imported').length;
        const failedItems = response.results.filter((item) => item.status !== 'imported');
        const failedData = failedItems
          .map((item) =>
            // TODO: Remove ts-ignore once ImportResponse exposes camelCase rowId.
            // @ts-ignore
            parseResult?.rows.find((row) => row.row_id === item.rowId) ??
            // TODO: Remove ts-ignore once ImportResponse exposes camelCase rowId.
            // @ts-ignore
            mergedRows.find((row) => row.row_id === item.rowId)
          )
          .filter((row): row is typeof mergedRows[number] => Boolean(row))
          .map((row) => {
            const safeRow: any = row;
            return {
              row: safeRow.row,
              row_id: safeRow.row_id,
              platform: safeRow.platform_id || '',
              category: safeRow.category_id || '',
              type: safeRow.commission_type || '',
              validFrom: safeRow.effective_from ?? '',
              validTo: safeRow.effective_to ?? '',
              status: safeRow.status,
              // TODO: Remove ts-ignore once ImportResponse exposes camelCase rowId.
              // @ts-ignore
              message: failedItems.find((item) => item.rowId === safeRow.row_id)?.message ?? safeRow.message,
            };
          });
        setFailedRows(failedData);
        setImportSummary({ success: successCount, skipped: skippedCount + failedData.length });
        if (failedData.length) {
          showTempToast(`⚠️ ${failedData.length} row${failedData.length === 1 ? '' : 's'} failed during import.`);
        } else {
          showTempToast(`✅ Imported ${successCount} row${successCount === 1 ? '' : 's'} successfully.`);
        }
        setImportProgress(100);
        setConfirmOpen(false);
        onImportComplete?.();
      }
    } catch (error) {
      console.error("Import valid rows failed", error);
    } finally {
      setPendingChoice(null);
    }
  };

  const handleImportValidAndSimilar = async () => {
    setPendingChoice("valid+similar");
    try {
      const filteredValid = eligibleValidRows.filter((row) => !isRowInvalid(row.row));
      const filteredSimilar = eligibleSimilarRows.filter((row) => !isRowInvalid(row.row));
      const skippedCount =
        eligibleValidRows.length + eligibleSimilarRows.length - (filteredValid.length + filteredSimilar.length);

      const rowIds = Array.from(
        new Set([
          ...filteredValid.map((row) => row.row_id),
          ...filteredSimilar.map((row) => row.row_id),
        ])
      );

      if (!rowIds.length) {
        showTempToast('⚠️ No valid rows available to import.');
        return;
      }

      if (skippedCount > 0) {
        showTempToast(`⚠️ Skipped ${skippedCount} invalid row${skippedCount === 1 ? '' : 's'}.`);
      }

      setImportProgress(0);
      const response = await importRows({
        includeSimilar: true,
        rowIds,
        overrides: collectOverrides(rowIds),
        onProgress: (index, total) => {
          const percent = total > 0 ? Math.round((index / total) * 100) : 100;
          setImportProgress(percent);
        },
      });
      if (response) {
        const successCount = response.results.filter((item) => item.status === 'imported').length;
        const failedItems = response.results.filter((item) => item.status !== 'imported');
        const failedData = failedItems
          .map((item) =>
            // TODO: Remove ts-ignore once ImportResponse exposes camelCase rowId.
            // @ts-ignore
            parseResult?.rows.find((row) => row.row_id === item.rowId) ??
            // TODO: Remove ts-ignore once ImportResponse exposes camelCase rowId.
            // @ts-ignore
            mergedRows.find((row) => row.row_id === item.rowId)
          )
          .filter((row): row is typeof mergedRows[number] => Boolean(row))
          .map((row) => {
            const safeRow: any = row;
            return {
              row: safeRow.row,
              row_id: safeRow.row_id,
              platform: safeRow.platform_id || '',
              category: safeRow.category_id || '',
              type: safeRow.commission_type || '',
              status: safeRow.status,
              validFrom: safeRow.effective_from ?? '',
              validTo: safeRow.effective_to ?? '',
              // TODO: Remove ts-ignore once ImportResponse exposes camelCase rowId.
              // @ts-ignore
              message: failedItems.find((item) => item.rowId === safeRow.row_id)?.message ?? safeRow.message,
            };
          });
        setFailedRows(failedData);
        setImportSummary({ success: successCount, skipped: skippedCount + failedData.length });
        if (failedData.length) {
          showTempToast(`⚠️ ${failedData.length} row${failedData.length === 1 ? '' : 's'} failed during import.`);
        } else {
          showTempToast(`✅ Imported ${successCount} row${successCount === 1 ? '' : 's'} successfully.`);
        }
        setImportProgress(100);
        setConfirmOpen(false);
        onImportComplete?.();
      }
    } catch (error) {
      console.error("Import valid + similar rows failed", error);
    } finally {
      setPendingChoice(null);
    }
  };

  const handleRetryFailed = useCallback(async () => {
    if (!failedRows.length) return;
    const rowIds = failedRows.map((row) => row.row_id).filter(Boolean);
    if (!rowIds.length) return;

    setPendingChoice("valid");
    try {
      setImportProgress(0);
      const response = await importRows({
        includeSimilar: failedRows.some((row) => row.status === 'similar'),
        rowIds,
        overrides: collectOverrides(rowIds),
        onProgress: (index, total) => {
          const percent = total > 0 ? Math.round((index / total) * 100) : 100;
          setImportProgress(percent);
        },
      });
      if (response) {
        const successCount = response.results.filter((item) => item.status === 'imported').length;
        const failedItems = response.results.filter((item) => item.status !== 'imported');
        if (!failedItems.length) {
          setFailedRows([]);
          setImportSummary({ success: successCount, skipped: 0 });
          setImportProgress(100);
          showTempToast('✅ All failed rows imported successfully!');
        } else {
          const stillFailed = failedItems
            .map((item) =>
              // TODO: Remove ts-ignore once ImportResponse exposes camelCase rowId.
              // @ts-ignore
              parseResult?.rows.find((row) => row.row_id === item.rowId) ??
              // TODO: Remove ts-ignore once ImportResponse exposes camelCase rowId.
              // @ts-ignore
              mergedRows.find((row) => row.row_id === item.rowId)
            )
            .filter((row): row is typeof mergedRows[number] => Boolean(row))
            .map((row) => {
              const safeRow: any = row;
              return {
                row: safeRow.row,
                row_id: safeRow.row_id,
                platform: safeRow.platform_id || '',
                category: safeRow.category_id || '',
                type: safeRow.commission_type || '',
                status: safeRow.status,
                validFrom: safeRow.effective_from ?? '',
                validTo: safeRow.effective_to ?? '',
                // TODO: Remove ts-ignore once ImportResponse exposes camelCase rowId.
                // @ts-ignore
                message: failedItems.find((item) => item.rowId === safeRow.row_id)?.message ?? safeRow.message,
              };
            });
          setFailedRows(stillFailed);
          setImportSummary({ success: successCount, skipped: stillFailed.length });
          setImportProgress(100);
          showTempToast(`⚠️ ${stillFailed.length} row${stillFailed.length === 1 ? '' : 's'} still failed.`);
        }
      }
    } catch (error) {
      console.error('Retry failed import error:', error);
      showTempToast('⚠️ Retry failed. Please try again.');
    } finally {
      setPendingChoice(null);
    }
  }, [collectOverrides, failedRows, importRows, mergedRows, parseResult, showTempToast]);

  const handleExportFailed = useCallback(() => {
    if (!failedRows.length) return;
    const csvRows = [
      ['Row', 'Marketplace', 'Category', 'Type', 'Valid From', 'Valid To', 'Message'],
      ...failedRows.map((row) => [
        row.row,
        row.platform,
        row.category,
        row.type,
        row.validFrom,
        row.validTo,
        row.message ?? '',
      ]),
    ];

    const csvContent = csvRows
      .map((row) =>
        row
          .map((cell) => {
            const cellText = cell === undefined || cell === null ? '' : String(cell);
            return /[",\n]/.test(cellText)
              ? `"${cellText.replace(/"/g, '""')}"`
              : cellText;
          })
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'failed-rate-card-rows.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showTempToast('💾 Failed rows exported for review.');
  }, [failedRows, showTempToast]);

  const downloadTemplate = async (template: TemplateMetadata | null) => {
    if (!template) {
      showTempToast('⚠️ Please select a template type first.');
      return;
    }

    const url = template.sample_data_url.xlsx ?? template.sample_data_url.csv;
    if (!url) {
      showTempToast('⚠️ Template download is not available right now.');
      return;
    }

    let success = false;
    try {
      setDownloadingTemplate(true);
      localStorage.setItem('rc_template_pref', template.template_type);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const urlInstance = (() => {
        try {
          return new URL(url);
        } catch (error) {
          return null;
        }
      })();
      const pathName = urlInstance?.pathname ?? '';
      const extMatch = pathName.split('.').pop();
      const extension = extMatch && extMatch.length <= 5 ? extMatch : template.sample_data_url.xlsx ? 'xlsx' : 'csv';
      const filename = `RateCard_${template.template_type === 'tiered' ? 'Tiered' : 'Flat'}_${template.version}.${extension}`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(link.href);
      link.remove();

      success = true;
      showTempToast(`✅ ${template.template_type === 'tiered' ? 'Tiered' : 'Flat'} template downloaded`);
    } catch (error) {
      console.error('Template download failed', error);
      showTempToast('⚠️ Could not download template. Please try again.');
    } finally {
      setDownloadingTemplate(false);
      if (success) {
        setShowTemplatePicker(false);
      }
    }
  };

  const downloadIssues = () => {
    const issueRows = mergedRows.filter((row) =>
      row.status === "error" || row.status === "duplicate" || row.status === "similar"
    );
    if (!issueRows.length) return;

    const header = [
      "row",
      "status",
      "message",
      "tooltip",
      "platform",
      "category",
      "type",
      "date_range",
    ];

    const toCsvValue = (value: unknown) => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (/["]/.test(str) || str.includes(",") || /\r|\n/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = [header.join(",")];
    for (const row of issueRows) {
      lines.push(
        [
          row.row,
          row.status,
          row.message,
          row.tooltip ?? "",
          row.platform_id ?? "",
          row.category_id ?? "",
          row.commission_type ?? "",
          row.effective_from ? `${row.effective_from} → ${row.effective_to ?? "open"}` : "-",
        ]
          .map(toCsvValue)
          .join(",")
      );
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const baseName = (lastUploadMeta?.filename ?? "rate-cards").replace(/\.[^.]+$/, "");
    link.download = `${baseName}-issues.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const confirmRow = (row: RowOut) => {
    setConfirmedRows((prev) => ({ ...prev, [row.row_id]: true }));
    setSkippedRows((prev) => {
      if (!prev[row.row_id]) return prev;
      const next = { ...prev };
      delete next[row.row_id];
      return next;
    });
  };

  const toggleSkipRow = (row: RowOut) => {
    setSkippedRows((prev) => {
      const next = { ...prev };
      if (next[row.row_id]) {
        delete next[row.row_id];
      } else {
        next[row.row_id] = true;
      }
      return next;
    });
    setConfirmedRows((prev) => {
      if (!prev[row.row_id]) return prev;
      const next = { ...prev };
      delete next[row.row_id];
      return next;
    });
  };

  const openEditor = (row: RowOut, mode: "adjust" | "fix") => {
    setEditorError(null);
    setEditorSaving(false);
    const suggestion = row.suggestions?.find((item) =>
      mode === "adjust"
        ? item.type === "shift_from" || item.type === "clip_to"
        : false
    );

    const initialFrom =
      suggestion && suggestion.type === "shift_from"
        ? suggestion.new_from
        : rowOverrides[row.row_id]?.effective_from ?? row.effective_from ?? row.payload?.effective_from ?? "";
    const initialTo =
      suggestion && suggestion.type === "clip_to"
        ? suggestion.new_to
        : rowOverrides[row.row_id]?.effective_to ??
          (row.payload?.effective_to ?? row.effective_to ?? "");

    setEditorState({
      row,
      mode,
      values: {
        effective_from: initialFrom,
        effective_to: initialTo ?? "",
      },
    });
  };

  const closeEditor = () => {
    setEditorState(null);
    setEditorError(null);
    setEditorSaving(false);
  };

  const isValidDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return date.toISOString().slice(0, 10) === value;
  };

  const resolveIdField = (
    ...values: Array<unknown>
  ) => {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return "";
  };

  const revalidateRow = useCallback(
    async (
      row: RowOut,
      payload: any,
      values: { effective_from: string; effective_to: string | null },
      options?: { closeOnSuccess?: boolean; mode?: "adjust" | "fix" }
    ) => {
      setEditorSaving(true);
      setEditorError(null);

      const resolvedPlatform = resolveIdField(
        payload?.platform_id,
        rowOverrides[row.row_id]?.payload?.platform_id,
        (row.payload as any)?.platform_id,
        row.platform_id
      );
      const resolvedCategory = resolveIdField(
        payload?.category_id,
        rowOverrides[row.row_id]?.payload?.category_id,
        (row.payload as any)?.category_id,
        row.category_id
      );

      const requestPayload = {
        ...payload,
        platform_id: resolvedPlatform,
        category_id: resolvedCategory,
      };

      try {
        const parsed = await invokeSupabaseFunction<ParseRowResponse>("rate-cards-import?action=parse-row", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
        });

        const updatedPayload =
          parsed.normalized && typeof parsed.normalized === "object"
            ? {
                ...parsed.normalized,
                platform_id: resolvedPlatform,
                category_id: resolvedCategory,
                effective_from: values.effective_from,
                effective_to: values.effective_to,
              }
            : {
                ...requestPayload,
                effective_from: values.effective_from,
                effective_to: values.effective_to,
              };

        setRowOverrides((prev) => {
          const existing = prev[row.row_id] ?? {};
          const nextOverride: Partial<RowOut> = {
            ...existing,
            payload: updatedPayload,
            effective_from: values.effective_from,
            effective_to: values.effective_to,
            status: parsed!.status,
            message: parsed!.message,
            tooltip: parsed!.tooltip,
          };
          if (parsed!.archivedMatch) {
            (nextOverride as any).archivedMatch = parsed!.archivedMatch;
          } else if ((existing as any)?.archivedMatch) {
            delete (nextOverride as any).archivedMatch;
          }
          return {
            ...prev,
            [row.row_id]: nextOverride,
          };
        });

        setEditorState((prev) => {
          if (!prev || prev.row.row_id !== row.row_id) return prev;
          const nextRow: RowOut = {
            ...prev.row,
            status: parsed!.status,
            message: parsed!.message,
            tooltip: parsed!.tooltip,
            payload: updatedPayload,
          };
          if (parsed!.archivedMatch) {
            nextRow.archivedMatch = parsed!.archivedMatch;
          } else if ((nextRow as any).archivedMatch) {
            delete (nextRow as any).archivedMatch;
          }
          return {
            ...prev,
            row: nextRow,
            values: {
              effective_from: values.effective_from,
              effective_to: values.effective_to ?? "",
            },
          };
        });

        setSkippedRows((prev) => {
          const next = { ...prev };
          if (parsed!.status === "duplicate") {
            next[row.row_id] = true;
          } else {
            delete next[row.row_id];
          }
          return next;
        });

        setConfirmedRows((prev) => {
          const next = { ...prev };
          if (parsed!.status === "similar" && options?.mode === "adjust") {
            next[row.row_id] = true;
          } else {
            delete next[row.row_id];
          }
          return next;
        });

        if (parsed.status === "error") {
          setEditorError(parsed.message || "Row still has validation issues.");
          return false;
        }

        if (options?.closeOnSuccess !== false) {
          closeEditor();
        }

        return true;
      } catch (error: any) {
        setEditorError(error?.message || "Failed to revalidate row");
        return false;
      } finally {
        setEditorSaving(false);
      }
    },
    [closeEditor, resolveIdField, rowOverrides, setRowOverrides, setEditorState, setSkippedRows, setConfirmedRows]
  );

  const saveEditor = async () => {
    if (!editorState) return;
    const { row, values, mode } = editorState;
    if (!values.effective_from || !isValidDate(values.effective_from)) {
      setEditorError("Enter a valid start date (YYYY-MM-DD).");
      return;
    }
    if (values.effective_to) {
      if (!isValidDate(values.effective_to)) {
        setEditorError("End date must be a valid YYYY-MM-DD.");
        return;
      }
      if (values.effective_to < values.effective_from) {
        setEditorError("End date cannot be before the start date.");
        return;
      }
    }

    const basePayload = rowOverrides[row.row_id]?.payload ?? row.payload ?? {};
    const nextPayload = {
      ...(typeof basePayload === "object" && basePayload !== null ? basePayload : {}),
      effective_from: values.effective_from,
      effective_to: values.effective_to ? values.effective_to : null,
    };

    await revalidateRow(
      row,
      nextPayload,
      {
        effective_from: values.effective_from,
        effective_to: values.effective_to ? values.effective_to : null,
      },
      { closeOnSuccess: true, mode }
    );
  };

  const slabErrorMessage = "Tiered commission requires at least one slab";

  const showAddSlabHelper = useMemo(() => {
    if (!editorState) return false;
    const rowId = editorState.row.row_id;
    const override = rowOverrides[rowId];
    const activePayload = (override?.payload ?? editorState.row.payload) as any;
    if (!activePayload || activePayload.commission_type !== "tiered") {
      return false;
    }
    const messages = [override?.message, editorState.row.message, editorError]
      .filter(Boolean)
      .map((msg) => String(msg).toLowerCase());
    return messages.some((msg) => msg.includes(slabErrorMessage.toLowerCase()));
  }, [editorState, rowOverrides, editorError]);

  const handleAddStarterSlab = useCallback(async () => {
    if (!editorState) return;
    const { row, values, mode } = editorState;
    const basePayload = rowOverrides[row.row_id]?.payload ?? row.payload ?? {};
    const workingPayload =
      typeof basePayload === "object" && basePayload !== null ? { ...basePayload } : {};
    workingPayload.commission_type = "tiered";
    workingPayload.slabs = [{ min_price: 0, max_price: null, commission_percent: 0 }];

    const resolvedPlatform = resolveIdField(
      workingPayload.platform_id,
      (row.payload as any)?.platform_id,
      row.platform_id
    );
    const resolvedCategory = resolveIdField(
      workingPayload.category_id,
      (row.payload as any)?.category_id,
      row.category_id
    );

    const effectiveFrom =
      values.effective_from ||
      (typeof workingPayload.effective_from === "string" ? workingPayload.effective_from : "") ||
      (row.payload?.effective_from ?? "");

    if (!effectiveFrom) {
      setEditorError("Set a valid start date before adding a slab.");
      return;
    }

    const effectiveToValue =
      values.effective_to && values.effective_to.length > 0
        ? values.effective_to
        : workingPayload.effective_to ?? row.payload?.effective_to ?? null;

    await revalidateRow(
      row,
      {
        ...workingPayload,
        platform_id: resolvedPlatform,
        category_id: resolvedCategory,
        effective_from: effectiveFrom,
        effective_to: effectiveToValue ?? null,
      },
      {
        effective_from: effectiveFrom,
        effective_to: effectiveToValue ?? null,
      },
      { closeOnSuccess: false, mode }
    );
  }, [editorState, revalidateRow, rowOverrides]);

  const isRowConfirmed = (rowId: string) => Boolean(confirmedRows[rowId]);
  const isRowSkipped = (rowId: string) => Boolean(skippedRows[rowId]);

  const showSimilarWarning = unresolvedSimilarCount > 0;
  const validationInvalidCount = validationSummary?.invalid ?? 0;
  const validationMap = validationResults;
  const downloadIssuesCsv = useCallback(
    (validation: Map<number, string[]>, rows: RowOut[]) => {
      const invalidRows = Array.from(validation.entries()).map(([rowNumber, errors]) => {
        const matchedRow = rows.find((row) => row.row === rowNumber);
        return {
          row: rowNumber,
          marketplace: matchedRow?.platform_id ?? '',
          category: matchedRow?.category_id ?? '',
          errors,
        };
      });

      if (!invalidRows.length) return;

      const csvRows = [
        ['Row', 'Marketplace', 'Category', 'Errors'],
        ...invalidRows.map((item) => [
          item.row,
          item.marketplace,
          item.category,
          item.errors.join('; '),
        ]),
      ];

      const csvContent = csvRows.map((row) => row.map((cell) => {
        const cellString = cell === undefined || cell === null ? '' : String(cell);
        return /[",\n]/.test(cellString)
          ? `"${cellString.replace(/"/g, '""')}"`
          : cellString;
      }).join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rate-card-issues.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    []
  );

  const isRowInvalid = useCallback(
    (rowNumber: number) => {
      const errors = validationResults.get(rowNumber);
      return Array.isArray(errors) && errors.length > 0;
    },
    [validationResults]
  );

  return (
    <div className="space-y-4">
      {importSummary && (
        <div className="space-y-2">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-2 flex items-center justify-between">
            <span>
              ✅ {importSummary.success} rows imported successfully. {importSummary.skipped} skipped.
            </span>
            <button
              onClick={() => setImportSummary(null)}
              className="text-emerald-700 hover:underline text-sm"
            >
              Dismiss
            </button>
          </div>
          {failedRows.length > 0 && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleRetryFailed}
                className="bg-amber-100 border border-amber-300 text-amber-700 rounded-lg px-3 py-1 text-sm hover:bg-amber-200"
                disabled={importing}
              >
                🔁 Retry Failed Imports
              </button>
              <button
                onClick={handleExportFailed}
                className="bg-rose-50 border border-rose-300 text-rose-700 rounded-lg px-3 py-1 text-sm hover:bg-rose-100"
                disabled={importing}
              >
                💾 Export Failed Rows (.csv)
              </button>
            </div>
          )}
        </div>
      )}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 shadow-sm">
        <div className="h-1 rounded-t-2xl bg-teal-500" />
        <div className="space-y-6 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Rate card CSV import</h3>
            <p className="text-base text-slate-500 dark:text-slate-400">
              Upload a CSV/XLSX to validate your rate cards before importing them.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Supported: CSV/XLSX</span>
              <span>•</span>
              <span>Max 5MB</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span>Need the latest template?</span>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 transition hover:border-teal-500 hover:text-teal-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200"
                onClick={openTemplatePicker}
                disabled={downloadingTemplate}
              >
                {downloadingTemplate ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Fetching…
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" /> Download template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div
            className={cn(
              "relative flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-teal-50/40 px-6 py-10 text-center transition",
              dropActive ? "border-teal-500 bg-teal-50" : undefined
            )}
            onDragEnter={handleDragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <UploadCloud className="h-10 w-10 text-teal-600" strokeWidth={1.6} />
            <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
              Drop your rate card file here, or{' '}
              <button
                type="button"
                className="font-semibold text-teal-600 hover:underline"
                onClick={() => fileInputRef.current?.click()}
                disabled={validationLoading}
              >
                browse
              </button>
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Only CSV/XLSX under 5MB.</p>
            {validationLoading && (
              <div className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin" /> Validating…
              </div>
            )}
            {validationError && (
              <p className="mt-3 text-sm font-medium text-rose-600">{validationError}</p>
            )}
            {lastUploadMeta && (
              <div className="mt-3 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                Last uploaded: {lastUploadMeta.filename}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".csv,.xlsx"
              onChange={handleFileInputChange}
              disabled={validationLoading}
            />
          </div>

          <div className="flex w-full flex-col gap-3 lg:max-w-xs">
            <Button
              onClick={handleOpenConfirm}
              disabled={!hasEligibleRows || guardrailsBlocking || importing || uploading}
              className="h-11 w-full gap-2 rounded-xl bg-teal-600 text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Importing…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Review &amp; import
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={handleReset}
              disabled={uploading || importing || !parseResult}
              className="h-11 w-full rounded-xl border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500"
            >
              Clear upload
            </Button>
            {validationInvalidCount > 0 && (
              <button
                type="button"
                onClick={() => downloadIssuesCsv(validationResults, mergedRows)}
                className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
              >
                Download validation issues
              </button>
            )}
          </div>
        </div>

        {importing && (
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="bg-teal-600 h-2 rounded-full transition-all duration-300 animate-pulse"
              style={{ width: `${Math.max(5, importProgress)}%` }}
            ></div>
          </div>
        )}
        {uploading && (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" /> Analyzing file…
          </div>
        )}
        {parseError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/30 dark:text-red-200">
            {parseError}
          </div>
        )}

        {parseResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {SUMMARY_TILES.map((tile) => (
                <div key={tile.key} className={cn("rounded-lg px-3 py-2 text-sm", toneClasses[tile.tone])}>
                  <p className="text-xs uppercase tracking-wide">{tile.label}</p>
                  <p className="text-lg font-semibold">
                    {tile.key === "total" ? summaryValues.total : summaryValues[tile.key]}
                  </p>
                </div>
              ))}
            </div>

            {showSimilarWarning && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <span>
                  {unresolvedSimilarCount} similar row{unresolvedSimilarCount === 1 ? "" : "s"} require confirmation before importing.
                </span>
              </div>
        )}

            {validationSummary && (
              <div className="flex items-center gap-3 text-sm font-medium">
                <span className="text-emerald-700 dark:text-emerald-500">
                  ✅ {validationSummary.valid} valid row{validationSummary.valid === 1 ? '' : 's'}
                </span>
                <span className="text-rose-700 dark:text-rose-400">
                  ⚠️ {validationInvalidCount} invalid row{validationInvalidCount === 1 ? '' : 's'}
                </span>
              </div>
            )}

        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-900/60 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Row validation</p>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-2 text-left">Row</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Marketplace</th>
                      <th className="px-4 py-2 text-left">Category</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Date range</th>
                      <th className="px-4 py-2 text-left">Notes</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mergedRows.map((row) => {
                      const style = STATUS_STYLES[row.status];
                      const confirmed = isRowConfirmed(row.row_id);
                      const skipped = isRowSkipped(row.row_id);
                      const validationErrors = validationMap.get(row.row);
                      const hasValidationErrors = Boolean(validationErrors && validationErrors.length);
                      const isHighlighted = invalidHighlightRows.has(row.row);
                      return (
                        <tr
                          key={row.row_id}
                          id={`rate-row-${row.row}`}
                          className={cn(
                            "border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-colors",
                            hasValidationErrors && "bg-red-50 dark:bg-rose-950/30 border-l-4 border-red-400",
                            isHighlighted && "animate-pulse",
                            skipped && "opacity-60"
                          )}
                        >
                          <td className="px-4 py-2">{row.row}</td>
                          <td className="px-4 py-2">
                            <Badge
                              className={cn("inline-flex items-center gap-1.5 px-3 py-1", style.className)}
                              title={row.status === "error" && row.tooltip ? row.tooltip : undefined}
                            >
                              {style.icon}
                              {style.label}
                            </Badge>
                            {hasValidationErrors && validationErrors && (
                              <span className="relative ml-2 inline-flex group">
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[11px] font-bold text-white">
                                  !
                                </span>
                                <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 w-56 -translate-x-1/2 scale-95 opacity-0 transition-all group-hover:scale-100 group-hover:opacity-100">
                                  <span className="block rounded-md bg-rose-700 px-3 py-2 text-xs leading-snug text-white shadow-lg">
                                    {validationErrors.join('; ')}
                                  </span>
                                </span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 capitalize">{row.platform_id || "-"}</td>
                          <td className="px-4 py-2 capitalize">{row.category_id || "-"}</td>
                          <td className="px-4 py-2 capitalize">{row.commission_type || "-"}</td>
                          <td className="px-4 py-2">
                            {row.effective_from
                              ? `${row.effective_from} → ${row.effective_to ?? "open"}`
                              : "-"}
                          </td>
                          <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-2">
                              <span>{row.message}</span>
                              {row.tooltip ? (
                                <span className="inline-flex" title={row.tooltip}>
                                  <Info className="h-3.5 w-3.5 text-slate-400" />
                                </span>
                              ) : null}
                            </span>
                            {hasValidationErrors && (
                              <ul className="mt-1 space-y-0.5 text-rose-600 dark:text-rose-400">
                                {validationErrors!.map((err, idx) => (
                                  <li key={`${row.row}-validation-${idx}`}>• {err}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-2 text-xs">
                              {row.status === "similar" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant={confirmed ? "secondary" : "default"}
                                    onClick={() => confirmRow(row)}
                                    disabled={skipped}
                                  >
                                    {confirmed ? "Confirmed" : "Confirm"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEditor(row, "adjust")}
                                    disabled={skipped}
                                  >
                                    Adjust dates…
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={skipped ? "secondary" : "ghost"}
                                    onClick={() => toggleSkipRow(row)}
                                  >
                                    {skipped ? "Unskip" : "Skip"}
                                  </Button>
                                </>
                              )}
                              {row.status === "duplicate" && (
                                <span className="text-slate-400 text-xs">Auto-skipped</span>
                              )}
                              {row.status === "error" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEditor(row, "fix")}
                                  >
                                    Fix…
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={skipped ? "secondary" : "ghost"}
                                    onClick={() => toggleSkipRow(row)}
                                  >
                                    {skipped ? "Unskip" : "Skip"}
                                  </Button>
                                </>
                              )}
                              {row.status === "valid" && <span className="text-slate-400">—</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {importError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/30 dark:text-red-200">
                {importError}
              </div>
            )}

            {importResult && (
              <div
                className={cn(
                  "rounded-lg px-4 py-3 text-sm",
                  importResult.summary.inserted > 0
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200"
                    : "border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
                )}
              >
                <p>
                  Imported {importResult.summary.inserted} row
                  {importResult.summary.inserted === 1 ? "" : "s"}.{" "}
                  {importResult.summary.skipped > 0
                    ? `${importResult.summary.skipped} skipped.`
                    : "All selected rows were imported."}
                </p>
                {importResult.summary.skipped > 0 && (
                  <ul className="mt-2 space-y-1 text-xs list-disc list-inside">
                    {importResult.results
                      .filter((row) => row.status === "skipped" && row.message)
                      .map((row, idx) => (
                        <li key={`${row.row_id ?? row.row ?? idx}`}>
                          Row {row.row ?? row.row_id}: {row.message}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {hasEligibleRows
                  ? `${eligibleValidRows.length} valid row${eligibleValidRows.length === 1 ? "" : "s"} ready to import.`
                  : "No valid rows detected yet."}
                {unresolvedSimilarCount > 0 && (
                  <> {" "}Similar rows pending confirmation: {unresolvedSimilarCount}.</>
                )}
                {unresolvedErrorCount > 0 && (
                  <> {" "}Error rows remaining: {unresolvedErrorCount}.</>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={downloadIssues}
                  disabled={
                    mergedRows.filter(
                      (row) =>
                        row.status === "error" ||
                        row.status === "duplicate" ||
                        row.status === "similar"
                    ).length === 0
                  }
                  className="gap-2"
                >
                  <Download className="h-4 w-4" /> Download issues (.csv)
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

      {lastUploadMeta && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Last uploaded: <span className="font-medium">{lastUploadMeta.filename}</span> at{" "}
          {new Date(lastUploadMeta.uploadedAt).toLocaleString()}
        </p>
      )}

      <ImportConfirmModal
        open={confirmOpen}
        onCancel={handleCancelConfirm}
        onImportValid={handleImportValid}
        onImportValidAndSimilar={handleImportValidAndSimilar}
        validCount={eligibleValidRows.length}
        similarCount={eligibleSimilarRows.length}
        importing={importing}
        pendingChoice={pendingChoice}
      />

      {editorState && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow p-4 space-y-3">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {editorState.mode === "adjust" ? "Adjust dates" : "Fix row"}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-slate-500 dark:text-slate-400">
              Effective from
              <input
                type="date"
                value={editorState.values.effective_from}
                onChange={(event) =>
                  setEditorState((prev) =>
                    prev
                      ? {
                          ...prev,
                          values: { ...prev.values, effective_from: event.target.value },
                        }
                      : prev
                  )
                }
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-slate-500 dark:text-slate-400">
              Effective to
              <input
                type="date"
                value={editorState.values.effective_to}
                onChange={(event) =>
                  setEditorState((prev) =>
                    prev
                      ? {
                          ...prev,
                          values: { ...prev.values, effective_to: event.target.value },
                        }
                      : prev
                  )
                }
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          {editorError && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {editorError}
            </div>
          )}
          {showAddSlabHelper && (
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
              <span>{slabErrorMessage}.</span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddStarterSlab}
                disabled={editorSaving}
              >
                Add starter slab
              </Button>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeEditor}>
              Cancel
            </Button>
            <Button onClick={saveEditor} disabled={editorSaving}>
              {editorSaving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </span>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </div>
      )}

      {previewState && (
        <PreviewModal
          open={previewOpen}
          onClose={handlePreviewClose}
          onConfirm={handleConfirmPreview}
          confirming={confirmingImport}
          confirmDisabled={Boolean(previewState.info.missing_mandatory?.length)}
          templateType={previewState.info.template_type ?? 'flat'}
          version={previewState.info.version ?? ''}
          fileName={previewState.fileName}
          mappedCount={previewState.info.mapped?.length ?? 0}
          missingMandatory={previewState.info.missing_mandatory ?? []}
          unmapped={previewState.info.unmapped ?? []}
          headers={previewState.headers}
          rowPreview={previewState.rowPreview}
        />
      )}

      {templatePickerMounted && (
        <TemplatePickerModal
          templates={templatesList}
          templatesLoading={templatesLoading}
          templateType={templateType}
          setTemplateType={setTemplateType}
          lastUsedType={lastUsedType}
          onClose={() => setShowTemplatePicker(false)}
          onAfterClose={() => setTemplatePickerMounted(false)}
          onDownload={downloadTemplate}
          onViewGuide={handleViewColumnGuide}
          downloading={downloadingTemplate}
          open={showTemplatePicker}
          missingHeaders={missingHeaderHint}
        />
      )}

      <ColumnGuideModal
        template={columnGuideTemplate}
        open={columnGuideOpen}
        onClose={handleCloseColumnGuide}
      />

      {templateToast && (
        <div
          className="fixed bottom-6 right-6 z-50 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg transition-opacity dark:bg-slate-200 dark:text-slate-900"
          role="status"
        >
          {templateToast}
        </div>
      )}

    </div>
  );
};

export default UploadWidget;
