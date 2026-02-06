// app/api/pledges/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getEnv() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return { url, serviceKey };
}

function supabaseAdmin() {
  const { url, serviceKey } = getEnv();
  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sb = supabaseAdmin();
    if (!sb) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing SUPABASE env (SUPABASE_URL(or NEXT_PUBLIC_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY)",
        },
        { status: 500 }
      );
    }

    const id = params?.id;
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing pledge id" },
        { status: 400 }
      );
    }

    // 1) pledge
    const pledgeRes = await sb
      .from("pledges")
      .select(
        "pledge_id, term, mayor, title, category, status, progress, owner_dept, summary, created_at, updated_at"
      )
      .eq("pledge_id", id)
      .maybeSingle();

    if (pledgeRes.error) throw pledgeRes.error;
    if (!pledgeRes.data) {
      return NextResponse.json(
        { ok: false, error: "Not found" },
        { status: 404 }
      );
    }

    // 2) updates
    const updatesRes = await sb
      .from("pledge_updates")
      .select("id, pledge_id, update_date, note, progress_delta, created_at")
      .eq("pledge_id", id)
      .order("update_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    if (updatesRes.error) throw updatesRes.error;

    // 3) evidence
    const evRes = await sb
      .from("pledge_evidence")
      .select("id, pledge_id, kind, title, url, published_at, created_at")
      .eq("pledge_id", id)
      .order("published_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    if (evRes.error) throw evRes.error;

    return NextResponse.json({
      ok: true,
      pledge: pledgeRes.data,
      updates: updatesRes.data ?? [],
      evidence: evRes.data ?? [],
      note: "Pledge detail (v1).",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}