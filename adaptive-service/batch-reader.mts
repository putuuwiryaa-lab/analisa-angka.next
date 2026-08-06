import { neon } from "jsr:@neon/serverless@1.0.1";
import { parseAdaptiveBatchRequest } from "./batch-contract.mts";

const databaseUrl = Deno.env.get("NEON_DATABASE_URL")?.trim();
const serviceSecret = Deno.env.get("ADAPTIVE_SERVICE_SECRET")?.trim();

if (!databaseUrl) throw new Error("NEON_DATABASE_URL belum dikonfigurasi.");
if (!serviceSecret) throw new Error("ADAPTIVE_SERVICE_SECRET belum dikonfigurasi.");

const sql = neon(databaseUrl);

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

  const parsed = parseAdaptiveBatchRequest(await request.json().catch(() => ({})));
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const {
    marketIds,
    target2D,
    method,
    digitCount,
    engineVersion,
    configVersion,
  } = parsed.value;

  const rows = await sql`
    select distinct on (p.market_id)
      p.id::text as prediction_id,
      p.market_id,
      p.market_name,
      p.latest_draw,
      p.history_length,
      p.engine_version,
      p.config_version,
      p.snapshot_complete,
      p.selection_count,
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
    inner join adaptive.published_selections s
      on s.prediction_id = p.id
      and s.method = ${method}
      and s.digit_count = ${digitCount}
    where p.market_id in (
      select jsonb_array_elements_text(${JSON.stringify(marketIds)}::jsonb)
    )
      and p.target_2d = ${target2D}
      and p.engine_version = ${engineVersion}
      and p.config_version = ${configVersion}
      and p.status = 'pending'
      and p.snapshot_complete is true
      and p.selection_count = 18
      and (
        select count(*)
        from adaptive.published_selections publication
        where publication.prediction_id = p.id
      ) = 18
    order by p.market_id, p.history_length desc, p.created_at desc
  `;

  return json({ snapshots: rows });
}
