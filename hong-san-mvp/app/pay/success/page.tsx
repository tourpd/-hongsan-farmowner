// app/pay/success/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import SuccessClient from "./successClient";

export const dynamic = "force-dynamic"; // 쿼리스트링/클라이언트 훅 기반 페이지는 동적이 안전
export const revalidate = 0;            // 캐시/프리렌더 방지(빌드 안정)

export default function PaySuccessPage() {
  return (
    <div className="container" style={{ padding: 18 }}>
      <div
        className="card"
        style={{
          background: "#fff",
          border: "1px solid rgba(17,24,39,.08)",
          borderRadius: 18,
          padding: 16,
          maxWidth: 720,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <h2 style={{ margin: 0, fontWeight: 950 }}>신청이 저장되었습니다</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/" className="btn btnGhost">홈</Link>
            <Link href="/pay" className="btn btnGhost">참여 신청</Link>
          </div>
        </div>

        <p style={{ marginTop: 10, color: "rgba(107,114,128,.95)", lineHeight: 1.6 }}>
          아래 정보는 확인용입니다. <b>실제 접수/연락은 관리자 화면</b>에 저장된 내용을 기준으로 진행합니다.
        </p>

        <Suspense
          fallback={
            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 14,
                background: "rgba(17,24,39,.03)",
                border: "1px solid rgba(17,24,39,.08)",
              }}
            >
              불러오는 중…
            </div>
          }
        >
          <SuccessClient />
        </Suspense>

        <div style={{ marginTop: 14, fontSize: 12, color: "rgba(107,114,128,.95)" }}>
          ※ 안내 메시지는 상황에 따라 변경될 수 있습니다.
        </div>
      </div>
    </div>
  );
}