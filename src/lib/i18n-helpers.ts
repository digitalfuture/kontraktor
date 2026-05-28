/**
 * Get localized name from a DB record.
 * Returns `record['name_' + locale]` if available, otherwise falls back to `record[field]`.
 */
export function localizedName(
  record: Record<string, unknown>,
  locale: string,
  field = 'name'
): string {
  const localized = record[`name_${locale}`] as string | undefined;
  if (localized) return localized;
  return (record[field] as string) || '';
}
