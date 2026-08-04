import { neon } from "jsr:@neon/serverless@1.0.1";

type Target2D = "depan" | "tengah" | "belakang";
type AdaptiveMethod = "ai" | "bbfs";

const databaseUrl = Deno.env.get("NEON_DATABASE_URL")?.trim();
const serviceSecret = Deno.env.get("ADAPTIVE_SERVICE_SECRET")?.trim();

if (!databaseUrl) throw new Error("NEON_DATABASE_URL belum dikonfigurasi.");
if (!serviceSecret) throw new Error("ADAPTIVE_SERVICE_SECRET belum dikonfigurasi.");

const sql = neon(databaseUrl);
const targets = new Set<Target2D>(["depan", "tengah", "belakang"]);
const methods = new Set<AdaptiveMethod>(["ai", "bbfs"]);

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
  const method = String(body.method ?? "") as AdaptiveMethod;
  const digitCount = Number(body.digitCount);

  if (!marketIds.length || marketIds.length > 35) {
    return json({ error: "Pasaran harus berisi 1 sampai 35 item." }, 400);
  }
  if (!targets.has(target2D)) return json({ error: "Target Adaptive tidak valid." }, 400);
  if (!methods.has(method)) return json({ error: "Metode Adaptive tidak valid." }, 400);
  if (!Number.isInteger(digitCount) || digitCount < 1 || digitCount > 9) {
    return json({ error: "Jumlah digit Adaptive harus antara 1 dan 9." }, 400);
  }

  const rows = await sql`
    select distinct on (p.market_id)
      p.id::text as prediction_id,
      p.market_id,
      p.market_name,
      p.latest_draw,
      p.history_length,
      p.created_at as prediction_created_at,
      s.method,
      s.digit_count,
      s.digits,
      s.estimated_success,
      s.baseline_success,
      s.lift,
      s.selection_margin,
      s.created_at as selection_created_at
    from adaptive.predictions p
    left join adaptive.published_selections s
      on s.prediction_id = p.id
      and s.method = ${method}
      and s.digit_count = ${digitCount}
    where p.market_id in (
      select jsonb_array_elements_text(${JSON.stringify(marketIds)}::jsonb)
    )
      and p.target_2d = ${target2D}
      and p.status = 'pending'
    order by p.market_id, p.history_length desc, p.created_at desc
  `;

  return json({ snapshots: rows });
}
