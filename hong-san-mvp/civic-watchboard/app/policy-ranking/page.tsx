"use client";

import React, { useEffect, useMemo, useState } from "react";

type RankingRow = {
  policy: string;
  cnt: number;
  total_budget: number;
  score: number;
};

type ApiOk = {
  ok: true;
  generatedAt: string;
  data: {
    ranking: RankingRow[];
  };
};

type ApiFail = {
  ok: false;
  error: string;
  checklist?: string[];
};

function fmtKRW(n: number) {
  // 1,680,000,000 -> "16.8억" 같이 보이기
  if (!Number.isFinite(n)) return "-";
  const eok = n / 100_000_000;
  if (eok >= 1) return `${eok.toFixed(eok >= 10 ? 0 : 1)}억`;
  const man = n / 10_000;
  if (man >= 1) return `${man.toFixed(man >= 100 ? 0 : 1)}만`;
  return n.toLocaleString("ko-KR");
}

function badgeTone(rank: number) {
  if (rank === 1) return "bg-red-600 text-white";
  if (rank === 2) return "bg-orange-500 text-white";
  if (rank === 3) return "bg-yellow-400 text-black";
  return "bg-zinc-200 text-zinc-900";
}

export default function PolicyRankingPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"score" | "budget" | "cnt">("score");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch("/api/metrics", { cache: "no-store" });
        const json = (await res.json()) as ApiOk | ApiFail;
        if (!res.ok || json.ok === false) {
          throw new Error(
            (json as ApiFail).error ||
              `API error: ${res.status} ${res.statusText}`
          );
        }
        if (!cancelled) {
          setRows((json as ApiOk).data.ranking || []);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim();
    const base = q
      ? rows.filter((r) => r.policy.includes(q))
      : rows.slice();

    const sorted = base.sort((a, b) => {
      if (sortKey === "budget") return b.total_budget - a.total_budget;
      if (sortKey === "cnt") return b.cnt - a.cnt;
      return b.score - a.score;
    });

    return sorted;
  }, [rows, query, sortKey]);

  return (
    <main style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
      <header style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>정책 랭킹</h1>
        <span style={{ color: "#666" }}>
          (건수·예산 기반 / 더미데이터)
        </span>
      </header>

      <section
        style={{
          marginTop: 12,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="정책카드 검색 (예: 대곡, 상하수도, 공원...)"
          style={{
            flex: "1 1 320px",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            outline: "none",
          }}
        />
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as any)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
          }}
        >
          <option value="score">정렬: 종합점수</option>
          <option value="budget">정렬: 총예산</option>
          <option value="cnt">정렬: 건수</option>
        </select>
      </section>

      <section style={{ marginTop: 16 }}>
        {loading && (
          <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
            로딩 중...
          </div>
        )}
        {err && (
          <div
            style={{
              padding: 14,
              border: "1px solid #f2c0c0",
              borderRadius: 12,
              background: "#fff5f5",
              color: "#7a1f1f",
            }}
          >
            <div style={{ fontWeight: 700 }}>에러</div>
            <div style={{ marginTop: 6 }}>{err}</div>
            <div style={{ marginTop: 10, color: "#444" }}>
              체크: dev 서버 실행 / <code>/api/metrics</code> / public/data CSV
            </div>
          </div>
        )}

        {!loading && !err && (
          <div
            style={{
              border: "1px solid #eee",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "10px 12px",
                background: "#fafafa",
                borderBottom: "1px solid #eee",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 700 }}>
                총 {filtered.length.toLocaleString("ko-KR")}개 정책카드
              </div>
              <div style={{ color: "#666", fontSize: 13 }}>
                점수 = 건수 + (총예산/1억)*2
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                    순위
                  </th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                    정책카드
                  </th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                    건수
                  </th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                    총예산(추정)
                  </th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                    종합점수
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => {
                  const rank = idx + 1;
                  return (
                    <tr key={r.policy}>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #f3f3f3" }}>
                        <span
                          className={badgeTone(rank)}
                          style={{
                            display: "inline-block",
                            minWidth: 38,
                            textAlign: "center",
                            borderRadius: 999,
                            padding: "4px 10px",
                            fontWeight: 800,
                          }}
                        >
                          {rank}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #f3f3f3", fontWeight: 700 }}>
                        {r.policy}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #f3f3f3" }}>
                        {Number(r.cnt).toLocaleString("ko-KR")}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #f3f3f3" }}>
                        {fmtKRW(Number(r.total_budget))}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #f3f3f3" }}>
                        {Number(r.score).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer style={{ marginTop: 14, color: "#666", fontSize: 13 }}>
        다음 단계: 정책카드 클릭 → “근거(원본 공고/예산/의회자료/언론/민원)”로 드릴다운 + 시간축(월/연) 추세 그래프
      </footer>
    </main>
  );
}