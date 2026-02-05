// app/admin/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: 18, fontFamily: "system-ui" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 14,
          borderRadius: 18,
          background: "#fff",
          border: "1px solid rgba(17,24,39,.08)",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 950 }}>관리자</div>
          <div style={{ marginTop: 6, fontSize: 13, color: "rgba(107,114,128,.95)" }}>
            토큰은 브라우저에만 저장되고, API 호출 시 헤더로 전달됩니다.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/" className="btn btnGhost">홈</Link>
          <Link href="/pay" className="btn btnGhost">참여 신청</Link>
          <Link href="/admin/pledges" className="btn btnGhost">접수 목록</Link>
          <Link href="/admin/login" className="btn btnGhost">토큰 설정</Link>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}