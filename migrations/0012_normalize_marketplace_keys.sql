-- One-time data normalization for key matching consistency.
-- Recommended to run during low-traffic window.

BEGIN;

UPDATE rate_cards_v2
SET
  platform_id = lower(trim(platform_id)),
  category_id = lower(trim(category_id))
WHERE
  platform_id IS NOT NULL
  AND category_id IS NOT NULL
  AND (
    platform_id <> lower(trim(platform_id))
    OR category_id <> lower(trim(category_id))
  );

UPDATE orders
SET marketplace = lower(trim(marketplace))
WHERE
  marketplace IS NOT NULL
  AND marketplace <> lower(trim(marketplace));

COMMIT;
