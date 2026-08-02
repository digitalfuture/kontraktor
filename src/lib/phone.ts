/**
 * Indonesian phone number helpers.
 * Used by project post, contractor registration and account profile forms.
 */

/** Strip all whitespace from a raw phone input */
export function normalizePhone(raw: string): string {
  return (raw || '').replace(/\s+/g, '');
}

/**
 * Normalize & validate an Indonesian phone number.
 * Strips +62/62/0 prefix, requires 8 followed by 7-14 digits.
 * Returns '+62...' on success, or null when invalid/empty.
 */
export function normalizeIndonesianPhone(raw: string): string | null {
  let phone = normalizePhone(raw);
  if (!phone) return null;
  if (phone.startsWith('+62')) phone = phone.slice(3);
  else if (phone.startsWith('62')) phone = phone.slice(2);
  else if (phone.startsWith('0')) phone = phone.slice(1);
  if (!/^8\d{7,14}$/.test(phone)) return null;
  return '+62' + phone;
}
