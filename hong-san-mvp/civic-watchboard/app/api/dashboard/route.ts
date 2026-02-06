// app/api/dashboard/route.ts
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

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = mustGetEnv("SUPABASE_URL");
    const supabaseKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const { searchParams } = new URL(req.url);
    const debug = searchParams.get("debug") === "1";

    const term = searchParams.get("term");   // 예: 2022-2026
    const mayor = searchParams.get("mayor"); // 예: 이동환

    // 1) pledges 요약
    let pledgesQ = supabase
      .from("pledges")
      .select("pledge_id, status, progress", { count: "exact" });

    if (term) pledgesQ = pledgesQ.eq("term", term);
    if (mayor) pledgesQ = pledgesQ.eq("mayor", mayor);

    const pledgesRes = await pledgesQ;
    if (pledgesRes.error) {
      return NextResponse.json(
        { ok: false, stage: "pledges", error: pledgesRes.error.message },
        { status: 500 }
      );
    }

    const pledges = pledgesRes.data ?? [];
    const total = pledges.length;

    const byStatus: Record<string, number> = {};
    let sumProgress = 0;

    for (const p of pledges) {
      const s = (p as any).status ?? "UNKNOWN";
      byStatus[s] = (byStatus[s] ?? 0) + 1;
      sumProgress += Number((p as any).progress ?? 0);
    }

    const avgProgress = total ? Math.round((sumProgress / total) * 10) / 10 : 0;

    // 2) 최신 업데이트 N개
    const updatesLimit = Math.min(toInt(searchParams.get("updatesLimit"), 20), 100);

    const updatesRes = await supabase
      .from("pledge_updates")
      .select("id, pledge_id, update_date, note, progress_delta, created_at")
      .order("update_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(updatesLimit);

    if (updatesRes.error) {
      return NextResponse.json(
        { ok: false, stage: "updates", error: updatesRes.error.message },
        { status: 500 }
      );
    }

    // 3) 증거 링크 totalCount(간단)
    const evRes = await supabase
      .from("pledge_evidence")
      .select("id", { count: "exact", head: true });

    if (evRes.error) {
      return NextResponse.json(
        { ok: false, stage: "evidence", error: evRes.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      startedAt: new Date().toISOString(),
      filters: { term: term ?? null, mayor: mayor ?? null },
      pledges: { total, byStatus, avgProgress },
      activity: { latestUpdates: updatesRes.data ?? [] },
      evidence: { total: evRes.count ?? 0 },
      note: "Dashboard summary (v1).",
      ...(debug ? { debug: { envOk: true } } : {}),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
