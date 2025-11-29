// client/src/pages/RateCardV2Page.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Info, ChevronLeft, ChevronRight, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { invokeSupabaseFunction } from "@/utils/supabaseFunctions";

import { RateCardHeader } from "@/components/RateCardHeader";
import Modal from "@/components/ui/Modal";
import RateCardFormV2 from "@/components/RateCardFormV2Compact";
import UploadWidget from "@/pages/RateCards/UploadWidget";
import ReconciliationCalculator from "@/components/ReconciliationCalculator";
import RateCardStatusIndicator from "@/components/RateCardStatusIndicator";
import ImportHistoryTable, { RateCardImportSummary } from "./RateCards/components/ImportHistoryTable";
import ConflictModal, { PublishPromptState } from "./RateCards/components/ConflictModal";
import RateCardGapAlerts, { GapRecord } from "./RateCards/components/RateCardGapAlerts";
import PublishSummaryModal, { PublishSummaryData } from "./RateCards/components/PublishSummaryModal";
import PublishSummaryCard, { PublishDigestData } from "./RateCards/components/PublishSummaryCard";

const PUBLISH_DIGEST_STORAGE_KEY = "re_last_publish_digest";

const PLATFORM_LABELS: Record<string, string> = {
  amazon: "Amazon",
  flipkart: "Flipkart",
  myntra: "Myntra",
  ajio: "AJIO",
  quick: "Quick Commerce",
};

const CATEGORY_LABELS: Record<string, string> = {
  apparel: "Apparel",
  electronics: "Electronics",
  beauty: "Beauty",
  home: "Home",
};

const ROWS_PER_PAGE_OPTIONS = [10, 30, 50, 100, 200] as const;

const restoreDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

interface RateCardFee {
  id: string;
  rate_card_id: string;
  fee_code: string;
  fee_type: "percent" | "amount";
  fee_value: number | null;
}

interface RateCardSlab {
  id: string;
  rate_card_id: string;
  min_price: number | null;
  max_price: number | null;
  commission_percent: number | null;
}

interface RateCard {
  id: string;
  platform_id: string;
  category_id: string;
  platform_name?: string;
  category_name?: string;
  commission_type: "flat" | "tiered";
  commission_percent: number | null;
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
  status?: string;
  fees?: RateCardFee[];
  slabs?: RateCardSlab[];
  archived?: boolean;
}

export default function RateCardV2Page() {
  const navigate = useNavigate();
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [filteredCards, setFilteredCards] = useState<RateCard[]>([]);
  const [metrics, setMetrics] = useState<any>({ 
    total: 0, 
    active: 0, 
    expired: 0, 
    upcoming: 0, 
    archived: 0,
    avg_flat_commission: 0, 
    flat_count: 0 
  });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<RateCard | null>(null);
  const [showCalc, setShowCalc] = useState(false);
  const [calcPreset, setCalcPreset] = useState<{platform?: string; category?: string; cardId?: string}>({});
  const [updatingMap, setUpdatingMap] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [activeSection, setActiveSection] = useState<"upload" | "history">("upload");
  const [recentImports, setRecentImports] = useState<RateCardImportSummary[]>([]);
  const [importsLoading, setImportsLoading] = useState(false);
  const [publishingUploadId, setPublishingUploadId] = useState<string | null>(null);
  const [publishPrompt, setPublishPrompt] = useState<PublishPromptState | null>(null);
  const [publishSummaryModal, setPublishSummaryModal] = useState<PublishSummaryData | null>(null);
  const [publishDigest, setPublishDigest] = useState<PublishDigestData | null>(null);
  const [gapRefreshKey, setGapRefreshKey] = useState(0);
  const [gapOpenSignal, setGapOpenSignal] = useState(0);
  const [gapData, setGapData] = useState<GapRecord[]>([]);
  const [gapLoading, setGapLoading] = useState(false);
  const [aiSummary] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(ROWS_PER_PAGE_OPTIONS[0]);
  const [restoreCandidate, setRestoreCandidate] = useState<RateCardImportSummary | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const handleGoToUpload = useCallback(() => {
    setActiveSection("upload");
  }, []);
  const handleViewRateCards = useCallback(() => {
    setPublishSummaryModal(null);
    const tableElement = document.getElementById("rate-card-table");
    if (tableElement) {
      tableElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);
  const searchDebounceRef = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => () => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
  }, []);

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / rowsPerPage) || 1);
  const paginatedCards = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredCards.slice(start, start + rowsPerPage);
  }, [filteredCards, page, rowsPerPage]);
  const pageStart = filteredCards.length === 0 ? 0 : page * rowsPerPage + 1;
  const pageEnd = Math.min(filteredCards.length, (page + 1) * rowsPerPage);
  const canPreviousPage = page > 0;
  const canNextPage = page < totalPages - 1;

  const handleRowsPerPageChange = useCallback(
    (value: number) => {
      setRowsPerPage(value);
      setPage(0);
    },
    [setRowsPerPage, setPage]
  );

  const handleConfirmRestore = async () => {
    if (!restoreCandidate) return;
    try {
      setRestoringId(restoreCandidate.id);
      await invokeSupabaseFunction<{ restored_count?: number }>("restore_rate_card_data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id: restoreCandidate.id }),
      });
      showToast("Previous rate cards restored");
      setRestoreCandidate(null);
      await fetchCards();
      await fetchRecentImports();
    } catch (error: any) {
      const message = error?.message || "Failed to restore rate cards";
      console.error("restore failed", error);
      showToast(message);
    } finally {
      setRestoringId(null);
    }
  };

  const restoreExpiryDate =
    restoreCandidate?.restore_expires_at && !Number.isNaN(Date.parse(restoreCandidate.restore_expires_at))
      ? new Date(restoreCandidate.restore_expires_at)
      : null;
  const restoreExpiryLabel = restoreExpiryDate ? restoreDateFormatter.format(restoreExpiryDate) : null;

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredCards.length / rowsPerPage) - 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [filteredCards.length, rowsPerPage, page, setPage]);

  const defaultMetrics = (list: RateCard[]) => ({ total: list.length, active: 0, expired: 0, upcoming: 0, archived: 0, avg_flat_commission: 0, flat_count: 0 });
  const computeMetrics = (list: RateCard[]) => {
    const total = list.length;
    const flat = list.filter((r: any) => r.commission_type === 'flat' && typeof r.commission_percent === 'number');
    const flat_count = flat.length;
    const avg_flat_commission = flat_count ? Math.round((flat.reduce((s, r) => s + (r.commission_percent || 0), 0) / flat_count) * 100) / 100 : 0;
    // naive status based on dates
    const today = new Date().toISOString().slice(0, 10);
    let active = 0, expired = 0, upcoming = 0;
    list.forEach((r: any) => {
      const from = r.effective_from || today;
      const to = r.effective_to || '9999-12-31';
      if (today < from) upcoming++; else if (today > to) expired++; else active++;
    });
    return { total, active, expired, upcoming, avg_flat_commission, flat_count };
  };

  const readStoredDigest = useCallback((): PublishDigestData | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(PUBLISH_DIGEST_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed as PublishDigestData;
      }
    } catch (error) {
      console.warn("Failed to read publish digest from storage", error);
    }
    return null;
  }, []);

  const persistDigest = useCallback((digest: PublishDigestData | null) => {
    if (typeof window === "undefined") return;
    try {
      if (!digest) {
        window.localStorage.removeItem(PUBLISH_DIGEST_STORAGE_KEY);
      } else {
        window.localStorage.setItem(PUBLISH_DIGEST_STORAGE_KEY, JSON.stringify(digest));
      }
    } catch (error) {
      console.warn("Failed to persist publish digest", error);
    }
  }, []);

  const updatePublishDigest = useCallback(
    (records: RateCardImportSummary[], fallback?: PublishDigestData) => {
      const publishedRecord = records.find((record) => {
        const status = (record.status ?? record.validation_status ?? "").toLowerCase();
        return status === "published";
      });
      if (!publishedRecord) {
        const stored = readStoredDigest();
        if (stored) {
          setPublishDigest(stored);
        } else {
          setPublishDigest(null);
        }
        return;
      }

      const stored = readStoredDigest();
      const base =
        (fallback && fallback.id === publishedRecord.id && fallback) ||
        (stored && stored.id === publishedRecord.id ? stored : null);

      const digest: PublishDigestData = {
        id: publishedRecord.id,
        uploadedAt: publishedRecord.uploaded_at ?? base?.uploadedAt ?? undefined,
        templateType: publishedRecord.template_type ?? base?.templateType ?? undefined,
        templateVersion: publishedRecord.version ?? base?.templateVersion ?? undefined,
        publishedCount:
          base?.publishedCount ??
          publishedRecord.record_count ??
          publishedRecord.rows ??
          0,
        replacedCount: base?.replacedCount ?? 0,
        skippedCount: base?.skippedCount ?? 0,
        marketplaces: base?.marketplaces ?? [],
        categories: base?.categories ?? [],
        details: base?.details ?? undefined,
      };
      setPublishDigest(digest);
      persistDigest(digest);
    },
    [persistDigest, readStoredDigest]
  );

  const fetchCards = async () => {
    setLoading(true);
    try {
      const payload = await invokeSupabaseFunction<{ data?: RateCard[]; metrics?: any }>("rate-cards-v2");
      console.debug("[rate-cards-v2] payload", payload);
      const list: RateCard[] = Array.isArray(payload?.data) ? payload.data : [];
      const m = payload?.metrics && typeof payload.metrics === "object" ? payload.metrics : defaultMetrics(list);
      const normalised = list.map((card) => ({
        ...card,
        archived: Boolean((card as any).archived ?? false),
      }));
      setRateCards(normalised);
      const initialView = normalised.filter((card) => (showArchivedOnly ? card.archived : !card.archived));
      setFilteredCards(initialView);
      setPage(0);
      setMetrics({ ...defaultMetrics(normalised), ...(m ?? {}) });
    } catch (err) {
      console.error("Failed to fetch rate cards", err);
      setRateCards([]);
      setFilteredCards([]);
      setPage(0);
      setMetrics(defaultMetrics([]));
      showToast((err as any)?.message || "Failed to fetch rate cards");
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentImports = useCallback(async (digestFallback?: PublishDigestData) => {
    setImportsLoading(true);
    try {
      const payload = await invokeSupabaseFunction<{ status?: string; imports?: RateCardImportSummary[] }>(
        "get_rate_card_imports"
      );
      const items = Array.isArray(payload?.imports)
        ? payload.imports.map((record) => ({
            ...record,
            rows: typeof record.rows === "number" ? record.rows : Number(record.rows ?? 0) || 0,
          }))
        : [];
      setRecentImports(items);
      updatePublishDigest(items, digestFallback);
      return items;
    } catch (error) {
      console.error("Failed to fetch rate card imports", error);
      showToast((error as any)?.message || "Failed to load import history");
      return [];
    } finally {
      setImportsLoading(false);
    }
  }, [showToast, updatePublishDigest]);

  const handleImportComplete = useCallback(() => {
    fetchRecentImports();
    setActiveSection("history");
  }, [fetchRecentImports]);

  const publishUpload = useCallback(
    async (
      record: RateCardImportSummary,
      options?: {
        action?: "replace_existing" | "trim_existing" | "publish" | "detect";
        selectedIds?: string[];
        changeReason?: string;
        totalConflicts?: number;
      }
    ) => {
      if (!record?.id || publishingUploadId) return;
      setPublishingUploadId(record.id);
      try {
        const action = options?.action ?? "detect";
        const payload: Record<string, unknown> = { upload_id: record.id, activate: true, action };
        if (options?.selectedIds && options.selectedIds.length > 0) {
          payload.selected_ids = options.selectedIds;
        }
        if (options?.changeReason !== undefined) {
          payload.change_reason = options.changeReason;
        }
        if (action === "replace_existing") {
          console.info("Publishing changes", {
            upload_id: record.id,
            selected_replacements: options?.selectedIds ?? [],
            change_reason: options?.changeReason ?? "",
            timestamp: new Date().toISOString(),
          });
        }
        const response = await invokeSupabaseFunction<{
          status?: string;
          message?: string;
          published_count?: number;
          conflicts?: PublishConflictItem[];
          template_type?: string;
          template_version?: string;
          cross_marketplace_enabled?: boolean;
          ready_to_publish?: boolean;
          row_count?: number;
          replaced_count?: number;
          skipped_count?: number;
          marketplaces?: string[];
          categories?: string[];
          effective_from?: string | null;
          effective_to?: string | null;
          rows?: Array<Record<string, unknown>>;
        }>("publish_rate_card_data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response?.status === "conflict" && response.conflicts) {
          setPublishSummaryModal(null);
          setPublishPrompt({
            mode: "conflict",
            record,
            message: response.message,
            conflicts: response.conflicts,
            template_type: response.template_type ?? record.template_type ?? "",
            template_version: response.template_version ?? record.version ?? "",
            cross_marketplace_enabled: response.cross_marketplace_enabled,
          });
          showToast(response.message || "Conflicts detected. Review before publishing.");
        } else if (response?.status === "success" && response.ready_to_publish) {
          setPublishSummaryModal(null);
          setPublishPrompt({
            mode: "confirm",
            record,
            message: response.message,
            row_count: response.row_count ?? record.record_count ?? record.rows,
            template_type: response.template_type ?? record.template_type ?? "",
            template_version: response.template_version ?? record.version ?? "",
          });
        } else if (response?.status === "success" && (response.published_count ?? 0) > 0) {
          setPublishPrompt(null);
          const replacedCountFromAction =
            options?.action === "replace_existing" ? options?.selectedIds?.length ?? 0 : undefined;
          const replacedCount =
            typeof response?.replaced_count === "number"
              ? response.replaced_count
              : replacedCountFromAction ?? 0;
          const skippedCount =
            typeof response?.skipped_count === "number"
              ? response.skipped_count
              : Math.max(0, (options?.totalConflicts ?? 0) - replacedCount);
          const publishDetails = Array.isArray(response?.rows)
            ? response.rows.map((rawRow, index) => {
                const row = rawRow as Record<string, unknown>;
                const getString = (key: string) => {
                  const value = row[key];
                  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
                };
                const getNumber = (key: string) => {
                  const value = row[key];
                  return typeof value === "number" ? value : null;
                };
                return {
                  marketplace:
                    getString("marketplace") ??
                    getString("platform") ??
                    getString("platform_name") ??
                    getString("platform_id") ??
                    null,
                  category:
                    getString("category") ??
                    getString("category_name") ??
                    getString("category_id") ??
                    null,
                  effective_from: getString("effective_from") ?? null,
                  effective_to: getString("effective_to") ?? null,
                  commission_percent: getNumber("commission_percent") ?? getNumber("commission"),
                  status: getString("status") ?? (index < replacedCount ? "replaced" : "new"),
                };
              })
            : undefined;
          const inferUnique = (values?: (string | null | undefined)[]) => {
            if (!values) return undefined;
            const unique = Array.from(new Set(values.filter((item): item is string => Boolean(item && item.trim()))));
            return unique.length ? unique : undefined;
          };

          const digestPayload: PublishDigestData = {
            id: record.id,
            uploadedAt: record.uploaded_at ?? undefined,
            templateType: response?.template_type ?? record.template_type ?? undefined,
            templateVersion: response?.template_version ?? record.version ?? undefined,
            publishedCount: response?.published_count ?? 0,
            replacedCount,
            skippedCount,
            marketplaces: Array.isArray(response?.marketplaces)
              ? response.marketplaces
              : inferUnique(publishDetails?.map((detail) => detail.marketplace)),
            categories: Array.isArray(response?.categories)
              ? response.categories
              : inferUnique(publishDetails?.map((detail) => detail.category)),
            details: publishDetails,
          };
          setPublishDigest(digestPayload);
          persistDigest(digestPayload);
          await fetchCards();
          await fetchRecentImports(digestPayload);
          setGapRefreshKey((value) => value + 1);
          setPublishSummaryModal({
            publishedCount: response?.published_count ?? 0,
            replacedCount,
            skippedCount,
            templateType: response?.template_type ?? record.template_type ?? null,
            templateVersion: response?.template_version ?? record.version ?? null,
            marketplaces: Array.isArray(response?.marketplaces) ? response.marketplaces : undefined,
            categories: Array.isArray(response?.categories) ? response.categories : undefined,
            effectiveFrom: response?.effective_from ?? null,
            effectiveTo: response?.effective_to ?? null,
            uploadedBy: record.uploaded_by ?? undefined,
            details: publishDetails,
          });
        } else if (response?.status === "success") {
          showToast(response?.message ?? "Publish request processed.");
        } else {
          showToast(response?.message ? `Publish failed – ${response.message}` : "Publish failed.");
          setPublishSummaryModal(null);
        }
      } catch (error) {
        console.error("publish_rate_card_data error", error);
        showToast((error as Error)?.message || "Publish failed");
        setPublishSummaryModal(null);
      } finally {
        setPublishingUploadId(null);
      }
    },
    [fetchCards, fetchRecentImports, persistDigest, publishingUploadId, showToast]
  );

  const resolveStatus = useCallback((card: RateCard): "active" | "expired" | "upcoming" => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = card.effective_from ? new Date(card.effective_from) : today;
    from.setHours(0, 0, 0, 0);
    const to = card.effective_to ? new Date(card.effective_to) : null;
    if (from.getTime() > today.getTime()) {
      return "upcoming";
    }
    if (to) {
      to.setHours(0, 0, 0, 0);
      if (today.getTime() > to.getTime()) {
        return "expired";
      }
    }
    return "active";
  }, []);

  useEffect(() => {
    const stored = readStoredDigest();
    if (stored) {
      setPublishDigest(stored);
    }
  }, [readStoredDigest]);

  useEffect(() => {
    fetchCards();
  }, []);

  useEffect(() => {
    fetchRecentImports();
  }, [fetchRecentImports]);

useEffect(() => {
  const query = searchValue.trim().toLowerCase();
  const base = rateCards.filter((card) => (showArchivedOnly ? card.archived : !card.archived));

  if (!query) {
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    setFilteredCards(base);
    setPage(0);
    return;
  }

  if (searchDebounceRef.current) {
    window.clearTimeout(searchDebounceRef.current);
  }

  searchDebounceRef.current = window.setTimeout(() => {
    const results = base.filter((card) => {
      const platform = (card.platform_name || card.platform_id || "").toLowerCase();
      const category = (card.category_name || card.category_id || "").toLowerCase();
      const commissionLabel = card.commission_type === "flat"
        ? `flat (${card.commission_percent ?? ""}%)`
        : "tiered";
      const statusLabel = card.archived ? "archived" : resolveStatus(card);
      return (
        platform.includes(query) ||
        category.includes(query) ||
        commissionLabel.toLowerCase().includes(query) ||
        statusLabel.toLowerCase().includes(query)
      );
    });
    setFilteredCards(results);
    setPage(0);
    searchDebounceRef.current = null;
  }, 300);

  return () => {
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
  };
}, [searchValue, rateCards, resolveStatus, showArchivedOnly]);

  const setUpdatingState = useCallback((id: string, value: boolean) => {
    setUpdatingMap((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleArchiveToggle = useCallback(
    async (card: RateCard, archived: boolean) => {
      setUpdatingState(card.id, true);
      const previousCards = rateCards;
      try {
        const optimisticList = rateCards.map((item) =>
          item.id === card.id ? { ...item, archived } : item
        );
        setRateCards(optimisticList);

        const query = searchValue.trim().toLowerCase();
        const base = optimisticList.filter((rc) => (showArchivedOnly ? rc.archived : !rc.archived));
        if (!query) {
          setFilteredCards(base);
        } else {
          const filtered = base.filter((rc) => {
            const platform = (rc.platform_name || rc.platform_id || "").toLowerCase();
            const category = (rc.category_name || rc.category_id || "").toLowerCase();
            const commissionLabel = rc.commission_type === "flat"
              ? `flat (${rc.commission_percent ?? ""}%)`
              : "tiered";
            const statusLabel = rc.archived ? "archived" : resolveStatus(rc);
            return (
              platform.includes(query) ||
              category.includes(query) ||
              commissionLabel.toLowerCase().includes(query) ||
              statusLabel.toLowerCase().includes(query)
            );
          });
          setFilteredCards(filtered);
        }

        const optimisticMetrics = (() => {
          const total = optimisticList.length;
          const archivedCount = optimisticList.filter((rc) => rc.archived).length;
          const active = optimisticList.filter((rc) => !rc.archived && resolveStatus(rc) === "active").length;
          const expired = optimisticList.filter((rc) => !rc.archived && resolveStatus(rc) === "expired").length;
          const upcoming = optimisticList.filter((rc) => !rc.archived && resolveStatus(rc) === "upcoming").length;
          const flatCards = optimisticList.filter((rc) => rc.commission_type === "flat" && typeof rc.commission_percent === "number");
          const flatSum = flatCards.reduce((sum, rc) => sum + (rc.commission_percent ?? 0), 0);
          const flatCount = flatCards.length;
          const avgFlat = flatCount ? Number((flatSum / flatCount).toFixed(2)) : 0;
          return {
            total,
            active,
            expired,
            upcoming,
            archived: archivedCount,
            avg_flat_commission: avgFlat,
            flat_count: flatCount,
          };
        })();
        setMetrics(optimisticMetrics);

        await invokeSupabaseFunction<{ id?: string }>(
          `rate-cards-v2/${card.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archived }),
          }
        );

        await fetchCards();
        showToast("Updated 1 card(s)");
      } catch (error: any) {
        console.error("Failed to update archive state", error);
        const message = error?.message || "Failed to update card";
        showToast(!archived && error?.status === 400 ? message || "Restore failed" : message);
        setRateCards(previousCards);
        await fetchCards();
      } finally {
        setUpdatingState(card.id, false);
      }
    },
    [
      fetchCards,
      setUpdatingState,
      showToast,
      rateCards,
      resolveStatus,
      searchValue,
      showArchivedOnly,
    ]
  );

  const handleSaved = () => {
    setShowForm(false);
    setEditingCard(null);
    fetchCards();
  };

  const tileToneClasses: Record<string, string> = {
    primary:
      "border-emerald-200 bg-emerald-50/40 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/15 dark:text-emerald-200",
    success:
      "border-emerald-200 bg-emerald-50/40 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/15 dark:text-emerald-200",
    neutral:
      "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200",
    info:
      "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-900/20 dark:text-sky-200",
    danger:
      "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-200",
  };

  const metricTiles = useMemo(
    () => [
      { key: "total", label: "Total Rate Cards", value: metrics.total ?? 0, tone: "primary" },
      { key: "active", label: "Active", value: metrics.active ?? 0, tone: "success" },
      { key: "expired", label: "Expired", value: metrics.expired ?? 0, tone: "danger" },
      { key: "upcoming", label: "Upcoming", value: metrics.upcoming ?? 0, tone: "info" },
      { key: "archived", label: "Archived", value: metrics.archived ?? 0, tone: "neutral" },
      {
        key: "avg",
        label: "Avg Commission % (Flat)",
        value: metrics.avg_flat_commission ?? 0,
        displayValue: (() => {
          const num = Number(metrics.avg_flat_commission ?? 0);
          return Number.isFinite(num) ? (Number.isInteger(num) ? num.toString() : num.toFixed(2)) : "0";
        })(),
        tone: "primary",
        subLabel: `(${metrics.flat_count ?? 0})`,
      },
    ],
    [metrics]
  );

  return (
    <>
      <div className="space-y-6">
      {/* Header */}
      <RateCardHeader title="Rate Cards" />

      {/* Summary metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metricTiles.map((tile) => (
          <div
            key={tile.key}
            className={`rounded-xl border px-4 py-3 text-center shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow ${tileToneClasses[tile.tone]}`}
          >
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{tile.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
              {tile.key === "avg" ? `${tile.displayValue}` : tile.value}
              {tile.key === "avg" && (
                <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">{tile.subLabel}</span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Actions */}
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6 mb-3">
        <button
          onClick={() => navigate("/rate-cards/add")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-sm hover:shadow transition"
        >
          <Plus className="w-4 h-4" />
          Add New Rate Card
        </button>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-center lg:flex-1 lg:justify-center xl:justify-end">
          <div className="relative w-full sm:w-96 lg:max-w-xs">
            <input
              type="text"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search marketplace, category, commission, status…"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 pr-8 text-sm text-slate-700 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => setSearchValue("")}
                className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowArchivedOnly((prev) => !prev)}
            aria-pressed={showArchivedOnly}
            className={`ml-0 sm:ml-3 inline-flex items-center justify-center h-9 px-3 rounded-xl text-sm font-medium transition ${
              showArchivedOnly
                ? 'bg-teal-600 text-white hover:bg-teal-700'
                : 'border border-slate-200 bg-slate-100 text-slate-600 hover:border-slate-300 hover:bg-slate-200'
            }`}
          >
            {showArchivedOnly ? 'Show all' : 'Show only archived'}
          </button>
        </div>
      </div>



      {/* Rate Card List */}
      <div
        id="rate-card-table"
        className="bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden border border-slate-200 dark:border-slate-700"
      >
        {showArchivedOnly && (
          <div className="flex items-start gap-2 border-b border-sky-200 bg-sky-50 text-sky-800 px-4 py-2">
            <Info className="h-4 w-4 mt-0.5" />
            <span className="text-sm">
              Archived cards are stored for history and won’t be used for reconciliation.
            </span>
          </div>
        )}
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700">
            <tr>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-white">Platform</th>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-white">Category</th>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-white">Commission</th>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-white">Status</th>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-white">Valid From</th>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-white">Valid To</th>
              <th className="px-4 py-2 text-slate-700 dark:text-white"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-4 text-center">Loading…</td></tr>
            ) : filteredCards.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8">
                  <div className="text-center space-y-3">
                    <p className="text-slate-600 dark:text-slate-300">
                      {rateCards.length === 0
                        ? "No rate cards yet. Add your first one."
                        : "No rate cards match your search."}
                    </p>
                    {rateCards.length === 0 && (
                      <button
                        onClick={() => navigate("/rate-cards/add")}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-sm hover:shadow"
                      >
                        <Plus className="w-4 h-4" />
                        Add New Rate Card
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedCards.map(card => {
                const isArchived = Boolean(card.archived);
                const isUpdating = updatingMap[card.id];
                const displayStatus = resolveStatus(card);
                return (
                <tr key={card.id} className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-slate-50 hover:dark:bg-slate-800">
                  <td className="px-4 py-2">{card.platform_name || card.platform_id || "-"}</td>
                  <td className="px-4 py-2">{card.category_name || card.category_id || "-"}</td>
                  <td className="px-4 py-2">{card.commission_type === "flat" ? `${card.commission_percent ?? 0}%` : "Tiered"}</td>
                  <td className="px-4 py-2">
                    {isArchived ? (
                      <span className="inline-flex items-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 text-xs font-medium">
                        Archived
                      </span>
                    ) : (
                      <RateCardStatusIndicator
                        status={displayStatus}
                        animate={false}
                        size="sm"
                      />
                    )}
                  </td>
                  <td className="px-4 py-2">{card.effective_from}</td>
                  <td className="px-4 py-2">{card.effective_to || "-"}</td>
                  <td className="px-4 py-2 text-right flex gap-3 justify-end">
                    <button
                      className={`text-teal-600 hover:underline text-sm ${isArchived ? 'opacity-40 cursor-not-allowed' : ''}`}
                      disabled={isArchived}
                      onClick={async () => {
                        try {
                          const supabaseCard = await invokeSupabaseFunction<any>(`rate-cards-v2/${card.id}`);
                          if (!supabaseCard || typeof supabaseCard !== "object") {
                            throw new Error("Failed to load rate card");
                          }
                          setEditingCard(supabaseCard);
                          setShowForm(true);
                        } catch (error) {
                          console.error('Failed to load rate card', error);
                          alert('Failed to load rate card. Please try again.');
                          setEditingCard(null);
                        }
                      }}
                    >
                      Edit
                    </button>

                    <button
                      className={`text-indigo-600 hover:underline text-sm ${isArchived ? 'opacity-40 cursor-not-allowed' : ''}`}
                      disabled={isArchived}
                      onClick={() => {
                        setCalcPreset({ platform: card.platform_id, category: card.category_id, cardId: card.id });
                        setShowCalc(true);
                      }}
                    >
                      Test
                    </button>

                    <button
                      className={`text-sm ${isArchived ? 'text-emerald-600' : 'text-rose-600'} hover:underline disabled:opacity-40 disabled:cursor-not-allowed`}
                      disabled={isUpdating}
                      onClick={() => handleArchiveToggle(card, !isArchived)}
                    >
                      {isUpdating ? 'Updating…' : isArchived ? 'Restore' : 'Archive'}
                    </button>
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
        {filteredCards.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium">Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(event) => handleRowsPerPageChange(Number(event.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-teal-400 dark:focus:ring-teal-400/30"
              >
                {ROWS_PER_PAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm text-slate-600 dark:text-slate-300">
              <span className="whitespace-nowrap">
                {pageStart}-{pageEnd} of {filteredCards.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => canPreviousPage && setPage((prev) => Math.max(prev - 1, 0))}
                  disabled={!canPreviousPage}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => canNextPage && setPage((prev) => Math.min(prev + 1, totalPages - 1))}
                  disabled={!canNextPage}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <PublishSummaryCard
        digest={publishDigest}
        loadingDigest={importsLoading && !publishDigest}
        gaps={gapData}
        loadingGaps={gapLoading}
        onRefreshCoverage={() => setGapRefreshKey((value) => value + 1)}
        onOpenCoverageModal={() => setGapOpenSignal((value) => value + 1)}
        aiSummary={aiSummary}
      />

      <RateCardGapAlerts
        refreshKey={gapRefreshKey}
        onGoToUpload={handleGoToUpload}
        openSignal={gapOpenSignal}
        onGapsChange={setGapData}
        onLoadingChange={setGapLoading}
      />

      {/* Upload & History */}
      <div className="rounded-xl border border-slate-200 bg-white p-0 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-100 px-4 pt-4 sm:px-6">
          <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1 text-sm dark:bg-slate-700/60">
            <button
              type="button"
              onClick={() => setActiveSection("upload")}
              className={`rounded-full px-3 py-1.5 transition ${
                activeSection === "upload"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              aria-pressed={activeSection === "upload"}
            >
              Upload Rate Card
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("history")}
              className={`rounded-full px-3 py-1.5 transition ${
                activeSection === "history"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              aria-pressed={activeSection === "history"}
            >
              Recent Imports
            </button>
          </div>
        </div>
        <div className="px-4 py-6 sm:px-6">
          {activeSection === "upload" ? (
            <UploadWidget onImportComplete={handleImportComplete} />
          ) : (
            <ImportHistoryTable
              records={recentImports}
              loading={importsLoading}
              onRefresh={fetchRecentImports}
              onPublish={publishUpload}
              publishingId={publishingUploadId}
              onRestore={(record) => setRestoreCandidate(record)}
              restoringId={restoringId}
            />
          )}
        </div>
      </div>

      {/* Reconciliation Calculator */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow p-4">
        <ReconciliationCalculator rateCards={rateCards.map(card => ({
          ...card,
          status: card.status || 'active' as 'active' | 'expired' | 'upcoming'
        }))} />
      </div>

      {/* Modal for Add/Edit Rate Card */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingCard ? "Edit Rate Card" : "Add Rate Card"}
        hideClose
      >
        <RateCardFormV2
          mode={editingCard ? "edit" : "create"}
          initialData={editingCard ? {
            ...editingCard,
            mode: "edit" as const,
            gst_percent: typeof editingCard.gst_percent === "number" ? editingCard.gst_percent : 18,
            tcs_percent: typeof editingCard.tcs_percent === "number" ? editingCard.tcs_percent : 1,
            settlement_basis: (editingCard.settlement_basis as "t_plus" | "weekly" | "bi_weekly" | "monthly") || "t_plus",
            slabs: editingCard.slabs ?? [],
            fees: editingCard.fees ?? []
          } : undefined}
          onCancel={() => {
            setShowForm(false);
            setEditingCard(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditingCard(null);
            fetchCards();
          }}
        />
      </Modal>

      {/* Calculator Modal */}
      <Modal
        open={showCalc}
        onClose={() => setShowCalc(false)}
        title="Reconciliation Calculator"
        variant="modal"
        size="md"
      >
        <ReconciliationCalculator
          rateCards={rateCards}
          initialPlatform={calcPreset.platform}
          initialCategory={calcPreset.category}
          initialCardId={calcPreset.cardId}
          variant="compact"
        />
      </Modal>

      {publishPrompt && (
        <ConflictModal
          prompt={publishPrompt}
          onClose={() => setPublishPrompt(null)}
          onReplace={(selectedIds, changeReason) =>
            publishUpload(publishPrompt.record, {
              action: "replace_existing",
              selectedIds,
              changeReason: changeReason.trim(),
              totalConflicts:
                publishPrompt.mode === "conflict" ? publishPrompt.conflicts.length : selectedIds.length,
            })
          }
          onPublish={() => publishUpload(publishPrompt.record, { action: "publish" })}
          publishing={publishingUploadId === publishPrompt.record.id}
        />
      )}

      <PublishSummaryModal
        data={publishSummaryModal}
        open={Boolean(publishSummaryModal)}
        onClose={() => setPublishSummaryModal(null)}
        onViewRateCards={handleViewRateCards}
      />

      <Modal
        open={Boolean(restoreCandidate)}
        onClose={() => {
          if (restoringId) return;
          setRestoreCandidate(null);
        }}
        title="Restore previous rate cards"
        hideClose={Boolean(restoringId)}
      >
        {restoreCandidate && (
          <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-3 text-amber-700">
              <AlertTriangle className="h-5 w-5 mt-0.5" aria-hidden="true" />
              <div className="space-y-2">
                <p className="font-semibold text-amber-800">Restore available for 24 hours after publishing.</p>
                <p>
                  This will remove the rate cards published from <strong>{restoreCandidate.file_name ?? "this upload"}</strong>
                  {restoreCandidate.version ? ` (version ${restoreCandidate.version})` : ""} and reinstate the previous template.
                </p>
                {restoreExpiryLabel && (
                  <p className="text-xs text-amber-700">Restore window ends {restoreExpiryLabel}.</p>
                )}
              </div>
            </div>
            <p>
              After restoring, any rate cards added by this publish will be removed and the earlier data restored. This action cannot be repeated once used.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRestoreCandidate(null)}
                disabled={Boolean(restoringId)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-sky-600 text-white hover:bg-sky-700 focus-visible:ring-sky-500"
                onClick={handleConfirmRestore}
                disabled={Boolean(restoringId)}
              >
                {restoringId ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Restore"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      </div>
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-40 rounded-lg bg-slate-900 text-white px-4 py-2 shadow-lg text-sm">
          {toastMessage}
        </div>
      )}
    </>
  );
}
