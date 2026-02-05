// app/api/admin/ingest-bids/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function isDateOnly(v: any): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

type TenderRowIn = {
  bid_no: string;
  title?: string | null;
  agency?: string | null;
  demand_org?: string | null;
  announced_at?: string | null; // YYYY-MM-DD
  budget?: number | null;
  base_amount?: number | null;
  estimated_price?: number | null;
  bid_ntce_no?: string | null;
  bid_ntce_ord?: string | null;
  source?: string | null;
  scope?: string | null;
  source_key?: string | null;
  raw?: any;
};

function normalizeRow(x: any): any | null {
  if (!x || typeof x !== "object") return null;
  if (!x.bid_no || typeof x.bid_no !== "string") return null;

  const announced_at =
    x.announced_at == null ? null : isDateOnly(x.announced_at) ? x.announced_at : null;

  return {
    bid_no: x.bid_no,
    title: x.title ?? null,
    agency: x.agency ?? null,
    demand_org: x.demand_org ?? null,
    announced_at,
    budget: x.budget ?? null,
    base_amount: x.base_amount ?? null,
    estimated_price: x.estimated_price ?? null,
    bid_ntce_no: x.bid_ntce_no ?? null,
    bid_ntce_ord: x.bid_ntce_ord ?? null,
    source: x.source ?? "manual_ingest",
    scope: x.scope ?? null,
    source_key: x.source_key ?? null,
    raw: x.raw ?? x, // 원본 보관
    updated_at: new Date().toISOString(),
  };
}

/**
 * POST /api/admin/ingest-bids
 * Body:
 * {
 *   "rows": [ { ...TenderRowIn }, ... ],
 *   "onConflict": "bid_no" // optional
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = mustGetEnv("SUPABASE_URL");
    const supabaseKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => null);
    const rowsIn = body?.rows;

    if (!Array.isArray(rowsIn) || rowsIn.length === 0) {
      return NextResponse.json({ ok: false, error: "Body.rows must be a non-empty array" }, { status: 400 });
    }

    const onConflict = typeof body?.onConflict === "string" ? body.onConflict : "bid_no";

    const rows = rowsIn
      .map(normalizeRow)
      .filter(Boolean) as any[];

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: "No valid rows after normalization" }, { status: 400 });
    }

    const { error } = await supabase.from("tenders").upsert(rows, { onConflict });

    if (error) {
      return NextResponse.json(
        { ok: false, stage: "upsert", error: error.message, hint: (error as any).hint ?? null },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      received: rowsIn.length,
      upserted: rows.length,
      note: `Upserted into public.tenders onConflict=${onConflict}`,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}