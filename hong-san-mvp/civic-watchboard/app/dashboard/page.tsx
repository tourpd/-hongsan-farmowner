"use client";

import React, { useEffect, useMemo, useState } from "react";

type MonthRow = { policy: string; period: string; cnt: number };
type YearRow = { policy: string; period: string; cnt: number };
type PivotRow = {
  policy: string;
  y2022: number;
  y2023: number;
  y2024: number;
  y2025: number;
  y2026: number;
  total: number;
};

type Metrics = {
  ok: true;
  generatedAt: string;
  month: MonthRow[];
  year: YearRow[];
  pivot: PivotRow[];
};

type MetricsFail = {
  ok: false;
  error: string;
  hint?: string;
};

function classNames(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function formatKoreanNumber(n: number) {
  return n.toLocaleString("ko-KR");
}

// 아주 단순한 미니 라인차트(SVG)
function MiniLineChart({
  points,
  width = 560,
  height = 160,
}: {
  points: Array<{ x: string; y: number }>;
  width?: number;
  height?: number;
}) {
  const pad = 16;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);

  const toX = (i: number) => pad + (points.length <= 1 ? 0 : (w * i) / (points.length - 1));
  const toY = (v: number) => {
    if (maxY === minY) return pad + h / 2;
    const t = (v - minY) / (maxY - minY);
    return pad + (1 - t) * h;
  };

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(2)} ${toY(p.y).toFixed(2)}`)
    .join(" ");

  return (
    <svg width={width} height={height} className="w-full">
      <rect x="0" y="0" width={width} height={height} rx="16" className="fill-white" />
      {/* grid */}
      {[0.25, 0.5, 0.75].map((t) => {
        const y = pad + t * h;
        return <line key={t} x1={pad} x2={pad + w} y1={y} y2={y} className="stroke-zinc-100" />;
      })}
      {/* line */}
      <path d={d} className="stroke-zinc-900" fill="none" strokeWidth="2" />
      {/* dots */}
      {points.map((p, i) => (
        <circle key={p.x} cx={toX(i)} cy={toY(p.y)} r="3" className="fill-zinc-900" />
      ))}
      {/* labels (first/last) */}
      {points.length >= 2 && (
        <>
          <text x={pad} y={height - 6} className="fill-zinc-500 text-[10px]">
            {points[0].x}
          </text>
          <text x={width - pad} y={height - 6} textAnchor="end" className="fill-zinc-500 text-[10px]">
            {points[points.length - 1].x}
          </text>
        </>
      )}
    </svg>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<Metrics | null>(null);
  const [err, setErr] = useState<MetricsFail | null>(null);
  const [policyFocus, setPolicyFocus] = useState<string>("정책카드: 대곡역 환승체계(교통/광역교통)");

  useEffect(() => {
    let alive = true;
    (async () => {
      setErr(null);
      const res = await fetch("/api/metrics", { cache: "no-store" });
      const json = (await res.json()) as Metrics | MetricsFail;
      if (!alive) return;

      if ("ok" in json && json.ok) setData(json);
      else setErr(json as MetricsFail);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const allPolicies = useMemo(() => {
    if (!data) return [];
    const s = new Set<string>();
    for (const r of data.pivot) s.add(r.policy);
    return Array.from(s);
  }, [data]);

  const kpi = useMemo(() => {
    if (!data) return null;
    const totalRows = data.month.reduce((a, r) => a + r.cnt, 0);
    const top = [...data.pivot].sort((a, b) => b.total - a.total)[0];
    const focus = data.pivot.find((p) => p.policy === policyFocus) ?? top;

    // “최근 12개월” 같은 개념은 더미에선 의미가 약하니, 지금은 “가장 최근 월(period)” 기준으로 표시
    const latestPeriod = [...data.month].map((r) => r.period).sort().pop() ?? "-";
    const latestTotal = data.month.filter((r) => r.period === latestPeriod).reduce((a, r) => a + r.cnt, 0);

    return {
      totalRows,
      latestPeriod,
      latestTotal,
      topPolicy: top?.policy ?? "-",
      topPolicyTotal: top?.total ?? 0,
      focusPolicy: focus?.policy ?? "-",
      focusTotal: focus?.total ?? 0,
    };
  }, [data, policyFocus]);

  const focusSeries = useMemo(() => {
    if (!data) return [];
    const rows = data.month
      .filter((r) => r.policy === policyFocus)
      .sort((a, b) => a.period.localeCompare(b.period));
    return rows.map((r) => ({ x: r.period, y: r.cnt }));
  }, [data, policyFocus]);

  if (err) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-semibold">Civic Watchboard</h1>
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="font-semibold text-red-900">데이터 로드 실패</div>
          <div className="mt-2 text-sm text-red-800">{err.error}</div>
          {err.hint && <div className="mt-2 text-sm text-red-800">힌트: {err.hint}</div>}
          <div className="mt-4 text-sm text-zinc-700">
            체크:
            <ul className="list-disc pl-5 mt-1">
              <li>npm run metrics 실행 → public/data/out_card_*.csv 생성</li>
              <li>curl -I http://localhost:3000/data/out_card_month.csv 가 200인지 확인</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !kpi) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-semibold">Civic Watchboard</h1>
        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600">
          데이터를 불러오는 중입니다…
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Civic Watchboard</h1>
          <p className="mt-1 text-sm text-zinc-600">
            “정책카드/추이” 더미 데이터 기반 대시보드 (생성 시각:{" "}
            <span className="font-mono">{new Date(data.generatedAt).toLocaleString("ko-KR")}</span>)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
            href="/data/out_card_month.csv"
            target="_blank"
            rel="noreferrer"
          >
            근거 CSV(월) 열기
          </a>
          <a
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
            href="/data/out_card_year_pivot.csv"
            target="_blank"
            rel="noreferrer"
          >
            근거 CSV(연도) 열기
          </a>
        </div>
      </div>

      {/* KPI */}
<div className="mt-6 grid gap-4 md:grid-cols-3">
  <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
    <div className="text-xs text-zinc-500">전체 정책카드 누적 건수(더미)</div>
    <div className="mt-2 text-3xl font-semibold">{formatKoreanNumber(kpi.totalRows)}</div>
    <div className="mt-2 text-sm text-zinc-600">
      최근 월({kpi.latestPeriod}) 집계:{" "}
      <span className="font-semibold">{formatKoreanNumber(kpi.latestTotal)}</span>
    </div>
  </div>

  <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
    <div className="text-xs text-zinc-500">최다 이슈 정책카드</div>
    <div className="mt-2 text-lg font-semibold leading-snug">{kpi.topPolicy}</div>
    <div className="mt-3 text-sm text-zinc-600">
      누적: <span className="font-semibold">{formatKoreanNumber(kpi.topPolicyTotal)}</span>
    </div>
  </div>

  <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
    <div className="text-xs text-zinc-500">이 화면의 의미</div>
    <div className="mt-2 text-sm leading-relaxed text-zinc-700">
      “정책 성과/논란”을 <span className="font-semibold">감정·주장</span>이 아니라{" "}
      <span className="font-semibold">근거 링크 + 숫자</span>로만 말하는 구조의 시작입니다.
    </div>
  </div>
      </div>
    </div>
  );
}