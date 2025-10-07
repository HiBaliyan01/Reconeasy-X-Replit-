import { useCallback, useMemo, useState } from "react";

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
  payload?: unknown;
};

type ParseResponse = Omit<RateCardImport.ParseResponse, "rows"> & {
  rows: RowOut[];
};
type ImportResponse = RateCardImport.ImportResponse;

type JsonPayload = {
  message?: string;
  [key: string]: unknown;
};

async function readJsonSafe(res: Response): Promise<{ data: unknown; raw: string }> {
  const text = await res.text();
  if (!text) return { data: null, raw: "" };
  try {
    return { data: JSON.parse(text), raw: text };
  } catch {
    return { data: null, raw: text };
  }
}

function resolveErrorMessage(payload: unknown, raw: string, fallback: string) {
  if (payload && typeof payload === "object" && "message" in (payload as JsonPayload)) {
    const message = (payload as JsonPayload).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message.trim();
    }
  }
  const text = raw.trim();
  if (text.length > 0) return text.length > 200 ? `${text.slice(0, 200)}…` : text;
  return fallback;
}

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
      const res = await fetch("/api/rate-cards/parse", {
        method: "POST",
        body: formData,
      });

      const { data, raw } = await readJsonSafe(res);

      if (!res.ok) {
        throw new Error(
          resolveErrorMessage(data, raw, `Failed to analyze file (status ${res.status})`)
        );
      }
      if (!data || typeof data !== "object" || data === null) {
        throw new Error("Empty response from server. Please try again.");
      }

      const parsed = data as ParseResponse;
      if (!parsed.analysis_id) {
        throw new Error("Unexpected response from server. Please try again.");
      }

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

      const dedupedIds = Array.from(
        new Set(
          eligibleRows
            .map((row) => row.row_id)
            .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        )
      );

      if (!dedupedIds.length) {
        setImportError("Selected rows are missing identifiers. Please re-upload the file and try again.");
        return null;
      }

      const includeSimilarFlag = eligibleRows.some((row) => row.status === "similar");

      let overridesToSend: Record<string, unknown> | undefined;
      if (overridesInput && typeof overridesInput === "object" && overridesInput !== null) {
        const filtered: Record<string, unknown> = {};
        for (const id of dedupedIds) {
          const override = (overridesInput as Record<string, unknown>)[id];
          if (override && typeof override === "object") {
            filtered[id] = override;
          }
        }
        if (Object.keys(filtered).length > 0) {
          overridesToSend = filtered;
        }
      }

      setImporting(true);
      setImportError(null);
      setImportResult(null);

      try {
        const chunkSize = Math.max(1, Math.ceil(dedupedIds.length / 5));
        const accumulatedResults: ImportResponse = {
          analysis_id: parseResult.analysis_id,
          results: [],
        } as ImportResponse;

        for (let idx = 0; idx < dedupedIds.length; idx += chunkSize) {
          const chunkIds = dedupedIds.slice(idx, idx + chunkSize);

          const res = await fetch("/api/rate-cards/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              analysis_id: parseResult.analysis_id,
              row_ids: chunkIds,
              include_similar: includeSimilarFlag,
              ...(overridesToSend ? { overrides: overridesToSend } : {}),
            }),
          });

          const { data, raw } = await readJsonSafe(res);

          if (!res.ok) {
            throw new Error(
              resolveErrorMessage(data, raw, `Failed to import rate cards (status ${res.status})`)
            );
          }
          if (!data || typeof data !== "object" || data === null) {
            throw new Error("Empty response from server. Please try again.");
          }

          const parsed = data as ImportResponse;
          if (!parsed.analysis_id) {
            throw new Error("Unexpected response from server. Please try again.");
          }

          accumulatedResults.results.push(...parsed.results);

          if (progressCallback) {
            progressCallback(Math.min(idx + chunkIds.length, dedupedIds.length), dedupedIds.length);
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
