import { neon } from "jsr:@neon/serverless@1.0.1";

type Target2D = "depan" | "tengah" | "belakang";

const databaseUrl = Deno.env.get("NEON_DATABASE_URL")?.trim();
const serviceSecret = Deno.env.get("ADAPTIVE_SERVICE_SECRET")?.trim();

if (!databaseUrl) throw new Error("NEON_DATABASE_URL belum dikonfigurasi.");
if (!serviceSecret) throw new Error("ADAPTIVE_SERVICE_SECRET belum dikonfigurasi.");

const sql = neon(databaseUrl);
const targets = new Set<Target2D>(["depan", "tengah", "belakang"]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function adaptiveBatchReader(request: Request): Promise<Response> {
  if (request.headers.get("authorization") !== `Bearer ${serviceSecret}`) {
    return json({ error: "Unauthorized." }, 401);
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const marketIds = Array.isArray(body.marketIds)
    ? [...new Set(body.marketIds.map((value) => String(value).trim()).filter(Boolean))]
    : [];
  const target2D = String(body.target2D ?? "") as Target2D;

  if (!marketIds.length || marketIds.length > 35) {
    return json({ error: "Pasaran harus berisi 1 sampai 35 item." }, 400);
  }
  if (!targets.has(target2D)) return json({ error: "Target Adaptive tidak valid." }, 400);

  const rows = await sql`
    select distinct on (p.market_id)
      p.market_id,
      p.market_name,
      p.latest_draw,
      p.pair_probabilities,
      p.history_length,
      p.created_at
    from adaptive.predictions p
    where p.market_id in (
      select jsonb_array_elements_text(${JSON.stringify(marketIds)}::jsonb)
    )
      and p.target_2d = ${target2D}
      and p.status = 'pending'
    order by p.market_id, p.history_length desc, p.created_at desc
  `;

  return json({ snapshots: rows });
}
