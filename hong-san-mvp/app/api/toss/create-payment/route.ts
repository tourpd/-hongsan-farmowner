import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { orderId, amount, customerName } = await req.json();

    if (!orderId || !amount) {
      return NextResponse.json(
        { message: "orderId, amount가 필요합니다." },
        { status: 400 }
      );
    }

    const clientKey = process.env.TOSS_CLIENT_KEY;
    if (!clientKey) {
      return NextResponse.json(
        { message: "환경변수 TOSS_CLIENT_KEY가 없습니다." },
        { status: 500 }
      );
    }

    // ✅ 현재 도메인(origin) 자동 감지
    const origin = new URL(req.url).origin;

    // ✅ 프론트가 기대하는 키 이름: checkoutUrl
    const checkoutUrl =
      `https://pay.toss.im/payments?clientKey=${encodeURIComponent(clientKey)}` +
      `&orderId=${encodeURIComponent(orderId)}` +
      `&orderName=${encodeURIComponent("홍산마늘 1농가 1가족")}` +
      `&amount=${encodeURIComponent(String(amount))}` +
      `&customerName=${encodeURIComponent(customerName || "고객")}` +
      `&successUrl=${encodeURIComponent(origin + "/pay/success")}` +
      `&failUrl=${encodeURIComponent(origin + "/pay/fail")}`;

    return NextResponse.json({ ok: true, checkoutUrl });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "create-payment failed" },
      { status: 500 }
    );
  }
}