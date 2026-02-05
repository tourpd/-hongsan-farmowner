// app/metrics/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type RankingItem = {
  policy: string;
  cnt: number;
  total_budget: number;
  score: number;
};

type ApiPayload = {
  ok: boolean;
  generatedAt: string;
  data: {
    ranking: RankingItem[];
    cardMonth: { policy: string; period: string; cnt: string }[];
    cardYearPivot: {
      policy: string;
      y2022: string;
      y2023: string;
      y2024: string;
      y2025: string;
      y2026: string;
      total: string;
    }[];
  };
};

function toInt(v: any, fallback = 0) {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function formatKRW(n: number) {
  if (!Number.isFinite(n)) return "-";
  const abs = Math.abs(n);
  // 1억 = 100,000,000
  if (abs >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000) return `${(n / 10_000).toFixed(1)}만`;
  return `${n.toLocaleString("ko-KR")}원`;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export default function MetricsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [cardMonth, setCardMonth] = useState<ApiPayload["data"]["cardMonth"]>([]);
  const [yearPivot, setYearPivot] = useState<ApiPayload["data"]["cardYearPivot"]>([]);

  const [q, setQ] = useState("");
  const [topN, setTopN] = useState<number>(10);
  const [selectedPolicy, setSelectedPolicy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch("/api/metrics", { cache: "no-store" });
        const json = (await res.json()) as ApiPayload;

        if (!alive) return;

        if (!json.ok) {
          setErr("metrics api error");
          setLoading(false);
          return;
        }

        setGeneratedAt(json.generatedAt);
        setRanking(json.data.ranking ?? []);
        setCardMonth(json.data.cardMonth ?? []);
        setYearPivot(json.data.cardYearPivot ?? []);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message ?? e));
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const maxScore = useMemo(() => {
    return ranking.reduce((m, x) => Math.max(m, x.score ?? 0), 0) || 100;
  }, [ranking]);

  const filtered = useMemo(() => {
    const keyword = q.trim();
    const base = keyword
      ? ranking.filter((r) => r.policy.includes(keyword))
      : ranking.slice();

    return base.slice(0, topN);
  }, [ranking, q, topN]);

  const pivotByPolicy = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of yearPivot) m.set(r.policy, r);
    return m;
  }, [yearPivot]);

  const monthSeries = useMemo(() => {
    if (!selectedPolicy) return [];
    const rows = cardMonth
      .filter((r) => r.policy === selectedPolicy)
      .map((r) => ({ period: r.period, cnt: toInt(r.cnt, 0) }))
      .sort((a, b) => a.period.localeCompare(b.period));
    return rows;
  }, [cardMonth, selectedPolicy]);

  const selectedPivot = useMemo(() => {
    if (!selectedPolicy) return null;
    return pivotByPolicy.get(selectedPolicy) ?? null;
  }, [selectedPolicy, pivotByPolicy]);

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 18px 64px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 28, margin: 0, letterSpacing: -0.2 }}>정책 랭킹 (정책카드 TOP)</h1>
          <p style={{ margin: "10px 0 0", color: "#555", lineHeight: 1.5 }}>
            “이 시장은 4년간 무엇을 반복적으로 발주/집행했는가?”를 한 장에서 보여주는 화면입니다.
            <br />
            <span style={{ color: "#777" }}>(현재는 더미/시범 데이터이지만, 구조는 실데이터로 그대로 확장됩니다.)</span>
          </p>
        </div>
        <div style={{ color: "#666", fontSize: 13, whiteSpace: "nowrap" }}>
          업데이트:{" "}
          {generatedAt
            ? new Date(generatedAt).toLocaleString("ko-KR", { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" })
            : "-"}
        </div>
      </header>

      {/* 검색 + TopN */}
      <section style={{ marginTop: 18, display: "flex", gap: 10, alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="정책카드 검색 (예: 대곡역, 교통, 공원...)"
          style={{
            flex: 1,
            height: 44,
            borderRadius: 10,
            border: "1px solid #ddd",
            padding: "0 14px",
            outline: "none",
            fontSize: 14,
          }}
        />
        <select
          value={topN}
          onChange={(e) => setTopN(Number(e.target.value))}
          style={{
            height: 44,
            borderRadius: 10,
            border: "1px solid #ddd",
            padding: "0 12px",
            fontSize: 14,
            background: "#fff",
          }}
        >
          <option value={5}>TOP 5</option>
          <option value={10}>TOP 10</option>
          <option value={20}>TOP 20</option>
          <option value={50}>TOP 50</option>
        </select>
      </section>

      {/* 상태 */}
      {loading && (
        <div style={{ marginTop: 16, color: "#666" }}>
          불러오는 중...
        </div>
      )}
      {err && (
        <div style={{ marginTop: 16, color: "crimson" }}>
          오류: {err}
        </div>
      )}

      {/* 랭킹 리스트 */}
      {!loading && !err && (
        <section
          style={{
            marginTop: 16,
            border: "1px solid #e6e6e6",
            borderRadius: 16,
            padding: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>정책카드 랭킹</h2>
            <div style={{ fontSize: 12, color: "#777" }}>클릭하면 아래에 월별 추이를 펼쳐봅니다.</div>
          </div>

          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.length === 0 && (
              <div style={{ padding: 14, color: "#777" }}>검색 결과가 없습니다.</div>
            )}

            {filtered.map((item, idx) => {
              const isSelected = selectedPolicy === item.policy;
              const percent = maxScore > 0 ? (item.score / maxScore) * 100 : 0;

              const pivot = pivotByPolicy.get(item.policy);
              const y2022 = pivot ? toInt(pivot.y2022, 0) : 0;
              const y2023 = pivot ? toInt(pivot.y2023, 0) : 0;
              const y2024 = pivot ? toInt(pivot.y2024, 0) : 0;
              const y2025 = pivot ? toInt(pivot.y2025, 0) : 0;
              const y2026 = pivot ? toInt(pivot.y2026, 0) : 0;

              return (
                <div
                  key={item.policy}
                  style={{
                    border: "1px solid #e6e6e6",
                    borderRadius: 14,
                    padding: 14,
                    background: isSelected ? "#fafafa" : "#fff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ minWidth: 260 }}>
                      <div style={{ fontSize: 12, color: "#888" }}>#{idx + 1}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{item.policy}</div>
                      <div style={{ marginTop: 6, color: "#666", fontSize: 13 }}>
                        총 <b>{item.cnt.toLocaleString("ko-KR")}</b>건 · 추정 예산 <b>{formatKRW(item.total_budget)}</b>
                      </div>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline", justifyContent: "flex-end", color: "#666", fontSize: 12 }}>
                        <span>2022: <b>{y2022}</b></span>
                        <span>2023: <b>{y2023}</b></span>
                        <span>2024: <b>{y2024}</b></span>
                        <span>2025: <b>{y2025}</b></span>
                        <span>2026: <b>{y2026}</b></span>
                      </div>

                      <div style={{ marginTop: 10, height: 10, borderRadius: 999, background: "#eee", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${clamp(percent, 0, 100)}%`,
                            height: "100%",
                            background: "#111",
                          }}
                        />
                      </div>

                      <div style={{ marginTop: 6, fontSize: 12, color: "#777", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>랭킹 강도: {Math.round(percent)}%</span>
                        <button
                          onClick={() => setSelectedPolicy(isSelected ? null : item.policy)}
                          style={{
                            border: "1px solid #ddd",
                            background: "#fff",
                            borderRadius: 10,
                            padding: "6px 10px",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          자세히 {isSelected ? "▲" : "▼"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 펼치기: 월별 추이 미리보기 */}
                  {isSelected && (
                    <div style={{ marginTop: 14, borderTop: "1px solid #eee", paddingTop: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                        <div style={{ fontWeight: 700 }}>월별 추이(해당 정책)</div>
                        <a
                          href={`/dashboard?policy=${encodeURIComponent(item.policy)}`}
                          style={{ fontSize: 12, color: "#2563eb", textDecoration: "underline" }}
                        >
                          근거 보기(대시보드)
                        </a>
                      </div>

                      {monthSeries.length === 0 ? (
                        <div style={{ marginTop: 10, color: "#777", fontSize: 13 }}>
                          월별 데이터가 없습니다.
                        </div>
                      ) : (
                        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                          {monthSeries.map((m) => {
                            // 월별 막대: 해당 정책 내 최댓값 기준
                            const max = Math.max(...monthSeries.map((x) => x.cnt), 1);
                            const w = (m.cnt / max) * 100;
                            return (
                              <div key={m.period} style={{ display: "grid", gridTemplateColumns: "92px 1fr 40px", gap: 10, alignItems: "center" }}>
                                <div style={{ fontSize: 12, color: "#666" }}>{m.period}</div>
                                <div style={{ height: 10, borderRadius: 999, background: "#eee", overflow: "hidden" }}>
                                  <div style={{ width: `${clamp(w, 0, 100)}%`, height: "100%", background: "#111" }} />
                                </div>
                                <div style={{ fontSize: 12, color: "#666", textAlign: "right" }}>{m.cnt}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {selectedPivot && (
                        <div style={{ marginTop: 12, padding: 12, border: "1px solid #eee", borderRadius: 12, background: "#fff" }}>
                          <div style={{ fontSize: 12, color: "#777" }}>연도별 집계(요약)</div>
                          <div style={{ marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13, color: "#444" }}>
                            <span>2022: <b>{toInt(selectedPivot.y2022, 0)}</b></span>
                            <span>2023: <b>{toInt(selectedPivot.y2023, 0)}</b></span>
                            <span>2024: <b>{toInt(selectedPivot.y2024, 0)}</b></span>
                            <span>2025: <b>{toInt(selectedPivot.y2025, 0)}</b></span>
                            <span>2026: <b>{toInt(selectedPivot.y2026, 0)}</b></span>
                            <span>총합: <b>{toInt(selectedPivot.total, 0)}</b></span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 하단: 선택 정책 영역 */}
      <section
        style={{
          marginTop: 16,
          border: "1px solid #e6e6e6",
          borderRadius: 16,
          padding: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>선택 정책의 월별 추이</h2>
          <div style={{ fontSize: 12, color: "#777" }}>정책을 클릭하면 월별로 펼쳐집니다.</div>
        </div>

        {!selectedPolicy ? (
          <div style={{ marginTop: 12, color: "#777" }}>위 랭킹에서 정책을 하나 클릭해 주세요.</div>
        ) : (
          <div style={{ marginTop: 12, color: "#444" }}>
            현재 선택: <b>{selectedPolicy}</b>
          </div>
        )}

        <div style={{ marginTop: 16, color: "#666", fontSize: 12, lineHeight: 1.6 }}>
          다음 업그레이드(강력해지는 지점):
          <br />
          1) 정책별 ‘근거(예산/입찰/착공/준공)’ 점수 자동화
          <br />
          2) 공약 문구(PDF/텍스트) → 정책카드 묶음 매칭(공약 vs 집행)
          <br />
          3) 시장/특례시 비교(해외출장비, 회의시간, 예산집행) 대시보드
        </div>
      </section>
    </main>
  );
}