// app/api/admin/pledges/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireAdmin(req: Request) {
  const env = process.env.ADMIN_TOKEN || "";
  const token = req.headers.get("x-admin-token") || "";
  if (!env) return { ok: false, status: 500, error: "ADMIN_TOKEN missing in env" as const };
  if (!token || token !== env) return { ok: false, status: 401, error: "UNAUTHORIZED" as const };
  return { ok: true as const };
}

function toPlain(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const d = doc.data() as any;
  return {
    id: doc.id,
    ...d,
    createdAt: d?.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d?.createdAt ?? null,
    updatedAt: d?.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : d?.updatedAt ?? null,
    adminUpdatedAt: d?.adminUpdatedAt?.toDate ? d.adminUpdatedAt.toDate().toISOString() : d?.adminUpdatedAt ?? null,
  };
}

/**
 * GET  /api/admin/pledges
 *  - 목록 (createdAt desc)
 * PATCH /api/admin/pledges
 *  - adminMemo 저장 / status 변경 / flags 저장
 */
export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || "200"), 500);

  const db = adminDb();

  // 최신순 목록
  const snap = await db
    .collection("pledges")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  const rows = snap.docs.map(toPlain);

  return NextResponse.json({ ok: true, rows });
}

export async function PATCH(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => null)) as any;
  if (!body?.id) {
    return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  }

  const id = String(body.id);
  const patch: any = {};

  // 관리자 메모(연락 기록)
  if (typeof body.adminMemo === "string") patch.adminMemo = body.adminMemo;

  // 상태 변경: PENDING / CONFIRMED / DONE 등
  if (typeof body.status === "string") patch.status = body.status;

  // 추가 플래그 (예: 입금확인, 연락완료)
  if (body.flags && typeof body.flags === "object") patch.flags = body.flags;

  patch.adminUpdatedAt = FieldValue.serverTimestamp();

  const db = adminDb();
  await db.collection("pledges").doc(id).set(patch, { merge: true });

  return NextResponse.json({ ok: true });
}