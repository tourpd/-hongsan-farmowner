// app/api/bids/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function must(name: string) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function mask(v: string) {
  if (!v) return v;
  if (v.length <= 10) return "***";
  return v.slice(0, 6) + "..." + v.slice(-4);
}

export async function GET(req: NextRequest) {
  const startedAt = new Date().toISOString();

  try {
    const url = must("SUPABASE_URL");
    const key = must("SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(url, key, {
      auth: { persistSession: false },
    });

    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Number(sp.get("limit") ?? 20), 100);
    const cityOnly = (sp.get("scope") ?? "all") === "city"; // city|all

    // 🔎 최소 필드만: 화면용
    // NOTE: bid_ntce_no / bid_ntce_ord 컬럼이 있으면 상세 페이지 링크에도 활용 가능
    let q = supabase
      .from("tenders")
      .select(
        "bid_no,title,agency,demand_org,announced_at,budget,base_amount,estimated_price,bid_ntce_no,bid_ntce_ord,source,scope,source_key"
      )
      .order("announced_at", { ascending: false })
      .limit(limit);

    if (cityOnly) {
      q = q.eq("scope", "CITY");
    }

    const { data, error } = await q;

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          stage: "supabase_select_error",
          message: error.message,
          details: error.details ?? null,
          hint: error.hint ?? null,
          startedAt,
          envCheck: {
            SUPABASE_URL: true,
            SUPABASE_SERVICE_ROLE_KEY: true,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      startedAt,
      count: data?.length ?? 0,
      data: data ?? [],
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        stage: "exception",
        message: e?.message ?? String(e),
        name: e?.name ?? "Error",
        stackTop: String(e?.stack ?? "").split("\n").slice(0, 6).join("\n"),
        startedAt,
        envMasked: {
          SUPABASE_URL: mask(process.env.SUPABASE_URL ?? ""),
          SUPABASE_SERVICE_ROLE_KEY: mask(process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""),
        },
      },
      { status: 500 }
    );
  }
}