import { useCallback, useMemo, useState } from "react";

type ParseResponse = RateCardImport.ParseResponse;
type ImportResponse = RateCardImport.ImportResponse;

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

  const importableRowIds = useMemo(() => {
    if (!parseResult) return { valid: [] as string[], similar: [] as string[] };
    const valid: string[] = [];
    const similar: string[] = [];
    for (const row of parseResult.rows) {
      if (row.status === "valid") {
        valid.push(row.row_id);
      } else if (row.status === "similar") {
        similar.push(row.row_id);
      }
    }
    return { valid, similar };
  }, [parseResult]);

  const importRows = useCallback(
    async (includeSimilar: boolean) => {
      if (!parseResult) {
        setImportError("Upload a file before importing.");
        return null;
      }

      const eligible = includeSimilar
        ? [...importableRowIds.valid, ...importableRowIds.similar]
        : [...importableRowIds.valid];

      if (eligible.length === 0) {
        setImportError(
          includeSimilar ? "No valid or similar rows to import." : "No valid rows to import."
        );
        return null;
      }

      setImporting(true);
      setImportError(null);
      setImportResult(null);

      try {
        const res = await fetch("/api/rate-cards/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            analysis_id: parseResult.analysis_id,
            row_ids: eligible,
            include_similar: includeSimilar,
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

        setImportResult(parsed);
        return parsed;
      } catch (error: any) {
        setImportError(error?.message || "Failed to import rate cards");
        throw error;
      } finally {
        setImporting(false);
      }
    },
    [importableRowIds.similar, importableRowIds.valid, parseResult]
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
