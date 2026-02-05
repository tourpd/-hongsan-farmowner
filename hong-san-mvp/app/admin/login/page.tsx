// app/admin/login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const ADMIN_TOKEN_KEY = "hs_admin_token";

export default function AdminLoginPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (t) setSaved(t);
  }, []);

  const save = () => {
    const t = token.trim();
    if (!t) return alert("ADMIN_TOKEN을 입력해 주세요.");
    localStorage.setItem(ADMIN_TOKEN_KEY, t);
    setSaved(t);
    setToken("");
    router.push("/admin/pledges");
  };

  const clear = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setSaved(null);
    alert("토큰을 삭제했습니다.");
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(17,24,39,.08)",
        borderRadius: 18,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 950 }}>관리자 토큰 설정</div>
      <div style={{ marginTop: 6, fontSize: 13, color: "rgba(107,114,128,.95)" }}>
        .env.local의 <b>ADMIN_TOKEN</b> 값을 여기에 입력해 저장하세요.
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 10, maxWidth: 520 }}>
        <input
          className="input"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ADMIN_TOKEN 붙여넣기"
        />

        <button
          className="btn btnPrimary"
          onClick={save}
          style={{ borderRadius: 14, padding: "12px 14px", fontWeight: 950 }}
        >
          저장하고 접수목록 열기 →
        </button>

        {saved ? (
          <div
            style={{
              marginTop: 6,
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(22,163,74,.25)",
              background: "rgba(22,163,74,.06)",
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            ✅ 현재 저장된 토큰이 있습니다.
            <br />
            필요하면 아래 버튼으로 삭제할 수 있습니다.
            <div style={{ marginTop: 10 }}>
              <button className="btn btnGhost" onClick={clear}>
                저장된 토큰 삭제
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 6, fontSize: 12, color: "rgba(107,114,128,.95)" }}>
            아직 저장된 토큰이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}