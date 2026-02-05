// app/api/pledges/create/route.ts
import { NextResponse } from "next/server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ✅ 타입 정의(금액의 의미를 분리)
 * - INDIVIDUAL_* : 계좌이체 "참여금"
 * - PARTNER_*    : 기업/사업자 "협업 신청" (돈 받는 구조가 아니라 '우리가 제공하는 협업 패키지'를 명시)
 */
const TYPE_META: Record<
  string,
  { kind: "PAY" | "COLLAB"; amount: number; label: string }
> = {
  INDIVIDUAL_50: { kind: "PAY", amount: 200_000, label: "홍산마늘 밭 50평 참여" },
  INDIVIDUAL_100: { kind: "PAY", amount: 350_000, label: "홍산마늘 밭 100평 참여" },

  // ✅ 협업은 '가격'이 아니라 '제공 패키지'
  PARTNER_SOLO: { kind: "COLLAB", amount: 0, label: "개인 사업자(협업) 신청" },
  PARTNER_CORP_1: { kind: "COLLAB", amount: 0, label: "기업 협업 패키지 1회 제공" },
  PARTNER_CORP_2: { kind: "COLLAB", amount: 0, label: "기업 협업 패키지 2회 제공" },
};

function initAdmin() {
  if (getApps().length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin env missing.");
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

function badRequest(message: string, extra?: any) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status: 400 });
}

export async function POST(req: Request) {
  try {
    initAdmin();
    const db = getFirestore();

    const body = await req.json().catch(() => null);
    if (!body) return badRequest("JSON 바디가 비어있습니다.");

    const type = String(body.type || "").trim();
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const memo = String(body.memo || "").trim();

    const wants = Array.isArray(body.wants) ? body.wants.map((x: any) => String(x)) : [];
    const address = String(body.address || "").trim();
    const supportType = String(body.supportType || "").trim(); // 기업/사업자: 현물/현금/협의
    const idempotencyKey = String(body.idempotencyKey || "").trim();

    if (!type) return badRequest("type이 없습니다.");
    const meta = TYPE_META[type];
    if (!meta) {
      return badRequest("알 수 없는 type입니다.", {
        allowedTypes: Object.keys(TYPE_META),
        receivedType: type,
      });
    }

    if (!name) return badRequest("이름(name)이 없습니다.");
    if (!phone) return badRequest("휴대폰(phone)이 없습니다.");

    const normalizedPhone = phone.replace(/[^0-9]/g, "");
    if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
      return badRequest("휴대폰 번호 형식이 이상합니다. 숫자 10~11자리로 입력해 주세요.");
    }

    // ✅ 개인 참여(PAY)인 경우: 주소를 받도록(배송/서류/연락용)
    if (meta.kind === "PAY" && !address) {
      return badRequest("주소(address)가 없습니다.");
    }

    // ✅ 협업(COLLAB)인 경우: 지원 방식은 최소 안내
    if (meta.kind === "COLLAB" && !supportType) {
      return badRequest("협업 지원 방식(supportType: 현물/현금/협의)이 필요합니다.");
    }

    const doc = {
      type,
      typeLabel: meta.label,
      kind: meta.kind, // PAY | COLLAB
      amount: meta.amount, // PAY면 참여금, COLLAB면 0
      name,
      phone: normalizedPhone,
      memo: memo || "",
      wants, // ["FIELD_VISIT", "PICKUP", "PROCESSING", "SEED"] 등
      address: address || "",
      supportType: supportType || "",
      status: meta.kind === "PAY" ? ("PENDING_TRANSFER" as const) : ("LEAD" as const),
      idempotencyKey: idempotencyKey || "",
      createdAt: FieldValue.serverTimestamp(),
    };

    const ref = await db.collection("pledges").add(doc);

    return NextResponse.json({
      ok: true,
      pledgeId: ref.id,
      status: doc.status,
      type: doc.type,
      kind: doc.kind,
      amount: doc.amount,
    });
  } catch (err: any) {
    console.error("[pledges/create] error:", err);
    return NextResponse.json({ ok: false, error: err?.message || "서버 오류" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Method Not Allowed" }, { status: 405 });
}