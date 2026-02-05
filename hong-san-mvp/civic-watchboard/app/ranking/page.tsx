"use client";

import React, { useEffect, useMemo, useState } from "react";

type CardMonthRow = { policy: string; period: string; cnt: number };
type CardPivotRow = {
  policy: string;
  y2022: number;
  y2023: number;
  y2024: number;
  y2025: number;
  y2026: number;
  total: number;
};

type ApiOk = {
  ok: true;
  updatedAt: string;
  cardMonth: CardMonthRow[];
  cardPivot: CardPivotRow[];
};

type ApiFail = { ok: false; error: string };

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function RankingPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiOk | null>(null);

  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [selectedPolicy, setSelectedPolicy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch("/api/metrics", { cache: "no-store" });
        const j = (await res.json()) as ApiOk | ApiFail;
        if (!("ok" in j) || j.ok !== true) throw new Error((j as ApiFail).error || "API failed");
        setData(j as ApiOk);
      } catch (e: any) {
        setErr(e?.message ?? "Failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pivot = data?.cardPivot ?? [];
  const month = data?.cardMonth ?? [];

  const maxTotal = useMemo(() => {
    return pivot.reduce((m, r) => Math.max(m, n(r.total)), 0) || 1;
  }, [pivot]);

  const filtered = useMemo(() => {
    const q = query.trim();
    let rows = pivot;
    if (q) rows = rows.filter((r) => r.policy.includes(q));
    return rows.slice(0, limit);
  }, [pivot, query, limit]);

  const selectedMonthly = useMemo(() => {
    if (!selectedPolicy) return [];
    return month
      .filter((r) => r.policy === selectedPolicy)
      .slice()
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [month, selectedPolicy]);

  const updatedAt = data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "-";

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "28px 16px" }}>
      <header style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>
            정책 랭킹 (정책카드 TOP)
          </h1>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            업데이트: {updatedAt}
          </div>
        </div>

        <p style={{ marginTop: 10, lineHeight: 1.5, opacity: 0.85 }}>
          “이 시장은 4년간 무엇을 반복적으로 발주/집행했는가?”를 한 장에서 보여주는 화면입니다.
          <br />
          (현재는 더미/시범 데이터이지만, 구조는 실데이터로 그대로 확장됩니다.)
        </p>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="정책카드 검색 (예: 대곡역, 교통, 공원...)"
            style={{
              flex: "1 1 360px",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.2)",
              outline: "none",
            }}
          />
          <select
            value={String(limit)}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.2)",
              background: "white",
            }}
          >
            {[5, 10, 20, 50].map((x) => (
              <option key={x} value={x}>
                TOP {x}
              </option>
            ))}
          </select>
        </div>
      </header>

      {loading && (
        <div style={{ padding: 14, border: "1px solid rgba(0,0,0,0.15)", borderRadius: 14 }}>
          로딩 중...
        </div>
      )}

      {!loading && err && (
        <div style={{ padding: 14, border: "1px solid rgba(0,0,0,0.15)", borderRadius: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>에러</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{err}</div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
            체크: public/data/out_card_*.csv 존재 여부, /api/metrics 응답 여부
          </div>
        </div>
      )}

      {!loading && !err && (
        <>
          <section style={{ border: "1px solid rgba(0,0,0,0.15)", borderRadius: 18, overflow: "hidden" }}>
            <div style={{ padding: "14px 14px 8px", borderBottom: "1px solid rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontWeight: 800 }}>정책카드 랭킹</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                클릭하면 아래에 월별 추이를 펼쳐봅니다.
              </div>
            </div>

            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              {filtered.map((r, idx) => {
                const ratio = Math.round((n(r.total) / maxTotal) * 100);
                const isSel = selectedPolicy === r.policy;

                return (
                  <button
                    key={r.policy}
                    onClick={() => setSelectedPolicy(isSel ? null : r.policy)}
                    style={{
                      textAlign: "left",
                      background: "white",
                      border: "1px solid rgba(0,0,0,0.12)",
                      borderRadius: 14,
                      padding: 14,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ minWidth: 260 }}>
                        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>#{idx + 1}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.25 }}>
                          {r.policy}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                          총 {n(r.total)}건
                        </div>
                      </div>

                      <div style={{ flex: "1 1 320px", minWidth: 280 }}>
                        <div style={{ display: "flex", gap: 10, fontSize: 12, opacity: 0.8, flexWrap: "wrap" }}>
                          <span>2022: {n(r.y2022)}</span>
                          <span>2023: {n(r.y2023)}</span>
                          <span>2024: {n(r.y2024)}</span>
                          <span>2025: {n(r.y2025)}</span>
                          <span>2026: {n(r.y2026)}</span>
                        </div>

                        <div style={{ marginTop: 10, height: 10, borderRadius: 999, background: "rgba(0,0,0,0.08)", overflow: "hidden" }}>
                          <div style={{ width: `${ratio}%`, height: "100%", borderRadius: 999, background: "rgba(0,0,0,0.75)" }} />
                        </div>

                        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                          랭킹 강도: {ratio}%
                        </div>
                      </div>

                      <div style={{ alignSelf: "center", fontSize: 12, opacity: 0.75 }}>
                        {isSel ? "접기 ▲" : "자세히 ▼"}
                      </div>
                    </div>
                  </button>
                );
              })}

              {filtered.length === 0 && (
                <div style={{ padding: 10, opacity: 0.7 }}>
                  검색 결과가 없습니다.
                </div>
              )}
            </div>
          </section>

          <section style={{ marginTop: 16, border: "1px solid rgba(0,0,0,0.15)", borderRadius: 18, overflow: "hidden" }}>
            <div style={{ padding: "14px 14px 8px", borderBottom: "1px solid rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontWeight: 800 }}>선택 정책의 월별 추이</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {selectedPolicy ? selectedPolicy : "정책을 클릭하면 월별로 펼쳐집니다."}
              </div>
            </div>

            <div style={{ padding: 14 }}>
              {!selectedPolicy && (
                <div style={{ opacity: 0.7 }}>
                  위 랭킹에서 정책을 하나 클릭해 주세요.
                </div>
              )}

              {selectedPolicy && selectedMonthly.length === 0 && (
                <div style={{ opacity: 0.7 }}>
                  월별 데이터가 없습니다.
                </div>
              )}

              {selectedPolicy && selectedMonthly.length > 0 && (
                <div style={{ display: "grid", gap: 8 }}>
                  {selectedMonthly.map((m) => (
                    <div
                      key={`${m.policy}-${m.period}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "10px 12px",
                        border: "1px solid rgba(0,0,0,0.12)",
                        borderRadius: 12,
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{m.period}</div>
                      <div style={{ opacity: 0.85 }}>{n(m.cnt)}건</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <footer style={{ marginTop: 18, fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>
            다음 업그레이드(강력해지는 지점):
            <br />
            1) 정책별 “근거(예산/입찰/착공/준공)” 점수 자동화
            <br />
            2) 공약 문구(PDF/텍스트) → 정책카드 묶음 매칭(공약 vs 집행)
            <br />
            3) 시장/특례시 비교(해외출장비, 회의시간, 예산집행) 대시보드
          </footer>
        </>
      )}
    </main>
  );
}
