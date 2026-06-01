ALTER TABLE uploaded_files
DROP CONSTRAINT IF EXISTS uploaded_files_status_check;

ALTER TABLE uploaded_files
ADD CONSTRAINT uploaded_files_status_check
CHECK (
  status = ANY (
    ARRAY[
      'UPLOADED'::text,
      'PROCESSING'::text,
      'PROCESSED'::text,
      'FAILED'::text,
      'SKIPPED'::text,
      'DUPLICATE'::text
    ]
  )
);
