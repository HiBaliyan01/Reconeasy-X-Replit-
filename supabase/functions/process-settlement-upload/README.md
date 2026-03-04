# process-settlement-upload

Supabase Edge Function to parse an Amazon settlement CSV from Supabase Storage and write normalized rows into `settlement_fee_lines`.

## Required env vars

- `SUPABASE_URL` (or `PROJECT_URL`)
- `SUPABASE_SERVICE_ROLE_KEY` (or `SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_KEY`)

## Request

`POST /functions/v1/process-settlement-upload`

```json
{
  "uploaded_file_id": "<uuid>",
  "tenant_id": "<text>",
  "marketplace": "amazon"
}
```

## Notes

- Reads file from bucket: `settlement-uploads`
- Uses `uploaded_files.storage_path` to locate file
- Batch inserts `settlement_fee_lines` in chunks of 500 rows
- Updates `uploaded_files` status to `PROCESSING` -> `PROCESSED` or `FAILED`/`DUPLICATE`
