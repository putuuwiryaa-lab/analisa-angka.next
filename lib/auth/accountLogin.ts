export function normalizePhone(input: unknown) {
  const digits = String(input || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

export function emailFromPhone(phone: string) {
  return `${phone}@vip.local`;
}

export function phoneIsValid(phone: string) {
  return /^62\d{8,15}$/.test(phone);
}
