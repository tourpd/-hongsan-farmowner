// app/api/pledges/[id]/actions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  return createClient(url, key, { auth: { persistSession: false } });
}

function pickFirstIp(xff?: string | null) {
  if (!xff) return "";
  return xff.split(",")[0]?.trim() ?? "";
}

function actorHashFromRequest(req: NextRequest) {
  const ip =
    pickFirstIp(req.headers.get("x-forwarded-for")) ||
    req.headers.get("x-real-ip") ||
    "";
  const ua = req.headers.get("user-agent") || "";
  const salt = process.env.ACTOR_HASH_SALT || "CHANGE_ME_SALT";
  const raw = `${salt}::${ip}::${ua}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

type Body = {
  action_type: string; // e.g. "WATCHING" | "AGREE" | "DISAGREE" | "IMPORTANT" | ...
  payload?: any; // optional json
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const supabase = getAdminClient();

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body?.action_type || typeof body.action_type !== "string") {
      return NextResponse.json({ ok: false, error: "action_type is required" }, { status: 400 });
    }

    const action_type = body.action_type.trim().toUpperCase();
    if (!action_type) {
      return NextResponse.json({ ok: false, error: "action_type is empty" }, { status: 400 });
    }

    const actor_hash = actorHashFromRequest(req);

    // citizen_once_per_day unique index가 여기서 “하루 1회”를 막아줌
    const ins = await supabase
      .from("citizen_actions")
      .insert({
        pledge_id: id,
        action_type,
        actor_hash,
        payload: body.payload ?? null,
      })
      .select("id, created_at")
      .single();

    if (ins.error) {
      // Supabase(PostgREST) 에러 메시지에 unique 제약이 포함되는 경우가 흔함
      const msg = ins.error.message || "";
      const isDup =
        msg.toLowerCase().includes("duplicate") ||
        msg.toLowerCase().includes("unique") ||
        msg.toLowerCase().includes("citizen_once_per_day");

      if (isDup) {
        return NextResponse.json(
          { ok: false, error: "오늘은 이미 참여하셨습니다. (하루 1회 제한)" },
          { status: 409 }
        );
      }
      throw ins.error;
    }

    return NextResponse.json({
      ok: true,
      inserted: ins.data,
      note: "Citizen action recorded (v1).",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}