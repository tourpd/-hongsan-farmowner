// app/pay/page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type PledgeType =
  | "INDIVIDUAL_50"
  | "INDIVIDUAL_100"
  | "PARTNER_SOLO"
  | "PARTNER_CORP_1"
  | "PARTNER_CORP_2";

type MenuItem = {
  type: PledgeType;
  kind: "PAY" | "COLLAB";
  title: string;
  priceLabel: string; // 화면 표기용
  amount: number; // PAY면 참여금, COLLAB면 0
  youGet: string[]; // 참여자가 얻는 것(확정)
  youDo: string[]; // 참여자가 하는 것(확정)
  defaultWants: string[];
};

const MENU: MenuItem[] = [
  {
    // ✅ (수정) 기존 "INDIVIDUAL_5" → union에 맞게 "INDIVIDUAL_50"로만 정정
    type: "INDIVIDUAL_50",
    kind: "PAY",
    title: "홍산마늘 밭 1구좌 5평 참여",
    priceLabel: "참여금 75,000원 (계좌이체)",
    amount: 75000,
    youGet: [
      "현장 수확 참여(원하면) — 5접가량(약 500통) 직접 수확",
      "미 참여시 홍산마늘 생대 15kg 1박스 택배로 지급",
      "5월 마늘쫑/6월 수확 일정 문자 안내",
      "그외 더 필요한 종자마늘/깐마늘/다진마늘은 사전 신청시 우선 구매",
      "현장 수확 참여(원하면) + 일정 조율 우선",
    ],
    youDo: ["계좌이체로 참여금 납부", "원하는 수령 방식/체험을 선택"],
    defaultWants: ["PICKUP"],
  },

  {
    type: "PARTNER_CORP_1",
    kind: "COLLAB",
    title: "브랜드 협업 패키지(브랜드 홍보영상제작)",
    priceLabel: "콘텐츠 제작(한국농수산TV 방영)",
    amount: 0,
    youGet: [
      "홍산마늘 살리기 콘텐츠 제작·자사제품 PPL 협업(현장/인터뷰/실사용 중심)",
      "노출/스토리 설계(농민 관점의 신뢰형 구성)",
      "성과 리포트 요약(조회/반응/댓글 핵심)",
    ],
    youDo: [
      "지원 방식 선택: 현물(농자재 지원) / 제작비 지원 / 협의",
      "현장/ 제품 제공 및 촬영 일정 협조",
    ],
    defaultWants: ["FIELD_VISIT"],
  },
];

type CreatePledgePayload = {
  type: PledgeType;
  name: string;
  phone: string;
  memo?: string;
  address?: string;
  wants: string[];
  supportType?: string; // COLLAB용: 현물/현금/협의
  amount: number;
  idempotencyKey: string;
};

async function createPledge(payload: CreatePledgePayload) {
  const res = await fetch("/api/pledges/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "저장 실패");
  }
  return data as { ok: true; pledgeId: string; status: string; kind: string };
}

function toggle(arr: string[], v: string) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export default function PayPage() {
  const pageId = useMemo(() => `hs-pay-${Date.now()}`, []);
  const [type, setType] = useState<PledgeType>("INDIVIDUAL_50");

  const selected = MENU.find((m) => m.type === type)!;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [memo, setMemo] = useState("");

  // ✅ wants(선택지): 현장/수령/가공/종자
  const [wants, setWants] = useState<string[]>(selected.defaultWants);

  // ✅ 협업 지원 방식
  const [supportType, setSupportType] = useState<
    "현물(농자재)" | "현금(제작비)" | "협의"
  >("현물(농자재)");

  const [saving, setSaving] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [debug, setDebug] = useState<any>(null);

  // type 바뀌면 기본 wants를 새로 세팅
  const onPickType = (t: PledgeType) => {
    setType(t);
    const next = MENU.find((m) => m.type === t)!;
    setWants(next.defaultWants);
    setLastSavedId(null);
  };

  const makeIdempotencyKey = () =>
    `pledge-${Date.now()}-${Math.random().toString(16).slice(2)}-${pageId}`;

  const save = async () => {
    if (saving) return;

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) return alert("이름을 입력해 주세요.");
    if (!trimmedPhone) return alert("휴대폰 번호를 입력해 주세요.");

    // PAY(개인 참여)면 주소 필수
    if (selected.kind === "PAY" && !address.trim()) {
      return alert("주소를 입력해 주세요. (수령/서류/연락용)");
    }

    setSaving(true);
    try {
      const payload: CreatePledgePayload = {
        type,
        name: trimmedName,
        phone: trimmedPhone,
        memo: memo.trim(),
        address: address.trim(),
        wants,
        supportType: selected.kind === "COLLAB" ? supportType : "",
        amount: selected.amount,
        idempotencyKey: makeIdempotencyKey(),
      };

      const out = await createPledge(payload);
      setLastSavedId(out.pledgeId);
      setDebug({ ok: true, out, payload });

      alert(
        selected.kind === "PAY"
          ? "✅ 신청 저장 완료! 아래 계좌로 이체하시면 접수가 확정됩니다."
          : "✅ 협업 신청 접수 완료! 운영자가 연락드려 협업 조건을 확정합니다."
      );
    } catch (e: any) {
      setDebug({ ok: false, error: e?.message || String(e) });
      alert(e?.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // ✅ 5평(PAY) 농민 계좌
  const FARMER_BANK = "농협";
  const FARMER_ACCOUNT = "356-1458-4006-33";
  const FARMER_HOLDER = "박경순";

  // ✅ 협업(기업) 한국농수산TV 계좌
  const TV_BANK = "중소기업은행";
  const TV_ACCOUNT = "466-072683-04-011";
  const TV_HOLDER = "한국농수산TV";

  // ✅ 스타일: 선택한 메뉴와 동일한 바탕(톤)을 ②/③에 동기화
  const isPay = selected.kind === "PAY";
  const tone = isPay
    ? {
        border: "2px solid rgba(22,163,74,.55)",
        background: "rgba(22,163,74,.06)",
        pillBg: "rgba(22,163,74,.10)",
        pillText: "rgba(22,163,74,.95)",
      }
    : {
        border: "2px solid rgba(59,130,246,.30)",
        background: "rgba(59,130,246,.06)",
        pillBg: "rgba(59,130,246,.10)",
        pillText: "rgba(59,130,246,.95)",
      };

  return (
    <div
      className="container"
      style={{
        padding: 18,
        background: "rgba(17,24,39,.03)",
        minHeight: "100vh",
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 16,
          borderRadius: 18,
          background: "#fff",
          border: "1px solid rgba(17,24,39,.08)",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>참여 신청</div>
          <div
            style={{
              marginTop: 6,
              color: "rgba(107,114,128,.95)",
              fontSize: 13,
            }}
          >
            참여자가 무엇을 얻는지 확실히 보고 → 신청 저장 → (개인 참여는) 계좌이체로 확정
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/" className="btn btnGhost">
            홈
          </Link>
          <Link href="/pay" className="btn btnGhost">
            참여 신청
          </Link>
          <Link href="/admin/pledges" className="btn btnGhost">
            관리자
          </Link>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "1.2fr .8fr",
          gap: 14,
        }}
      >
        {/* 좌측: 메뉴 선택 */}
        <div
          className="card"
          style={{
            background: "#fff",
            border: "1px solid rgba(17,24,39,.08)",
            borderRadius: 18,
            padding: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>① 메뉴판처럼 고르세요</div>
            <div
              style={{
                fontSize: 12,
                padding: "6px 10px",
                borderRadius: 999,
                background: tone.pillBg,
                color: tone.pillText,
                fontWeight: 900,
              }}
            >
              {isPay ? "개인 참여(계좌이체)" : "협업 접수(결제 없음)"}
            </div>
          </div>

          {/* ✅ 모바일 줄바꿈/깨짐 방지: 교체된 메뉴 버튼 */}
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {MENU.map((m) => {
              const active = m.type === type;

              const activeTone =
                m.kind === "PAY"
                  ? {
                      border: "2px solid rgba(22,163,74,.55)",
                      background: "rgba(22,163,74,.06)",
                    }
                  : {
                      border: "2px solid rgba(59,130,246,.30)",
                      background: "rgba(59,130,246,.06)",
                    };

              return (
                <button
                  key={m.type}
                  type="button"
                  onClick={() => onPickType(m.type)}
                  className="menuBtn"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: 14,
                    borderRadius: 16,
                    border: active
                      ? activeTone.border
                      : "1px solid rgba(17,24,39,.10)",
                    background: active ? activeTone.background : "#fff",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                    <div
                      className="menuTitle"
                      style={{
                        fontWeight: 950,
                        wordBreak: "keep-all",
                        overflowWrap: "break-word",
                        lineHeight: 1.25,
                      }}
                    >
                      {m.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(107,114,128,.95)",
                        wordBreak: "keep-all",
                      }}
                    >
                      {m.kind === "PAY"
                        ? "개인 참여(계좌이체)"
                        : "협업 신청(결제 없음)"}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(75,85,99,.95)",
                        wordBreak: "keep-all",
                      }}
                    >
                      {m.youGet[0]}
                    </div>
                  </div>

                  <div
                    className="menuPrice"
                    style={{
                      fontWeight: 950,
                      whiteSpace: "nowrap",
                      wordBreak: "keep-all",
                      flexShrink: 0,
                    }}
                  >
                    {m.priceLabel}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ✅ ② 얻는 것 / 하는 것 : 선택 메뉴와 동일한 바탕으로 동기화 */}
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 16,
              border: tone.border,
              background: tone.background,
            }}
          >
            <div style={{ fontWeight: 950 }}>
              ② 이 메뉴를 선택하면 참여자가 얻는 것
            </div>
            <ul style={{ margin: "10px 0 0 18px", lineHeight: 1.8 }}>
              {selected.youGet.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>

            <div style={{ marginTop: 10, fontWeight: 900 }}>
              참여자가 하는 것
            </div>
            <ul style={{ margin: "8px 0 0 18px", lineHeight: 1.8 }}>
              {selected.youDo.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>

          {/* ✅ ③ 선택 옵션 영역 */}
          <div
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: 16,
              border: "1px solid rgba(17,24,39,.10)",
              background: "rgba(17,24,39,.02)",
            }}
          >
            <div style={{ fontWeight: 950 }}>
              ③ (선택) 참여자가 원하는 방식 체크
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {[
                // ✅ (수정) 현장참여 분리: 5월 마늘쫑 / 6월 수확
                {
                  key: "SCAPE_VISIT",
                  label: "5월 마늘쫑 참여",
                  desc: "5월 마늘쫑 작업에 현장 참여(원하면)",
                },
                {
                  key: "HARVEST_VISIT",
                  label: "6월 수확 참여",
                  desc: "6월 수확에 현장 참여(원하면)",
                },

                // 기존 유지
                {
                  key: "PICKUP",
                  label: "수확물 수령",
                  desc: "현장 수령 또는 택배(추후 안내)",
                },
                {
                  key: "PROCESSING",
                  label: "가공품 신청",
                  desc: "종자마늘/깐마늘/다진마늘 — 수확 시점에 사전 신청",
                },

                // ✅ (수정) SEED(주아/종자 체험) 삭제
              ].map((x) => (
                <label
                  key={x.key}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(17,24,39,.10)",
                    background: wants.includes(x.key) ? tone.background : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={wants.includes(x.key)}
                    onChange={() => setWants((arr) => toggle(arr, x.key))}
                    style={{ marginTop: 3 }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, wordBreak: "keep-all" }}>
                      {x.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(107,114,128,.95)",
                        marginTop: 4,
                        wordBreak: "keep-all",
                      }}
                    >
                      {x.desc}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "rgba(107,114,128,.95)",
              }}
            >
              ※ 선택한 체크는 관리자 화면에서 그대로 보입니다(관리/연락 목적).
            </div>
          </div>
        </div>

        {/* 우측: 신청 폼 */}
        <div
          className="card"
          style={{
            background: "#fff",
            border: "1px solid rgba(17,24,39,.08)",
            borderRadius: 18,
            padding: 16,
          }}
        >
          <div style={{ fontWeight: 950, fontSize: 18 }}>신청 정보</div>
          <div style={{ marginTop: 10, borderTop: "1px solid rgba(17,24,39,.08)" }} />

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>이름</div>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 홍길동"
              />
            </div>

            <div>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>휴대폰</div>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="예: 010-1234-5678"
              />
            </div>

            {selected.kind === "PAY" ? (
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                  주소(수령/서류/연락용)
                </div>
                <input
                  className="input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="예: 경기도 고양시 ..."
                />
              </div>
            ) : (
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                  협업 지원 방식
                </div>
                <select
                  value={supportType}
                  onChange={(e) => setSupportType(e.target.value as any)}
                  className="input"
                >
                  <option value="현물(농자재)">현물(농자재 지원)</option>
                  <option value="현금(제작비)">현금(제작비 지원)</option>
                  <option value="협의">협의</option>
                </select>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: "rgba(107,114,128,.95)",
                  }}
                >
                  ※ “우리가 제공하는 콘텐츠 협업”과 교환되는 지원 방식입니다.
                </div>
              </div>
            )}

            <div>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>
                요청사항(선택)
              </div>
              <input
                className="input"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 현장 수확 참여 희망 / 가공품 관심 / 협업 목적"
              />
            </div>

            <div
              style={{
                marginTop: 6,
                padding: 12,
                borderRadius: 14,
                background: "rgba(17,24,39,.03)",
                border: "1px solid rgba(17,24,39,.08)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr",
                  rowGap: 6,
                }}
              >
                <div style={{ color: "rgba(107,114,128,.95)" }}>선택</div>
                <div style={{ fontWeight: 900 }}>{selected.title}</div>

                <div style={{ color: "rgba(107,114,128,.95)" }}>상태</div>
                <div style={{ fontWeight: 900 }}>
                  {lastSavedId ? "저장됨" : "미저장"}
                </div>

                <div style={{ color: "rgba(107,114,128,.95)" }}>문서ID</div>
                <div>{lastSavedId ? <code>{lastSavedId}</code> : "-"}</div>
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 14,
                border: 0,
                background: "black",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              {saving ? "저장 중..." : "지금 신청 저장 →"}
            </button>

            {/* PAY이면 농민 계좌 안내 / COLLAB이면 한국농수산TV 계좌도 노출 */}
            {selected.kind === "PAY" ? (
              <div
                style={{
                  marginTop: 4,
                  padding: 12,
                  borderRadius: 14,
                  border: tone.border,
                  background: tone.background,
                }}
              >
                <div style={{ fontWeight: 950 }}>계좌이체 안내</div>
                <div style={{ marginTop: 6, lineHeight: 1.7, fontSize: 13 }}>
                  은행: <b>{FARMER_BANK}</b>
                  <br />
                  계좌: <b>{FARMER_ACCOUNT}</b>
                  <br />
                  예금주: <b>{FARMER_HOLDER}</b>
                  <br />
                  입금 금액: <b>{selected.amount.toLocaleString()}원</b>
                  <br />
                  입금자명: <b>{name.trim() || "성함"}</b>
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: "rgba(75,85,99,.95)",
                  }}
                >
                  ※ “신청 저장” 후 이체하시면 접수가 확정됩니다(관리자 화면에 기록).
                </div>
              </div>
            ) : (
              <div
                style={{
                  marginTop: 4,
                  padding: 12,
                  borderRadius: 14,
                  border: tone.border,
                  background: tone.background,
                }}
              >
                <div style={{ fontWeight: 950 }}>협업 안내</div>
                <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.7 }}>
                  이 메뉴는 결제가 아닙니다. <b>협업 접수</b> 후 운영자가 연락드려 조건(현물/제작비/협의)을 확정합니다.
                </div>

                {/* ✅ (추가) 협업 계좌 노출: 한국농수산TV 계좌 */}
                <div
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: "1px solid rgba(17,24,39,.10)",
                    fontSize: 13,
                    lineHeight: 1.7,
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>
                    (필요 시) 제작비/지원금 입금 계좌
                  </div>
                  은행: <b>{TV_BANK}</b>
                  <br />
                  계좌: <b>{TV_ACCOUNT}</b>
                  <br />
                  예금주: <b>{TV_HOLDER}</b>
                  <br />
                  입금자명: <b>{name.trim() || "성함"}</b>
                </div>
              </div>
            )}

            <details style={{ marginTop: 6 }}>
              <summary
                style={{
                  cursor: "pointer",
                  color: "rgba(107,114,128,.95)",
                }}
              >
                디버그(개발용)
              </summary>
              <pre style={{ marginTop: 10, fontSize: 12, overflow: "auto" }}>
{JSON.stringify({ pageId, type, wants, lastSavedId, debug }, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}