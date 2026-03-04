export function normalizeKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export default normalizeKey;
