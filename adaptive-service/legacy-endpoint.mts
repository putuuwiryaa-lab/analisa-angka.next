export const LEGACY_PREDICTION_STORE_PATH = "/predictions/store";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

export function retiredLegacyPredictionStore(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.pathname !== LEGACY_PREDICTION_STORE_PATH) return null;

  return new Response(
    JSON.stringify({
      error: "Endpoint prediction legacy sudah dinonaktifkan. Gunakan /runs/store dengan snapshot lengkap 18 selection.",
      replacement: "/runs/store",
    }),
    {
      status: 410,
      headers: {
        ...JSON_HEADERS,
        "Cache-Control": "no-store",
      },
    },
  );
}
