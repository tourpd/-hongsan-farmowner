// app/api/admin/enrich-budgets/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// detail 오퍼레이션은 프로젝트마다 다를 수 있어, 일단 "raw에서 budget/base_amount를 뽑는 1차 보강"을 먼저 합니다.
// 그리고 2차로 OpenAPI detail/amount 오퍼레이션을 붙이는 형태가 안전합니다.
function parseNumber(x: any): number | null {
  if (x === null || x === undefined) return null;
  const s = String(x).replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * raw JSON에서 기초금액/예정가격 후보 필드를 최대한 넓게 탐색
 * (나라장터 응답이 오퍼레이션별로 키가 달라서 "후보군"을 잡아야 실전에서 잘 버팁니다)
 */
function extractBudgetFromRaw(raw: any): {
  base_amount?: number | null;
  estimated_price?: number | null;
  budget?: number | null;
} {
  if (!raw || typeof raw !== "object") return {};

  // 후보 키들
  const base =
    parseNumber(raw.bscAmt) ??
    parseNumber(raw.bscamt) ??
    parseNumber(raw.baseAmt) ??
    parseNumber(raw.baseamt) ??
    parseNumber(raw.base_amount) ??
    null;

  const est =
    parseNumber(raw.presmptPrce) ??
    parseNumber(raw.presmptprce) ??
    parseNumber(raw.estmtdAmt) ??
    parseNumber(raw.estmtdamt) ??
    parseNumber(raw.estimated_price) ??
    null;

  // 프로젝트의 tenders에는 budget 컬럼이 이미 있으니,
  // budget = base_amount 우선, 없으면 estimated_price로 fallback(임시)
  const budget = base ?? est ?? null;

  return { base_amount: base, estimated_price: est, budget };
}

export async function POST() {
  try {
    const supabaseUrl = must("SUPABASE_URL");
    const serviceRole = must("SUPABASE_SERVICE_ROLE_KEY");
    // OpenAPI를 2차로 붙일 거라 key는 지금 단계에서는 "존재 검증만" 합니다.
    // (없으면 여기서 바로 잡히게)
    must("DATA_GO_KR_SERVICE_KEY");

    const supabase = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    // base_amount가 비어있거나 budget이 비어있는 레코드만 가져옴 (최대 50개)
    const { data, error } = await supabase
      .from("tenders")
      .select("id, bid_no, raw, budget, base_amount, estimated_price")
      .or("base_amount.is.null,budget.is.null")
      .limit(50);

    if (error) {
      return NextResponse.json(
        { ok: false, stage: "select", error: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ ok: true, message: "nothing to enrich" });
    }

    let updated = 0;
    const updatedBidNos: string[] = [];

    for (const row of data) {
      const derived = extractBudgetFromRaw(row.raw);

      // 아무것도 못 뽑으면 스킵
      if (
        derived.base_amount === null &&
        derived.estimated_price === null &&
        derived.budget === null
      ) {
        continue;
      }

      // 이미 값이 있으면 덮어쓰지 않음(보수적)
      const patch: any = {};
      if (row.base_amount == null && derived.base_amount != null)
        patch.base_amount = derived.base_amount;
      if (row.estimated_price == null && derived.estimated_price != null)
        patch.estimated_price = derived.estimated_price;
      if (row.budget == null && derived.budget != null) patch.budget = derived.budget;

      if (Object.keys(patch).length === 0) continue;

      const { error: uerr } = await supabase
        .from("tenders")
        .update(patch)
        .eq("id", row.id);

      if (uerr) {
        return NextResponse.json(
          { ok: false, stage: "update", bid_no: row.bid_no, error: uerr.message },
          { status: 500 }
        );
      }

      updated++;
      updatedBidNos.push(row.bid_no);
    }

    return NextResponse.json({
      ok: true,
      processed: data.length,
      updated,
      updatedBidNos,
      note:
        "Step1: enriched from tenders.raw -> (base_amount/estimated_price/budget). Next: add OpenAPI detail call using bid_ntce_no/bid_ntce_ord.",
    });
  } catch (e: any) {
    // ✅ 이제부터는 500이어도 바디에 에러 원인이 반드시 나옵니다.
    return NextResponse.json(
      {
        ok: false,
        stage: "exception",
        message: e?.message ?? String(e),
        name: e?.name,
        stackTop: (e?.stack ?? "").split("\n").slice(0, 8).join("\n"),
        envCheck: {
          SUPABASE_URL: !!process.env.SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          DATA_GO_KR_SERVICE_KEY: !!process.env.DATA_GO_KR_SERVICE_KEY,
        },
      },
      { status: 500 }
    );
  }
}