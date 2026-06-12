const DEVICE_ID_KEY = "aa_device_id";

function createDeviceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";

  const saved = localStorage.getItem(DEVICE_ID_KEY);
  if (saved) return saved;

  const next = createDeviceId();
  localStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

export function deviceAuthHeader(): Record<string, string> {
  const deviceId = getDeviceId();
  const headers: Record<string, string> = {};

  if (deviceId) {
    headers["x-aa-device-id"] = deviceId;
  }

  return headers;
}
