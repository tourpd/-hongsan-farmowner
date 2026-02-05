import { NextResponse } from "next/server";
import { Pool } from "pg";

function mask(s: string) {
  const head = s.slice(0, 30);
  return `${head}...(len=${s.length})`;
}

function getDatabaseUrlOrThrow() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is missing in process.env. Check .env.local and restart next dev.");
  }
  const v = raw.trim();
  if (!v.startsWith("postgres://") && !v.startsWith("postgresql://")) {
    throw new Error(`DATABASE_URL must start with postgres:// or postgresql://. got=${mask(v)}`);
  }
  if (/\s/.test(v)) {
    throw new Error(`DATABASE_URL contains whitespace/newline. got=${mask(v)}`);
  }
  return v;
}

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function getPool() {
  if (global.__pgPool) return global.__pgPool;

  const pool = new Pool({
    connectionString: getDatabaseUrlOrThrow(),
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  global.__pgPool = pool;
  return pool;
}

export async function GET(req: Request) {
  try {
    const url = getDatabaseUrlOrThrow();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? "50")));

    const pool = getPool();
    const client = await pool.connect();
    try {
      // ✅ metrics_cache가 비어있으면 안내
      const countRes = await client.query(`select count(*)::int as n from metrics_cache`);
      const n = countRes.rows?.[0]?.n ?? 0;

      if (n === 0) {
        return NextResponse.json({
          ok: true,
          dbUrlMasked: mask(url),
          generatedAt: new Date().toISOString(),
          notice: "metrics_cache is empty. Insert policies/tenders and build matches, then compute metrics_cache.",
          data: { ranking: [] as any[] },
        });
      }

      // ✅ 랭킹: score 내림차순, 동일하면 total_budget, tender_count 순
      const q = `
        select
          p.id as policy_id,
          p.policy_name,
          coalesce(m.total_budget,0)::numeric as total_budget,
          coalesce(m.tender_count,0)::int as tender_count,
          m.last_activity,
          coalesce(m.score,0)::numeric as score,
          coalesce(m.strength,0)::numeric as strength,
          m.updated_at
        from metrics_cache m
        left join policies p on p.id = m.policy_id
        order by coalesce(m.score,0) desc, coalesce(m.total_budget,0) desc, coalesce(m.tender_count,0) desc
        limit $1
      `;
      const rows = (await client.query(q, [limit])).rows;

      return NextResponse.json({
        ok: true,
        dbUrlMasked: mask(url),
        generatedAt: new Date().toISOString(),
        data: { ranking: rows },
      });
    } finally {
      client.release();
    }
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
