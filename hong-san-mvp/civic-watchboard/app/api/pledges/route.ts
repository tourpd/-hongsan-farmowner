// app/api/pledges/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PledgeRow = {
  pledge_id: string;
  term: string | null;
  mayor: string | null;
  title: string;
  category: string | null;
  status: string | null;
  progress: number | null;
  owner_dept: string | null;
  summary: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type NextCursor = {
  cursorUpdatedAt: string | null;
  cursorPledgeId: string;
};

type ApiOk = {
  ok: true;
  startedAt: string;
  filters: { term: string | null; mayor: string | null; q: string | null };
  total: number;
  data: PledgeRow[];
  nextCursor: NextCursor | null;
  note: string;
};

type ApiFail = {
  ok: false;
  error: string;
};

function getAdminSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    throw new Error(
      "Missing env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  const startedAt = new Date().toISOString();

  try {
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(req.url);

    const term = searchParams.get("term");
    const mayor = searchParams.get("mayor");
    const q = searchParams.get("q");

    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") ?? "20"), 1),
      100
    );

    const cursorUpdatedAt = searchParams.get("cursorUpdatedAt"); // string | null
    const cursorPledgeId = searchParams.get("cursorPledgeId"); // string | null

    // ---- base query
    let query = supabase
      .from("pledges")
      .select(
        "pledge_id, term, mayor, title, category, status, progress, owner_dept, summary, created_at, updated_at",
        { count: "exact" }
      )
      .order("updated_at", { ascending: false })
      .order("pledge_id", { ascending: false })
      .limit(limit);

    // ---- filters
    if (term && term.trim()) query = query.eq("term", term.trim());
    if (mayor && mayor.trim()) query = query.eq("mayor", mayor.trim());

    // 검색(간단 버전): title/category/summary에서 부분일치
    if (q && q.trim()) {
      const qq = q.trim();
      // or()는 "col.ilike.%x%,col2.ilike.%x%" 형식
      query = query.or(
        `title.ilike.%${qq}%,category.ilike.%${qq}%,summary.ilike.%${qq}%`
      );
    }

    // ---- cursor pagination (updated_at desc, pledge_id desc)
    // 다음 페이지: (updated_at < cursorUpdatedAt) OR (updated_at = cursorUpdatedAt AND pledge_id < cursorPledgeId)
    if (cursorPledgeId) {
      if (cursorUpdatedAt && cursorUpdatedAt !== "null") {
        query = query.or(
          `and(updated_at.lt.${cursorUpdatedAt}),and(updated_at.eq.${cursorUpdatedAt},pledge_id.lt.${cursorPledgeId})`
        );
      } else {
        // updated_at이 null일 수도 있으니, 최소한 pledge_id로만 내림차순 페이징
        query = query.lt("pledge_id", cursorPledgeId);
      }
    }

    const res = await query;

    if (res.error) {
      return NextResponse.json<ApiFail>(
        { ok: false, error: res.error.message },
        { status: 500 }
      );
    }

    const rows = (res.data ?? []) as PledgeRow[];
    const total = res.count ?? rows.length;

    const last = rows.length ? rows[rows.length - 1] : null;
    const nextCursor: NextCursor | null = last
      ? {
          cursorUpdatedAt: last.updated_at ?? null,
          cursorPledgeId: last.pledge_id,
        }
      : null;

    return NextResponse.json<ApiOk>({
      ok: true,
      startedAt,
      filters: { term: term ?? null, mayor: mayor ?? null, q: q ?? null },
      total,
      data: rows,
      nextCursor,
      note: "Pledges list (cursor: updated_at desc, pledge_id desc).",
    });
  } catch (e: any) {
    return NextResponse.json<ApiFail>(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}