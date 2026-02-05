// app/api/bids/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function toInt(v: string | null, def: number) {
  const n = Number(v ?? "");
  return Number.isFinite(n) ? n : def;
}

function safeDateOnly(v: string | null): string | null {
  if (!v) return null;
  // YYYY-MM-DD만 허용
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}

/**
 * Cursor pagination:
 * 정렬: announced_at desc, bid_no desc
 * 다음 페이지 조건:
 *   announced_at < cursorAnnouncedAt
 *   OR (announced_at = cursorAnnouncedAt AND bid_no < cursorBidNo)
 */
export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = mustGetEnv("SUPABASE_URL");
    const supabaseKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY"); // 서버에서만 사용

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const { searchParams } = new URL(req.url);

    const limit = Math.min(toInt(searchParams.get("limit"), 20), 200);

    // ✅ 기본은 g2b만 보여주기 (DUMMY/data.go.kr가 미래 날짜로 상단을 먹는 문제 방지)
    //    DUMMY를 보고 싶으면 ?source=data.go.kr 로 호출
    const source = searchParams.get("source") ?? "g2b_data_go_kr"; // 예: g2b_data_go_kr / data.go.kr / manual_ingest
    const scope = searchParams.get("scope"); // 예: CITY
    const q = searchParams.get("q"); // 검색어 (FTS 우선)

    // 커서
    const cursorAnnouncedAt = safeDateOnly(searchParams.get("cursorAnnouncedAt"));
    const cursorBidNo = searchParams.get("cursorBidNo");

    // FTS 옵션 (기본 on)
    const useFts = (searchParams.get("fts") ?? "1") !== "0";

    // 기본 select
    let query = supabase
      .from("tenders")
      .select(
        [
          "bid_no",
          "title",
          "agency",
          "demand_org",
          "announced_at",
          "budget",
          "base_amount",
          "estimated_price",
          "bid_ntce_no",
          "bid_ntce_ord",
          "source",
          "scope",
          "source_key",
          "updated_at",
        ].join(",")
      )
      .eq("source", source)
      .order("announced_at", { ascending: false, nullsFirst: false })
      .order("bid_no", { ascending: false })
      .limit(limit);

    if (scope) query = query.eq("scope", scope);

    // ✅ 커서 페이지네이션 조건
    if (cursorAnnouncedAt && cursorBidNo) {
      // Supabase "or" 사용: (announced_at.lt.X, and(announced_at.eq.X,bid_no.lt.Y))
      query = query.or(
        `announced_at.lt.${cursorAnnouncedAt},and(announced_at.eq.${cursorAnnouncedAt},bid_no.lt.${cursorBidNo})`
      );
    }

    // ✅ 검색: FTS 우선 (search_tsv 컬럼 필요), fallback은 ilike
    const keyword = q?.trim();
    if (keyword) {
      if (useFts) {
        // ⚠️ search_tsv(tsvector) 컬럼이 존재해야 합니다 (아래 SQL 1~2로 생성)
        // websearch는 공백 포함 자연어 검색에 비교적 편리
        query = query.textSearch("search_tsv", keyword, { type: "websearch" });
      } else {
        const like = `%${keyword}%`;
        query = query.or(
          `bid_no.ilike.${like},title.ilike.${like},agency.ilike.${like},demand_org.ilike.${like}`
        );
      }
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          stage: "select",
          error: error.message,
          hint:
            error.message.includes("search_tsv") || error.message.includes("text_search")
              ? "FTS(search_tsv) 컬럼/인덱스가 아직 없으면 fts=0으로 호출하거나, 아래 SQL 1~2를 먼저 실행하세요."
              : undefined,
        },
        { status: 500 }
      );
    }

    const rows = data ?? [];
    const last = rows.length ? rows[rows.length - 1] : null;

    return NextResponse.json({
      ok: true,
      startedAt: new Date().toISOString(),
      count: rows.length,
      data: rows,
      nextCursor: last
        ? {
            cursorAnnouncedAt: last.announced_at,
            cursorBidNo: last.bid_no,
          }
        : null,
      note:
        "Default source=g2b_data_go_kr. To see DUMMY/data.go.kr rows, call /api/bids?source=data.go.kr. Cursor pagination uses (announced_at desc, bid_no desc). FTS uses tenders.search_tsv.",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}