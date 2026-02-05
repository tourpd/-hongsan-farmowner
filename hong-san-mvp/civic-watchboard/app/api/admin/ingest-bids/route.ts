// app/api/admin/ingest-bids/route.ts
import { NextResponse } from "next/server";
import { Pool } from "pg";

function getDatabaseUrlOrThrow() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) throw new Error("DATABASE_URL missing");
  return raw;
}

function requireAdmin(req: Request) {
  const want = process.env.ADMIN_TOKEN?.trim();
  const got = req.headers.get("x-admin-token")?.trim();
  if (!want || !got || want !== got) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
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

async function getTenderColumns(client: any) {
  const q = `
    select column_name
    from information_schema.columns
    where table_schema='public' and table_name='tenders'
    order by ordinal_position
  `;
  const r = await client.query(q);
  return r.rows.map((x: any) => x.column_name as string);
}

function extractBidsArray(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data?.items)) return payload.data.items;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

/**
 * ✅ /api/bids(items) 구조에 "정확히" 맞춘 매핑
 * items 예:
 * { bidNtceDt, ntceInsttNm, bidNtceNm, bidNtceNo, bidNtceOrd, bids_scope }
 *
 * ⚠️ 중요:
 * - tenders.id 는 uuid (DB default gen_random_uuid()) 이므로 절대 set 하지 않음
 * - upsert 키는 bid_no (UNIQUE)
 */
function mapBidToTenderRow(bid: any, cols: string[]) {
  const row: Record<string, any> = {};

  const set = (col: string, val: any) => {
    if (!cols.includes(col)) return;
    if (val === undefined || val === null || val === "") return;
    row[col] = val;
  };

  const bidNo = bid?.bidNtceNo ? String(bid.bidNtceNo).trim() : "";
  if (!bidNo) return row;

  // ✅ UNIQUE 키
  set("bid_no", bidNo);

  // ✅ 제목/기관/일자
  set("title", bid?.bidNtceNm ? String(bid.bidNtceNm) : "");

  // agency 컬럼이 있다면: 일단 수요기관/공고기관 중 하나로 채움(데이터 품질은 추후 개선)
  set("agency", bid?.ntceInsttNm ? String(bid.ntceInsttNm) : "");

  set("demand_org", bid?.ntceInsttNm ? String(bid.ntceInsttNm) : "");

  // announced_at: DB가 date 타입이면 "YYYY-MM-DD"로 넣는 게 안전
  const dt = bid?.bidNtceDt ? String(bid.bidNtceDt) : "";
  const ymd = dt ? dt.slice(0, 10) : "";
  set("announced_at", ymd);

  // budget은 더미에 없어서 미셋

  if (cols.includes("raw")) set("raw", bid);

  return row;
}

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  const url = new URL(req.url);
  const tab = url.searchParams.get("tab") ?? "city";
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));

  const pool = getPool();
  const client = await pool.connect();

  try {
    const cols = await getTenderColumns(client);

    // ✅ bid_no 유니크 인덱스/제약을 만들었으므로 conflict 키를 bid_no로 고정
    const keyCol = "bid_no";
    if (!cols.includes(keyCol)) {
      throw new Error("tenders table must have bid_no column (unique) to ingest");
    }

    const res = await fetch(
      `${url.origin}/api/bids?tab=${encodeURIComponent(tab)}&limit=${limit}`,
      { cache: "no-store" }
    );
    const payload = await res.json();
    const bids = extractBidsArray(payload);

    let upserted = 0;
    let skippedNoKey = 0;

    for (const b of bids) {
      const row = mapBidToTenderRow(b, cols);

      if (!row[keyCol]) {
        skippedNoKey++;
        continue;
      }

      const rowCols = Object.keys(row).filter((c) => cols.includes(c));
      if (rowCols.length === 0) continue;

      const placeholders = rowCols.map((_, i) => `$${i + 1}`).join(", ");
      const values = rowCols.map((c) => row[c]);

      // ✅ upsert 시 keyCol 제외 나머지 컬럼 업데이트
      const setCols = rowCols.filter((c) => c !== keyCol);
      const setClause =
        setCols.length === 0
          ? "do nothing"
          : "do update set " + setCols.map((c) => `${c}=excluded.${c}`).join(", ");

      const q = `
        insert into tenders (${rowCols.join(", ")})
        values (${placeholders})
        on conflict (${keyCol})
        ${setClause}
      `;

      await client.query(q, values);
      upserted++;
    }

    return NextResponse.json({
      ok: true,
      tab,
      limit,
      uniqueKey: keyCol,
      fetched: bids.length,
      upserted,
      skippedNoKey,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}