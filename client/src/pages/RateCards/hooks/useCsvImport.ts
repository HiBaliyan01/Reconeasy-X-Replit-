import { useCallback, useMemo, useState } from "react";

type ParseResponse = RateCardImport.ParseResponse;
type ImportResponse = RateCardImport.ImportResponse;

const FN_BASE = (() => {
  const globalProcess = typeof globalThis !== "undefined" ? (globalThis as any).process : undefined;
  const metaEnv = (import.meta as any)?.env ?? {};

  const candidates = [
    typeof globalProcess?.env?.NEXT_PUBLIC_FN_URL === "string"
      ? globalProcess.env.NEXT_PUBLIC_FN_URL
      : undefined,
    typeof metaEnv.NEXT_PUBLIC_FN_URL === "string" ? (metaEnv.NEXT_PUBLIC_FN_URL as string) : undefined,
    typeof metaEnv.VITE_FN_URL === "string" ? (metaEnv.VITE_FN_URL as string) : undefined,
  ];

  const resolved = candidates.find((value) => typeof value === "string" && value.trim().length > 0) ?? "";
  return resolved.trim().replace(/\/$/, "");
})();

function functionUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (!FN_BASE) {
    throw new Error("Rate card function URL is not configured. Set NEXT_PUBLIC_FN_URL to your Supabase function endpoint.");
  }
  return `${FN_BASE}${suffix}`;
}

type JsonPayload = {
  message?: string;
  [key: string]: unknown;
};

async function readJsonSafe(res: Response): Promise<{ data: unknown; raw: string }> {
  const text = await res.text();
  if (!text) {
    return { data: null, raw: "" };
  }

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
  if (text.length > 0) {
    return text.length > 200 ? `${text.slice(0, 200)}…` : text;
  }

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
      const res = await fetch(functionUrl("/rate-cards/parse"), {
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
      const timestamp = new Date().toISOString();
      const withMeta: ParseResponse = {
        ...parsed,
        file_name: file.name,
        uploaded_at: timestamp,
      };

      setParseResult(withMeta);
      setFileName(withMeta.file_name ?? file.name);
      setUploadedAt(withMeta.uploaded_at ?? timestamp);
      return withMeta;
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

  const importableRowIds = useMemo(() => {
    if (!parseResult) return { valid: [] as string[], similar: [] as string[] };
    const valid: string[] = [];
    const similar: string[] = [];
    for (const row of parseResult.rows) {
      const key = String(row.row);
      if (!row.payload) continue;
      if (row.status === "valid") {
        valid.push(key);
      } else if (row.status === "similar") {
        similar.push(key);
      }
    }
    return { valid, similar };
  }, [parseResult]);

  const importRows = useCallback(
    async (
      options?:
        | boolean
        | {
            includeSimilar?: boolean;
            rowIds?: string[];
          }
    ) => {
      if (!parseResult) {
        setImportError("Upload a file before importing.");
        return null;
      }

      let includeSimilar = false;
      let explicitRowIds: string[] | undefined;

      if (typeof options === "boolean") {
        includeSimilar = options;
      } else if (options) {
        includeSimilar = options.includeSimilar ?? false;
        if (Array.isArray(options.rowIds)) {
          explicitRowIds = options.rowIds;
        }
      }

      const rowMap = new Map(
        parseResult.rows.map((row) => [String(row.row), row])
      );

      let selectedRows: RateCardImport.ParsedRow[] = [];

      if (explicitRowIds) {
        const uniqueIds = Array.from(new Set(explicitRowIds));
        const invalidSimilar = uniqueIds.some((id) => rowMap.get(id)?.status === "similar");

        if (invalidSimilar && !includeSimilar) {
          setImportError("Similar rows require confirmation before importing.");
          return null;
        }

        selectedRows = uniqueIds
          .map((id) => rowMap.get(id))
          .filter((row): row is RateCardImport.ParsedRow => Boolean(row && row.payload))
          .filter((row) => {
            if (row.status === "valid") return true;
            if (row.status === "similar") return includeSimilar;
            return false;
          });
      } else {
        const validSelection = parseResult.rows.filter(
          (row) => row.status === "valid" && row.payload
        );
        const similarSelection = includeSimilar
          ? parseResult.rows.filter((row) => row.status === "similar" && row.payload)
          : [];
        selectedRows = includeSimilar
          ? [...validSelection, ...similarSelection]
          : [...validSelection];
      }

      if (selectedRows.length === 0) {
        setImportError(
          includeSimilar ? "No valid or similar rows to import." : "No valid rows to import."
        );
        return null;
      }

      const payloads = selectedRows
        .map((row) => row.payload)
        .filter((payload): payload is RateCardImport.Payload => Boolean(payload));

      setImporting(true);
      setImportError(null);
      setImportResult(null);

      try {
        const res = await fetch(functionUrl("/rate-cards/import"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            include_similar: includeSimilar,
            rows: payloads,
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
        const enhancedResults = parsed.results.map((row, index) => ({
          ...row,
          source_row: selectedRows[index]?.row ?? row.source_row,
        }));
        const withMeta: ImportResponse = {
          ...parsed,
          uploaded_at: uploadedAt ?? new Date().toISOString(),
          results: enhancedResults,
        };

        setImportResult(withMeta);
        return withMeta;
      } catch (error: any) {
        setImportError(error?.message || "Failed to import rate cards");
        throw error;
      } finally {
        setImporting(false);
      }
    },
    [importableRowIds.similar, importableRowIds.valid, parseResult, uploadedAt]
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
    hasImportableRows: validRows.length > 0,
    importableRowIds,
  };
}

export type UseCsvImportReturn = ReturnType<typeof useCsvImport>;
