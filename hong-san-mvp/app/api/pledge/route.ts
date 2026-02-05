import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PledgeType = "PERSONAL" | "CORP";

type PledgeBody = {
  customerName: string;
  phone: string;
  pledgeType: PledgeType;
  planCode: string; // e.g. P50, P100, P_FINISH, C_500, C_1000
  amount: number;
  memo?: string;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<PledgeBody>;

    const customerName = (body.customerName || "").trim();
    const phone = (body.phone || "").trim();
    const pledgeType = body.pledgeType;
    const planCode = (body.planCode || "").trim();
    const amount = Number(body.amount);

    if (!customerName) return bad("customerName이 필요합니다.");
    if (!phone) return bad("phone이 필요합니다.");
    if (pledgeType !== "PERSONAL" && pledgeType !== "CORP") return bad("pledgeType이 올바르지 않습니다.");
    if (!planCode) return bad("planCode가 필요합니다.");
    if (!Number.isFinite(amount) || amount < 1000) return bad("amount가 올바르지 않습니다.");

    const db = adminDb();

    const now = new Date();
    const doc = {
      customerName,
      phone,
      pledgeType,
      planCode,
      amount,
      memo: (body.memo || "").toString().slice(0, 500),
      status: "PENDING", // PENDING -> PAID(결제 성공 후) 로 업데이트 예정
      createdAt: now,
      updatedAt: now,

      // 나중에 결제 붙일 때 채울 필드(미리 만들어 둠)
      toss: {
        orderId: null,
        paymentKey: null,
        method: null,
        approvedAt: null,
      },
      source: {
        app: "hong-san-mvp",
        route: "/pay",
      },
    };

    const ref = await db.collection("pledges").add(doc);

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e: any) {
    console.error("pledge POST error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "server error" },
      { status: 500 }
    );
  }
}