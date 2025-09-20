const CSV_HEADERS = [
  "platform_id",
  "category_id",
  "commission_type",
  "commission_percent",
  "slabs_json",
  "fees_json",
  "gst_percent",
  "tcs_percent",
  "settlement_basis",
  "t_plus_days",
  "weekly_weekday",
  "bi_weekly_weekday",
  "bi_weekly_which",
  "monthly_day",
  "grace_days",
  "effective_from",
  "effective_to",
  "global_min_price",
  "global_max_price",
  "notes",
];

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function buildRateCardTemplateCsv(): string {
  const rows: string[][] = [
    [
      "amazon",
      "apparel",
      "flat",
      "12",
      JSON.stringify([]),
      JSON.stringify([
        { fee_code: "shipping", fee_type: "percent", fee_value: 3 },
        { fee_code: "rto", fee_type: "percent", fee_value: 1 },
      ]),
      "18",
      "1",
      "t_plus",
      "7",
      "",
      "",
      "",
      "",
      "2",
      "2025-08-01",
      "",
      "0",
      "",
      "Example flat commission",
    ],
    [
      "flipkart",
      "electronics",
      "tiered",
      "",
      JSON.stringify([
        { min_price: 0, max_price: 500, commission_percent: 5 },
        { min_price: 500, max_price: null, commission_percent: 7 },
      ]),
      JSON.stringify([
        { fee_code: "shipping", fee_type: "amount", fee_value: 30 },
        { fee_code: "tech", fee_type: "percent", fee_value: 1 },
      ]),
      "18",
      "1",
      "weekly",
      "",
      "5",
      "",
      "",
      "",
      "1",
      "2025-09-01",
      "2025-12-31",
      "",
      "",
      "Tiered example",
    ],
  ];

  const csvLines = [
    CSV_HEADERS.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ];

  return csvLines.join("\n");
}
