import { useCallback, useMemo, useState } from "react";
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
  payload?: RateCardImport.RateCardPayload;
};

type ParseResponse = Omit<RateCardImport.ParseResponse, "rows"> & {
  rows: RowOut[];
};
type ImportResponse = RateCardImport.ImportResponse;

type ImportRowRequest = {
  row_id: string;
  row: number;
  status: RateCardImport.RowStatus;
  payload: RateCardImport.RateCardPayload;
};

export function useCsvImport() {
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadedAt, setUploadedAt] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);

  const parseFile = useCallback(async (file: File) => {
    setUploading(true);
    setParseError(null);
    setImportError(null);
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const parsed = await invokeSupabaseFunction<ParseResponse>(
        "rate-cards-import?action=parse",
        {
          method: "POST",
          body: formData,
        }
      );
      setParseResult(parsed);
      setFileName(parsed.file_name ?? file.name);
      setUploadedAt(parsed.uploaded_at);
      return parsed;
    } catch (error: any) {
      setParseError(error?.message || "Failed to analyze file");
      throw error;
    } finally {
      setUploading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setParseResult(null);
    setParseError(null);
    setImportError(null);
    setImportResult(null);
    setFileName(null);
    setUploadedAt(null);
  }, []);

  const validRows = useMemo(
    () => parseResult?.rows.filter((row) => row.status === "valid") ?? [],
    [parseResult]
  );

  const similarRows = useMemo(
    () => parseResult?.rows.filter((row) => row.status === "similar") ?? [],
    [parseResult]
  );

  const duplicateRows = useMemo(
    () => parseResult?.rows.filter((row) => row.status === "duplicate") ?? [],
    [parseResult]
  );

  const errorRows = useMemo(
    () => parseResult?.rows.filter((row) => row.status === "error") ?? [],
    [parseResult]
  );

  const importableRows = useMemo(() => {
    if (!parseResult) return { valid: [] as RowOut[], similar: [] as RowOut[] };
    const valid: RowOut[] = [];
    const similar: RowOut[] = [];
    for (const row of parseResult.rows) {
      if (row.status === "valid") valid.push(row);
      else if (row.status === "similar") similar.push(row);
    }
    return { valid, similar };
  }, [parseResult]);

  const importableRowIds = useMemo(
    () => ({
      valid: importableRows.valid.map((row) => row.row_id),
      similar: importableRows.similar.map((row) => row.row_id),
    }),
    [importableRows]
  );

  type ImportOptions =
    | boolean
    | {
        includeSimilar?: boolean;
        rowIds?: string[];
        overrides?: Record<string, unknown> | null | undefined;
        onProgress?: (index: number, total: number) => void;
      };

  const importRows = useCallback(async (options?: ImportOptions) => {
      if (!parseResult) {
        setImportError("Upload a file before importing.");
        return null;
      }

      // Normalize args
      const includeSimilar =
        typeof options === "boolean"
          ? options
          : Boolean(options?.includeSimilar);
      const explicitIds =
        options && typeof options === "object" && !Array.isArray(options)
          ? options.rowIds
          : undefined;
      const overridesInput =
        options && typeof options === "object" && !Array.isArray(options)
          ? options.overrides
          : undefined;
      const progressCallback =
        options && typeof options === "object" && !Array.isArray(options)
          ? options.onProgress
          : undefined;

      let eligibleRows: RowOut[] = [];
      if (Array.isArray(explicitIds) && explicitIds.length) {
        const rowMap = new Map(parseResult.rows.map((row) => [row.row_id, row] as const));
        eligibleRows = Array.from(new Set(explicitIds))
          .map((id) => rowMap.get(id))
          .filter((row): row is RowOut => Boolean(row))
          .filter((row) => row.status === "valid" || (row.status === "similar" && includeSimilar));
      } else {
        eligibleRows = includeSimilar
          ? [...importableRows.valid, ...importableRows.similar]
          : [...importableRows.valid];
      }

      if (!eligibleRows.length) {
        setImportError(includeSimilar ? "No valid or similar rows to import." : "No valid rows to import.");
        return null;
      }

      setImporting(true);
      setImportError(null);
      setImportResult(null);

      try {
        const includeSimilarFlag = eligibleRows.some((row) => row.status === "similar");
        const rowsById = new Map(parseResult.rows.map((row) => [row.row_id, row] as const));

        const finalRows = Array.from(
          new Set(
            eligibleRows
              .map((row) => row.row_id)
              .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
          )
        ).map((rowId) => {
          const baseRow = rowsById.get(rowId);
          if (!baseRow) return null;
          const override = overridesInput && typeof overridesInput === "object" ? (overridesInput as Record<string, any>)[rowId] : undefined;
          const overrideState = rowOverrides[rowId];

          const payload = (overrideState?.payload ?? baseRow.payload) as RateCardImport.RateCardPayload | undefined;
          if (!payload || typeof payload !== "object") {
            throw new Error(`Missing payload for row ${baseRow.row}`);
          }

          const mergedPayload = {
            ...payload,
            effective_from:
              overrideState?.effective_from ??
              override?.effective_from ??
              (payload as any).effective_from ??
              baseRow.effective_from ??
              "",
            effective_to:
              overrideState?.effective_to ??
              override?.effective_to ??
              (payload as any).effective_to ??
              baseRow.effective_to ??
              null,
          } as RateCardImport.RateCardPayload;

          return {
            row_id: rowId,
            row: baseRow.row,
            status: (overrideState?.status as RowStatus | undefined) ?? baseRow.status,
            payload: mergedPayload,
          };
        }).filter((row): row is ImportRowRequest => Boolean(row));

        if (!finalRows.length) {
          setImportError("No valid rows selected for import.");
          return null;
        }

        const chunkSize = Math.max(1, Math.ceil(finalRows.length / 5));
        const accumulatedResults: ImportResponse = {
          analysis_id: parseResult.analysis_id,
          file_name: parseResult.file_name,
          uploaded_at: parseResult.uploaded_at ?? new Date().toISOString(),
          summary: {
            inserted: 0,
            skipped: 0,
          },
          results: [],
        };

        for (let idx = 0; idx < finalRows.length; idx += chunkSize) {
          const chunkRows = finalRows.slice(idx, idx + chunkSize);
          const parsed = await invokeSupabaseFunction<ImportResponse>(
            "rate-cards-import?action=import",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                rows: chunkRows,
                include_similar: includeSimilarFlag,
              }),
            }
          );
          accumulatedResults.summary.inserted += parsed.summary?.inserted ?? 0;
          accumulatedResults.summary.skipped += parsed.summary?.skipped ?? 0;
          accumulatedResults.results.push(...parsed.results);
          if (parsed.file_name) accumulatedResults.file_name = parsed.file_name;
          if (parsed.uploaded_at) accumulatedResults.uploaded_at = parsed.uploaded_at;

          if (progressCallback) {
            progressCallback(Math.min(idx + chunkRows.length, finalRows.length), finalRows.length);
          }
        }

        setImportResult(accumulatedResults);
        return accumulatedResults;
      } catch (error: any) {
        setImportError(error?.message || "Failed to import rate cards");
        throw error;
      } finally {
        setImporting(false);
      }
    },
    [parseResult, importableRows]
  );

  return {
    parseResult,
    uploading,
    parseError,
    fileName,
    uploadedAt,
    parseFile,
    reset,
    validRows,
    similarRows,
    duplicateRows,
    errorRows,
    importRows,
    importing,
    importError,
    importResult,
    hasImportableRows: importableRowIds.valid.length > 0,
    importableRowIds,
  };
}

export type UseCsvImportReturn = ReturnType<typeof useCsvImport>;
