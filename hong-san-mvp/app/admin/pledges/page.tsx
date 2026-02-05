// app/admin/pledges/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type PledgeStatus = "LEAD" | "PENDING" | "CONFIRMED" | "DONE";

type PledgeType =
  | "INDIVIDUAL_50"
  | "INDIVIDUAL_100"
  | "PARTNER_SOLO"
  | "PARTNER_CORP_1"
  | "PARTNER_CORP_2"
  // (과거 데이터 호환)
  | "CORP_ESG_500"
  | "CORP_ESG_1000"
  | "INDIVIDUAL_FINISH";

type PledgeDoc = {
  id: string;
  type: PledgeType;
  kind?: "PAY" | "COLLAB";
  status: PledgeStatus;
  createdAt?: string | number;
  name: string;
  phone: string;
  address?: string;
  memo?: string;

  wants?: string[];
  supportType?: string;
  amount?: number;

  adminNote?: string;
};

const ADMIN_TOKEN_KEY = "hs_admin_token";

function readAdminToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

async function adminFetch(url: string, init?: RequestInit) {
  const token = readAdminToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      "x-admin-token": token, // ✅ 무조건 붙인다
    },
    cache: "no-store",
  });
  return res;
}

const STATUS_LABEL: Record<PledgeStatus, string> = {
  LEAD: "협업 문의",
  PENDING: "신청 접수",
  CONFIRMED: "입금 확인",
  DONE: "처리 완료",
};

const WANTS_LABEL: Record<string, string> = {
  FIELD_VISIT: "현장참여",
  PICKUP: "수확물수령",
  PROCESSING: "가공품신청",
  SEED: "주아/종자체험",
};

function typeLabel(t: PledgeType) {
  switch (t) {
    case "INDIVIDUAL_50":
      return "내 밭 50평 참여";
    case "INDIVIDUAL_100":
      return "내 밭 100평 참여";
    case "INDIVIDUAL_FINISH":
      return "개인 완주 파트너(구버전)";
    case "PARTNER_SOLO":
      return "개인 사업자(협업) 신청";
    case "PARTNER_CORP_1":
      return "브랜드 협업 콘텐츠 1편";
    case "PARTNER_CORP_2":
      return "브랜드 협업 콘텐츠 2편+";
    case "CORP_ESG_500":
      return "브랜드 협업 콘텐츠 1편(구버전)";
    case "CORP_ESG_1000":
      return "브랜드 협업 콘텐츠 2편+(구버전)";
    default:
      return t;
  }
}

function onlyDigitsPhone(s: string) {
  return (s || "").replace(/\D/g, "");
}

function fmtTime(v?: string | number) {
  if (!v) return "-";
  if (typeof v === "number") return new Date(v).toLocaleString("ko-KR");
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("ko-KR");
}

function wantsText(arr?: string[]) {
  const w = (arr || []).map((x) => WANTS_LABEL[x] || x);
  return w.length ? w.join(", ") : "-";
}

function isPayDoc(p: PledgeDoc) {
  return (
    p.kind === "PAY" ||
    p.type === "INDIVIDUAL_50" ||
    p.type === "INDIVIDUAL_100"
  );
}

function kindLabel(doc: PledgeDoc) {
  return isPayDoc(doc) ? "개인 참여(계좌이체)" : "협업(현물/제작비/협의)";
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

function makeTelLink(phone: string) {
  const d = onlyDigitsPhone(phone);
  return d ? `tel:${d}` : "#";
}

function makeSmsLink(phone: string, body: string) {
  const d = onlyDigitsPhone(phone);
  const encoded = encodeURIComponent(body);
  if (!d) return "#";
  return `sms:${d}?&body=${encoded}`;
}

function smsTemplate(p: PledgeDoc) {
  const BANK = "중소기업은행";
  const ACCOUNT = "466-072683-04-011";
  const HOLDER = "한국농수산TV";
  const amount = p.amount ?? (p.type === "INDIVIDUAL_100" ? 350_000 : 200_000);

  const base =
    `안녕하세요, 한국농수산TV입니다.\n` +
    `홍산마늘 1농가 1가족 프로그램 신청 확인 연락드립니다.\n\n` +
    `- 신청자: ${p.name}\n` +
    `- 선택: ${typeLabel(p.type)}\n` +
    `- 유형: ${kindLabel(p)}\n` +
    `- 상태: ${STATUS_LABEL[p.status]}\n` +
    `- 희망: ${wantsText(p.wants)}\n`;

  if (isPayDoc(p)) {
    return (
      base +
      `\n[계좌이체 안내]\n` +
      `은행: ${BANK}\n` +
      `계좌: ${ACCOUNT}\n` +
      `예금주: ${HOLDER}\n` +
      `금액: ${Number(amount).toLocaleString()}원\n` +
      `입금자명: ${p.name}\n\n` +
      `※ 이체 후 “입금 완료”라고 문자 주시면, 입금 확인 후 접수 확정 안내 드립니다.\n`
    );
  }

  return (
    base +
    `\n[협업 안내]\n` +
    `이 신청은 “결제”가 아니라 “협업 접수”입니다.\n` +
    `지원 방식(현물/제작비/협의): ${p.supportType || "협의"}\n` +
    `운영자가 확인 후 연락드려 촬영 일정/조건을 확정합니다.\n`
  );
}

export default function AdminPledgesPage() {
  const [token, setToken] = useState<string>("");
  const [tokenInput, setTokenInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [items, setItems] = useState<PledgeDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  // 검색/필터
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<"ALL" | "PAY" | "COLLAB">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PledgeStatus>("ALL");

  // 우측 메모
  const selected = useMemo(
    () => items.find((x) => x.id === selectedId) || null,
    [items, selectedId]
  );
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (selected) setNoteDraft(selected.adminNote || "");
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items
      .filter((x) => {
        if (kindFilter !== "ALL") {
          const k = isPayDoc(x) ? "PAY" : "COLLAB";
          if (k !== kindFilter) return false;
        }
        if (statusFilter !== "ALL" && x.status !== statusFilter) return false;

        if (!qq) return true;
        const inName = (x.name || "").toLowerCase().includes(qq);
        const inPhone = (x.phone || "").toLowerCase().includes(qq);
        const inType = typeLabel(x.type).toLowerCase().includes(qq);
        const inMemo = (x.memo || "").toLowerCase().includes(qq);
        const inNote = (x.adminNote || "").toLowerCase().includes(qq);
        return inName || inPhone || inType || inMemo || inNote;
      })
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt as any).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt as any).getTime() : 0;
        return tb - ta;
      });
  }, [items, q, kindFilter, statusFilter]);

  async function fetchList(activeToken: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/pledges", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": activeToken,
        },
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "목록 조회 실패");

      const list: PledgeDoc[] = data.items || [];
      setItems(list);
      if (!selectedId && list.length) setSelectedId(list[0].id);
    } catch (e: any) {
      setError(e?.message || "오류");
    } finally {
      setLoading(false);
    }
  }

  // 토큰 있으면 자동 로드
  useEffect(() => {
    if (token) fetchList(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function saveToken() {
    const t = tokenInput.trim();
    if (!t) return alert("관리자 토큰을 입력해 주세요.");
    localStorage.setItem(ADMIN_TOKEN_KEY, t);
    setToken(t);
    setTokenInput("");
  }

  function logout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken("");
    setItems([]);
    setSelectedId("");
    setError("관리자 토큰이 없습니다. 다시 입력해 주세요.");
  }

  async function refresh() {
    if (!token) return setError("관리자 토큰이 없습니다.");
    await fetchList(token);
  }

  async function updateStatus(next: PledgeStatus) {
    if (!selected) return;
    if (!token) return alert("관리자 토큰이 없습니다.");
    setSavingStatus(true);
    try {
      const res = await fetch("/api/admin/pledges/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        cache: "no-store",
        body: JSON.stringify({ id: selected.id, patch: { status: next } }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "상태 변경 실패");

      setItems((prev) => prev.map((x) => (x.id === selected.id ? { ...x, status: next } : x)));
    } catch (e: any) {
      alert(e?.message || "상태 변경 실패");
    } finally {
      setSavingStatus(false);
    }
  }

  async function saveNote() {
    if (!selected) return;
    if (!token) return alert("관리자 토큰이 없습니다.");
    setSavingNote(true);
    try {
      const res = await fetch("/api/admin/pledges/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        cache: "no-store",
        body: JSON.stringify({ id: selected.id, patch: { adminNote: noteDraft } }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "메모 저장 실패");

      setItems((prev) => prev.map((x) => (x.id === selected.id ? { ...x, adminNote: noteDraft } : x)));
    } catch (e: any) {
      alert(e?.message || "메모 저장 실패");
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div style={{ padding: 0 }}>
      {!token ? (
        <div
          style={{
            padding: 14,
            borderRadius: 18,
            background: "rgba(255, 59, 48, 0.06)",
            border: "1px solid rgba(255, 59, 48, 0.18)",
          }}
        >
          <div style={{ fontWeight: 950 }}>관리자 토큰이 필요합니다</div>
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder="ADMIN_TOKEN 입력"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              style={{ minWidth: 360 }}
            />
            <button className="btn btnPrimary" onClick={saveToken}>
              토큰 저장 →
            </button>
            <Link className="btn btnGhost" href="/admin/login">
              토큰 설정 페이지
            </Link>
          </div>
          {error ? (
            <div style={{ marginTop: 10, color: "rgba(220,38,38,.95)", fontWeight: 800 }}>
              오류: {error}
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="btn btnGhost" onClick={refresh} disabled={!token || loading}>
          새로고침
        </button>
        {token ? (
          <button className="btn btnGhost" onClick={logout}>
            로그아웃
          </button>
        ) : null}
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 12 }}>
        {/* 좌측 목록 */}
        <div style={{ background: "#fff", border: "1px solid rgba(17,24,39,.08)", borderRadius: 18, padding: 14 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder="검색: 이름/전화/선택/메모/유형"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ minWidth: 320 }}
            />
            <select className="input" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as any)} style={{ width: 170 }}>
              <option value="ALL">유형: 전체</option>
              <option value="PAY">유형: 개인(계좌이체)</option>
              <option value="COLLAB">유형: 협업</option>
            </select>
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} style={{ width: 170 }}>
              <option value="ALL">상태: 전체</option>
              <option value="LEAD">협업 문의</option>
              <option value="PENDING">신청 접수</option>
              <option value="CONFIRMED">입금 확인</option>
              <option value="DONE">처리 완료</option>
            </select>

            {loading ? (
              <span style={{ fontSize: 12, color: "rgba(107,114,128,.95)" }}>불러오는 중…</span>
            ) : (
              <span style={{ fontSize: 12, color: "rgba(107,114,128,.95)" }}>
                {filtered.length.toLocaleString()}건
              </span>
            )}
          </div>

          {error ? (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: "rgba(255, 59, 48, 0.06)", border: "1px solid rgba(255, 59, 48, 0.18)", color: "rgba(220,38,38,.95)", fontWeight: 800 }}>
              오류: {error}
            </div>
          ) : null}

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 12, color: "rgba(107,114,128,.95)" }}>표시할 접수건이 없습니다.</div>
            ) : (
              filtered.map((p) => {
                const active = p.id === selectedId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: 12,
                      borderRadius: 14,
                      border: active ? "2px solid rgba(0,0,0,.65)" : "1px solid rgba(17,24,39,.10)",
                      background: active ? "rgba(0,0,0,.03)" : "#fff",
                      display: "grid",
                      gap: 6,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 950 }}>{p.name} · {p.phone}</div>
                      <div style={{ fontSize: 12, padding: "4px 8px", borderRadius: 999, border: "1px solid rgba(17,24,39,.12)", background: "rgba(17,24,39,.04)", fontWeight: 900 }}>
                        {p.status}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(107,114,128,.95)" }}>
                      {typeLabel(p.type)} · {kindLabel(p)}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(75,85,99,.95)" }}>
                      선택: {wantsText(p.wants)}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontSize: 12, color: "rgba(107,114,128,.95)" }}>{fmtTime(p.createdAt)}</div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(75,85,99,.95)" }}>{STATUS_LABEL[p.status]}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 우측 상세 */}
        <div style={{ background: "#fff", border: "1px solid rgba(17,24,39,.08)", borderRadius: 18, padding: 14 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>선택한 접수</div>
          <div style={{ marginTop: 10, borderTop: "1px solid rgba(17,24,39,.08)" }} />

          {!selected ? (
            <div style={{ marginTop: 12, color: "rgba(107,114,128,.95)" }}>왼쪽에서 접수건을 선택해 주세요.</div>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 8 }}>
                {[
                  ["이름", selected.name],
                  ["전화", selected.phone],
                  ["선택", `${selected.type} · ${typeLabel(selected.type)}`],
                  ["구분", kindLabel(selected)],
                  ["희망", wantsText(selected.wants)],
                  ["주소", selected.address || "-"],
                  ["요청", selected.memo || "-"],
                  ["협업지원", selected.supportType || "-"],
                  ["접수시간", fmtTime(selected.createdAt)],
                  ["문서ID", selected.id],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "grid", gridTemplateColumns: "110px 1fr auto", gap: 10, alignItems: "center" }}>
                    <div style={{ fontSize: 12, color: "rgba(107,114,128,.95)" }}>{k}</div>
                    <div style={{ fontWeight: 900, fontSize: 13, wordBreak: "break-word" }}>{v}</div>
                    <button className="btn btnGhost" onClick={() => copyToClipboard(String(v))} style={{ padding: "8px 10px", borderRadius: 12 }}>
                      복사
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ padding: 12, borderRadius: 14, border: "1px solid rgba(17,24,39,.10)", background: "rgba(17,24,39,.02)" }}>
                <div style={{ fontWeight: 950 }}>빠른 연락</div>
                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a className="btn btnPrimary" href={makeTelLink(selected.phone)}>전화걸기</a>
                  <a className="btn btnGhost" href={makeSmsLink(selected.phone, smsTemplate(selected))}>문자 템플릿 열기</a>
                  <button className="btn btnGhost" onClick={() => copyToClipboard(smsTemplate(selected))}>문자 템플릿 복사</button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {(["LEAD", "PENDING", "CONFIRMED", "DONE"] as PledgeStatus[]).map((st) => {
                  const active = selected.status === st;
                  return (
                    <button
                      key={st}
                      className="btn"
                      onClick={() => updateStatus(st)}
                      disabled={savingStatus}
                      style={{
                        borderRadius: 999,
                        padding: "10px 12px",
                        border: active ? "2px solid rgba(0,0,0,.65)" : "1px solid rgba(17,24,39,.10)",
                        background: active ? "rgba(0,0,0,.04)" : "#fff",
                        fontWeight: 950,
                      }}
                    >
                      {STATUS_LABEL[st]} {active ? "✓" : ""}
                    </button>
                  );
                })}
              </div>

              <div style={{ padding: 12, borderRadius: 14, border: "1px solid rgba(17,24,39,.10)" }}>
                <div style={{ fontWeight: 950 }}>연락/관리 메모(관리자만)</div>
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={7}
                  style={{ width: "100%", marginTop: 10, padding: 12, borderRadius: 12, border: "1px solid rgba(17,24,39,.10)", outline: "none", resize: "vertical", fontSize: 13 }}
                  placeholder={`예)\n- 1/20 10:30 통화: 6월 현장수확 희망\n- 입금자명 확인: 조세환\n- 택배주소 재확인 필요`}
                />
                <button
                  onClick={saveNote}
                  disabled={savingNote}
                  style={{ width: "100%", marginTop: 10, padding: "12px 14px", borderRadius: 14, border: 0, background: "black", color: "white", fontWeight: 950, cursor: "pointer" }}
                >
                  {savingNote ? "메모 저장 중..." : "메모 저장 →"}
                </button>
              </div>

              <details>
                <summary style={{ cursor: "pointer", color: "rgba(107,114,128,.95)" }}>디버그</summary>
                <pre style={{ marginTop: 10, fontSize: 12, overflow: "auto" }}>
{JSON.stringify(selected, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: "rgba(107,114,128,.95)" }}>
        ※ 이 페이지는 서버 redirect를 하지 않습니다. 토큰이 없으면 입력 UI가 뜨고, API 호출 시 헤더로 인증합니다.
      </div>
    </div>
  );
}