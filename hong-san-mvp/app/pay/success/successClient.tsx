// app/pay/success/successClient.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export default function SuccessClient() {
  const sp = useSearchParams();

  const data = useMemo(() => {
    const pledgeId = sp.get("pledgeId") || "";
    const type = sp.get("type") || "";
    const amount = sp.get("amount") || "";
    const name = sp.get("name") || "";
    return { pledgeId, type, amount, name };
  }, [sp]);

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ padding: 12, borderRadius: 14, border: "1px solid rgba(17,24,39,.10)", background: "rgba(17,24,39,.02)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", rowGap: 8 }}>
          <div style={{ color: "rgba(107,114,128,.95)" }}>문서ID</div>
          <div>{data.pledgeId ? <code>{data.pledgeId}</code> : "-"}</div>

          <div style={{ color: "rgba(107,114,128,.95)" }}>선택</div>
          <div style={{ fontWeight: 900 }}>{data.type || "-"}</div>

          <div style={{ color: "rgba(107,114,128,.95)" }}>금액</div>
          <div style={{ fontWeight: 900 }}>{data.amount ? `${Number(data.amount).toLocaleString()}원` : "-"}</div>

          <div style={{ color: "rgba(107,114,128,.95)" }}>이름</div>
          <div style={{ fontWeight: 900 }}>{data.name || "-"}</div>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "rgba(107,114,128,.95)" }}>
          ※ 이 화면은 “확인용”입니다. 실제 관리는 관리자 페이지에서 진행합니다.
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <Link className="btn btnGhost" href="/pay">
          참여 신청으로 돌아가기
        </Link>
        <Link className="btn btnGhost" href="/">
          홈
        </Link>
      </div>
    </div>
  );
}