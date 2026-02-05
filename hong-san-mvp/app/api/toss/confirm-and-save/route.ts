// app/api/toss/confirm-and-save/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const secretKey = process.env.TOSS_SECRET_KEY;

    const body = await req.json();
    const { pledgeId, paymentKey, orderId, amount } = body as {
      pledgeId: string;
      paymentKey: string;
      orderId: string;
      amount: number;
    };

    if (!pledgeId) {
      return NextResponse.json({ ok: false, error: "pledgeId가 없습니다." }, { status: 400 });
    }

    // ✅ 심사 전이면 여기서 막고 "보류"로 처리
    if (!secretKey || secretKey.includes("여기에_") || secretKey.startsWith("test_sk_여기에")) {
      return NextResponse.json(
        {
          ok: false,
          error: "토스 심사/시크릿키 준비 전입니다. 현재는 참여 신청 저장(PENDING)까지만 가능합니다.",
        },
        { status: 501 }
      );
    }

    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json(
        { ok: false, error: "paymentKey/orderId/amount가 필요합니다." },
        { status: 400 }
      );
    }

    // ✅ Toss 결제 승인(Confirm)
    const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(secretKey + ":").toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: "토스 confirm 실패", detail: data },
        { status: 400 }
      );
    }

    // ✅ Firestore 업데이트
    const db = adminDb();
    await db.collection("pledges").doc(pledgeId).set(
      {
        status: "PAID",
        paidAt: new Date().toISOString(),
        payment: {
          paymentKey,
          orderId,
          amount,
          method: data.method || null,
          status: data.status || null,
          approvedAt: data.approvedAt || null,
        },
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, status: "PAID" });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "서버 오류" },
      { status: 500 }
    );
  }
}