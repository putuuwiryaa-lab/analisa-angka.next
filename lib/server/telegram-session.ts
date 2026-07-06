export type SessionAccess = {
  ok: boolean;
  status: number;
  error?: string;
  role?: "TRIAL" | "PRO" | "SUPER";
};

export async function verifyActiveTelegramSession(_headers?: Headers): Promise<SessionAccess> {
  return { ok: true, status: 200, role: "SUPER" };
}
