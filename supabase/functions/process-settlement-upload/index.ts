import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeKey } from "../../../shared/utils/normalizeKey.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const supabaseUrl =
  Deno.env.get("PROJECT_URL") ??
  Deno.env.get("SUPABASE_URL") ??
  Deno.env.get("VITE_SUPABASE_URL");

const serviceRoleKey =
  Deno.env.get("SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  console.warn("process-settlement-upload missing Supabase credentials");
}

type UploadRow = {
  id: string;
  tenant_id: string;
  marketplace: string;
  settlement_id: string | null;
  storage_path: string | null;
  file_name: string | null;
  status: string | null;
  row_count: number | null;
  processed_at: string | null;
  error_message: string | null;
  settlement_start_date: string | null;
  settlement_end_date: string | null;
};

type FeeCodeRow = {
  raw_amount_type: string | null;
  raw_amount_description: string | null;
  bucket: string | null;
};

type RequestBody = {
  uploaded_file_id?: string;
  tenant_id?: string;
  marketplace?: string;
};

const BATCH_SIZE = 500;
const SAFE_ERROR_MESSAGE_MAX = 600;
const STORAGE_BUCKET = "settlement-uploads";

function truncateErrorMessage(message: string): string {
  if (message.length <= SAFE_ERROR_MESSAGE_MAX) return message;
  return `${message.slice(0, SAFE_ERROR_MESSAGE_MAX - 3)}...`;
}

function normalizeHeader(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\ufeff/g, "")
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .trim();
}

function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  const normalizedText = text.replace(/\r/g, "");
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < normalizedText.length; i += 1) {
    const ch = normalizedText[i];
    if (ch === '"') {
      if (inQuotes && normalizedText[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (ch === "\n" && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.map((cols) => cols.map((col) => col.replace(/^\ufeff/, "").trim()));
}

function findTransactionHeaderIndex(rows: string[][]): number {
  for (let i = 0; i < rows.length; i += 1) {
    const headers = rows[i].map((h) => normalizeHeader(h));
    const hasTxnType = headers.includes("transaction-type") || headers.includes("transactiontype");
    const hasOrderKey = headers.includes("order-id") || headers.includes("orderid") || headers.includes("order-item-id");
    if (hasTxnType && hasOrderKey) return i;
  }

  return rows.findIndex((row) => row.length > 0 && normalizeHeader(row[0]).includes("settlement-id"));
}

function toISODate(value: string | null | undefined): string | null {
  const input = (value ?? "").trim();
  if (!input) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toNumber(value: string | null | undefined): number | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[,$₹£€\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toInteger(value: string | null | undefined): number | null {
  const n = toNumber(value);
  if (n === null) return null;
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function normalizeCsvRecord(headers: string[], row: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((header, idx) => {
    record[normalizeHeader(header)] = (row[idx] ?? "").trim();
  });
  return record;
}

function getFirst(record: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = record[normalizeHeader(key)] ?? "";
    if (value.trim()) return value.trim();
  }
  return "";
}

function buildFeeLookup(rows: FeeCodeRow[]) {
  const byTypeAndDescription = new Map<string, string>();
  const byDescription = new Map<string, string>();

  for (const row of rows) {
    const typeKey = normalizeKey(row.raw_amount_type);
    const descriptionKey = normalizeKey(row.raw_amount_description);
    const bucket = (row.bucket ?? "").trim() || "UNMAPPED";

    if (typeKey || descriptionKey) {
      byTypeAndDescription.set(`${typeKey}|${descriptionKey}`, bucket);
    }

    if (descriptionKey) {
      byDescription.set(descriptionKey, bucket);
    }
  }

  return {
    resolve(type: string | null | undefined, description: string | null | undefined): string {
      const typeKey = normalizeKey(type);
      const descriptionKey = normalizeKey(description);
      const direct = byTypeAndDescription.get(`${typeKey}|${descriptionKey}`);
      if (direct) return direct;
      if (descriptionKey) {
        const fallback = byDescription.get(descriptionKey);
        if (fallback) return fallback;
      }
      return "UNMAPPED";
    },
  };
}

function extractMetadata(metadataRows: string[][]): {
  settlementId: string | null;
  settlementStartDate: string | null;
  settlementEndDate: string | null;
} {
  let settlementId: string | null = null;
  let settlementStartDate: string | null = null;
  let settlementEndDate: string | null = null;

  for (const row of metadataRows) {
    if (!row.length) continue;
    const key = normalizeHeader(row[0]);
    const value = (row[1] ?? "").trim();

    if (!settlementId && ["settlement-id", "settlementid"].includes(key)) {
      settlementId = value || null;
    }

    if (!settlementStartDate && ["settlement-start-date", "settlementstartdate"].includes(key)) {
      settlementStartDate = toISODate(value);
    }

    if (!settlementEndDate && ["settlement-end-date", "settlementenddate"].includes(key)) {
      settlementEndDate = toISODate(value);
    }
  }

  return { settlementId, settlementStartDate, settlementEndDate };
}

function isCsvFile(uploaded: UploadRow): boolean {
  const fileName = (uploaded.file_name ?? "").toLowerCase();
  const storagePath = (uploaded.storage_path ?? "").toLowerCase();
  return fileName.endsWith(".csv") || storagePath.endsWith(".csv");
}

function nowIso(): string {
  return new Date().toISOString();
}

async function updateUploadStatus(
  client: ReturnType<typeof createClient>,
  uploadedFileId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const { error } = await client
    .from("uploaded_files")
    .update({ ...values, updated_at: nowIso() })
    .eq("id", uploadedFileId);

  if (error) {
    throw new Error(`Failed to update uploaded_files status: ${error.message}`);
  }
}

function errorToString(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

function isUniqueDuplicateError(error: unknown): boolean {
  const message = errorToString(error).toLowerCase();
  return message.includes("uploaded_files") && message.includes("unique");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ message: "Supabase credentials are not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startedAt = nowIso();
  let requestBody: RequestBody = {};

  try {
    requestBody = (await req.json()) as RequestBody;
    const uploadedFileId = (requestBody.uploaded_file_id ?? "").trim();
    const tenantId = (requestBody.tenant_id ?? "").trim();
    const marketplace = normalizeKey(requestBody.marketplace);

    if (!uploadedFileId || !tenantId || !marketplace) {
      return new Response(
        JSON.stringify({ message: "uploaded_file_id, tenant_id, marketplace are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (marketplace !== "amazon") {
      return new Response(JSON.stringify({ message: "Only marketplace=amazon is supported in Phase-1" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = createClient(supabaseUrl, serviceRoleKey);

    const { data: uploadRowRaw, error: uploadFetchError } = await client
      .from("uploaded_files")
      .select("id,tenant_id,marketplace,settlement_id,storage_path,file_name,status,row_count,processed_at,error_message,settlement_start_date,settlement_end_date")
      .eq("id", uploadedFileId)
      .eq("tenant_id", tenantId)
      .eq("marketplace", marketplace)
      .maybeSingle();

    const uploadRow = (uploadRowRaw as UploadRow | null);

    if (uploadFetchError) {
      return new Response(JSON.stringify({ message: uploadFetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!uploadRow) {
      return new Response(JSON.stringify({ message: "uploaded_files row not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isCsvFile(uploadRow)) {
      await updateUploadStatus(client, uploadedFileId, {
        status: "FAILED",
        error_message: "Unsupported file type",
        processed_at: nowIso(),
      });
      return new Response(
        JSON.stringify({
          uploaded_file_id: uploadedFileId,
          status: "FAILED",
          row_count: 0,
          settlement_id: uploadRow.settlement_id,
          started_at: startedAt,
          finished_at: nowIso(),
          message: "Unsupported file type",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Early idempotency check if settlement_id already known on uploaded_files row.
    if (uploadRow.settlement_id) {
      const { data: duplicateProcessed } = await client
        .from("uploaded_files")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("marketplace", marketplace)
        .eq("settlement_id", uploadRow.settlement_id)
        .eq("status", "PROCESSED")
        .neq("id", uploadedFileId)
        .limit(1)
        .maybeSingle();

      if (duplicateProcessed) {
        await updateUploadStatus(client, uploadedFileId, {
          status: "DUPLICATE",
          error_message: "Duplicate settlement already processed",
          processed_at: nowIso(),
          row_count: 0,
        });

        return new Response(
          JSON.stringify({
            uploaded_file_id: uploadedFileId,
            status: "DUPLICATE",
            row_count: 0,
            settlement_id: uploadRow.settlement_id,
            started_at: startedAt,
            finished_at: nowIso(),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    await updateUploadStatus(client, uploadedFileId, {
      status: "PROCESSING",
      processed_at: null,
      error_message: null,
    });

    if (!uploadRow.storage_path) {
      await updateUploadStatus(client, uploadedFileId, {
        status: "FAILED",
        error_message: "storage_path missing on uploaded_files",
        processed_at: nowIso(),
      });
      return new Response(
        JSON.stringify({
          uploaded_file_id: uploadedFileId,
          status: "FAILED",
          row_count: 0,
          settlement_id: uploadRow.settlement_id,
          started_at: startedAt,
          finished_at: nowIso(),
          message: "storage_path missing on uploaded_files",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: fileData, error: downloadError } = await client.storage
      .from(STORAGE_BUCKET)
      .download(uploadRow.storage_path);

    if (downloadError || !fileData) {
      const message = `File not found in storage: ${uploadRow.storage_path}`;
      await updateUploadStatus(client, uploadedFileId, {
        status: "FAILED",
        error_message: truncateErrorMessage(downloadError?.message || message),
        processed_at: nowIso(),
      });
      return new Response(
        JSON.stringify({
          uploaded_file_id: uploadedFileId,
          status: "FAILED",
          row_count: 0,
          settlement_id: uploadRow.settlement_id,
          started_at: startedAt,
          finished_at: nowIso(),
          message,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const csvText = await fileData.text();
    const csvRows = splitCsvRows(csvText);
    if (!csvRows.length) {
      throw new Error("CSV file is empty");
    }

    const headerIndex = findTransactionHeaderIndex(csvRows);
    if (headerIndex < 0 || headerIndex >= csvRows.length - 1) {
      throw new Error("Could not detect transaction header row in CSV");
    }

    const metadata = extractMetadata(csvRows.slice(0, headerIndex));
    const headers = csvRows[headerIndex].map((h) => h.trim());
    const transactionRows = csvRows.slice(headerIndex + 1);

    const normalizedRecords = transactionRows
      .filter((row) => row.some((value) => (value ?? "").trim().length > 0))
      .map((row) => normalizeCsvRecord(headers, row));

    const settlementIdFromRows = normalizedRecords
      .map((record) => getFirst(record, ["settlement-id", "settlement_id", "settlementid"]))
      .find((value) => value.length > 0);

    const settlementStartFromRows = normalizedRecords
      .map((record) => getFirst(record, ["settlement-start-date", "settlement_start_date", "settlementstartdate"]))
      .map((value) => toISODate(value))
      .find((value) => Boolean(value));

    const settlementEndFromRows = normalizedRecords
      .map((record) => getFirst(record, ["settlement-end-date", "settlement_end_date", "settlementenddate"]))
      .map((value) => toISODate(value))
      .find((value) => Boolean(value));

    const resolvedSettlementId =
      metadata.settlementId || settlementIdFromRows || uploadRow.settlement_id || null;
    const resolvedSettlementStart =
      metadata.settlementStartDate || settlementStartFromRows || uploadRow.settlement_start_date || null;
    const resolvedSettlementEnd =
      metadata.settlementEndDate || settlementEndFromRows || uploadRow.settlement_end_date || null;

    await updateUploadStatus(client, uploadedFileId, {
      settlement_id: resolvedSettlementId,
      settlement_start_date: resolvedSettlementStart,
      settlement_end_date: resolvedSettlementEnd,
    });

    if (resolvedSettlementId) {
      const { data: duplicateProcessed } = await client
        .from("uploaded_files")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("marketplace", marketplace)
        .eq("settlement_id", resolvedSettlementId)
        .eq("status", "PROCESSED")
        .neq("id", uploadedFileId)
        .limit(1)
        .maybeSingle();

      if (duplicateProcessed) {
        await updateUploadStatus(client, uploadedFileId, {
          status: "DUPLICATE",
          error_message: "Duplicate settlement already processed",
          processed_at: nowIso(),
          row_count: 0,
        });

        return new Response(
          JSON.stringify({
            uploaded_file_id: uploadedFileId,
            status: "DUPLICATE",
            row_count: 0,
            settlement_id: resolvedSettlementId,
            started_at: startedAt,
            finished_at: nowIso(),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const { data: feeCodeRows, error: feeCodeError } = await client
      .from("fee_code_library")
      .select("raw_amount_type,raw_amount_description,bucket")
      .eq("marketplace", "amazon");

    if (feeCodeError) {
      throw new Error(`Failed to load fee_code_library: ${feeCodeError.message}`);
    }

    const feeLookup = buildFeeLookup((feeCodeRows ?? []) as FeeCodeRow[]);

    let insertedRows = 0;
    let skippedRows = 0;

    const rowsForInsert = normalizedRecords
      .map((record) => {
        const itemFeeType = getFirst(record, ["item-related-fee-type", "itemrelatedfeetype"]);
        const itemFeeAmountRaw = getFirst(record, ["item-related-fee-amount", "itemrelatedfeeamount"]);
        const priceType = getFirst(record, ["price-type", "pricetype"]);
        const priceAmountRaw = getFirst(record, ["price-amount", "priceamount"]);

        let rawAmountType: string | null = null;
        let rawAmountDescription: string | null = null;
        let rawAmountRaw: string = "";

        if (itemFeeType) {
          rawAmountType = "ItemFees";
          rawAmountDescription = itemFeeType;
          rawAmountRaw = itemFeeAmountRaw;
        } else if (priceType) {
          rawAmountType = "ItemPrice";
          rawAmountDescription = priceType;
          rawAmountRaw = priceAmountRaw;
        }

        const amount = toNumber(rawAmountRaw);
        const orderId = getFirst(record, ["order-id", "order_id", "orderid"]) || null;
        const adjustmentId = getFirst(record, ["adjustment-id", "adjustment_id", "adjustmentid"]) || null;

        if (amount === null) {
          console.log(`Skipped row (no amount): ${JSON.stringify(record)}`);
          skippedRows += 1;
          return null;
        }

        const orderItemId = getFirst(record, ["order-item-id", "order_item_id", "orderitemid"]) || null;
        const sku = getFirst(record, ["sku"]) || null;
        const quantityPurchased =
          toInteger(getFirst(record, ["quantity-purchased", "quantity_purchased", "quantitypurchased"])) ??
          null;

        if (!rawAmountDescription) {
          rawAmountDescription =
            getFirst(record, ["amount-description", "amount_description", "amountdescription"]) || null;
        }

        const transactionType =
          getFirst(record, ["transaction-type", "transaction_type", "transactiontype"]) || null;

        const postedDateRaw = getFirst(record, ["posted-date", "posted_date", "posteddate"]);
        const depositDateRaw = getFirst(record, ["deposit-date", "deposit_date", "depositdate"]);
        const postedDate = toISODate(postedDateRaw);
        const payoutDate = toISODate(depositDateRaw) || postedDate;

        const currency = getFirst(record, ["currency"]) || null;

        // Add this right before the closing of the map function
        if (amount === null || amount === undefined) {
          console.log(`Guard caught null amount for row: ${JSON.stringify(record)}`);
          skippedRows += 1;
          return null;
        }

        return {
          uploaded_file_id: uploadedFileId,
          tenant_id: tenantId,
          marketplace,
          settlement_id:
            getFirst(record, ["settlement-id", "settlement_id", "settlementid"]) ||
            resolvedSettlementId,
          posted_date: postedDate,
          payout_date: payoutDate,
          transaction_type: transactionType,
          raw_amount_type: rawAmountType,
          raw_amount_description: rawAmountDescription,
          order_id: orderId,
          adjustment_id: adjustmentId,
          order_item_id: orderItemId,
          sku,
          quantity_purchased: quantityPurchased,
          bucket: feeLookup.resolve(rawAmountType, rawAmountDescription),
          amount,
          currency,
          is_reconcilable: Boolean(orderId),
        };
      })
      .filter((row) => row !== null);

    for (let i = 0; i < rowsForInsert.length; i += BATCH_SIZE) {
      const chunk = rowsForInsert.slice(i, i + BATCH_SIZE);
      if (!chunk.length) continue;

      const { error: insertError } = await client.from("settlement_fee_lines").insert(chunk);
      if (insertError) {
        throw new Error(`Failed to insert settlement_fee_lines chunk at ${i}: ${insertError.message}`);
      }

      insertedRows += chunk.length;
    }

    await updateUploadStatus(client, uploadedFileId, {
      status: "PROCESSED",
      row_count: insertedRows,
      processed_at: nowIso(),
      error_message: null,
    });

    return new Response(
      JSON.stringify({
        uploaded_file_id: uploadedFileId,
        status: "PROCESSED",
        row_count: insertedRows,
        skipped_rows: skippedRows,
        settlement_id: resolvedSettlementId,
        started_at: startedAt,
        finished_at: nowIso(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = truncateErrorMessage(errorToString(error));
    const uploadedFileId = (requestBody.uploaded_file_id ?? "").trim();

    if (uploadedFileId && supabaseUrl && serviceRoleKey) {
      const client = createClient(supabaseUrl, serviceRoleKey);
      const statusValue = isUniqueDuplicateError(error) ? "DUPLICATE" : "FAILED";
      const errorMessageValue = isUniqueDuplicateError(error)
        ? "Duplicate settlement already processed"
        : message;

      try {
        await updateUploadStatus(client, uploadedFileId, {
          status: statusValue,
          row_count: 0,
          processed_at: nowIso(),
          error_message: errorMessageValue,
        });
      } catch (statusUpdateError) {
        console.error("Failed to update uploaded_files after error", statusUpdateError);
      }

      return new Response(
        JSON.stringify({
          uploaded_file_id: uploadedFileId,
          status: statusValue,
          row_count: 0,
          started_at: startedAt,
          finished_at: nowIso(),
          message: errorMessageValue,
        }),
        {
          status: statusValue === "DUPLICATE" ? 200 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
