// app/admin/login/set/route.ts
import { NextResponse } from "next/server";

const ADMIN_COOKIE = "hs_admin";

export async function POST(req: Request) {
  const envToken = process.env.ADMIN_TOKEN || "";
  if (!envToken) {
    return NextResponse.json({ ok: false, error: "ADMIN_TOKEN이 .env.local에 없습니다." }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const token = String(body?.token || "").trim();

  if (!token) return NextResponse.json({ ok: false, error: "token이 비었습니다." }, { status: 400 });
  if (token !== envToken) return NextResponse.json({ ok: false, error: "토큰이 일치하지 않습니다." }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}