"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DashboardSummary = {
  ok: boolean;
  startedAt: string;
  filters: { term: string | null; mayor: string | null; q?: string | null };
  pledges: { total: number; byStatus: Record<string, number>; avgProgress: number };
  evidence: { total: number };
  note?: string;
};

type PledgeRow = {
  pledge_id: string;
  term: string | null;
  mayor: string | null;
  title: string;
  category: string | null;
  status: string | null;
  progress: number | null;
  summary: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type NextCursor = { cursorUpdatedAt: string | null; cursorPledgeId: string } | null;

type PledgesApi = {
  ok: boolean;
  startedAt: string;
  total: number;
  data: PledgeRow[];
  nextCursor: NextCursor;
  note?: string;
  error?: string;
};

function pct(n: number) {
  if (!Number.isFinite(n)) return "0%";
  return `${Math.round(n)}%`;
}

export default function HomePage() {
  const [term, setTerm] = useState("2022-2026");
  const [mayor, setMayor] = useState("이동환");
  const [q, setQ] = useState("");

  const [dash, setDash] = useState<DashboardSummary | null>(null);

  const [items, setItems] = useState<PledgeRow[]>([]);
  const [nextCursor, setNextCursor] = useState<NextCursor>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dashboardUrl = useMemo(() => {
    const sp = new URLSearchParams();
    if (term.trim()) sp.set("term", term.trim());
    if (mayor.trim()) sp.set("mayor", mayor.trim());
    return `/api/dashboard?${sp.toString()}`;
  }, [term, mayor]);

  const pledgesUrl = useMemo(() => {
    const sp = new URLSearchParams();
    if (term.trim()) sp.set("term", term.trim());
    if (mayor.trim()) sp.set("mayor", mayor.trim());
    if (q.trim()) sp.set("q", q.trim());
    sp.set("limit", "20");
    return `/api/pledges?${sp.toString()}`;
  }, [term, mayor, q]);

  async function fetchDashboard() {
    setErr(null);
    try {
      const res = await fetch(dashboardUrl, { cache: "no-store" });
      const json = (await res.json()) as DashboardSummary;
      if (!res.ok || !json.ok) throw new Error((json as any)?.error ?? `HTTP ${res.status}`);
      setDash(json);
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error");
    }
  }

  async function fetchFirst() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(pledgesUrl, { cache: "no-store" });
      const json = (await res.json()) as PledgesApi;
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setItems(json.data ?? []);
      setNextCursor(json.nextCursor ?? null);
      // 대시보드도 함께 갱신
      await fetchDashboard();
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function fetchMore() {
    if (!nextCursor?.cursorPledgeId) return;

    setLoading(true);
    setErr(null);
    try {
      const sp = new URLSearchParams();
      if (term.trim()) sp.set("term", term.trim());
      if (mayor.trim()) sp.set("mayor", mayor.trim());
      if (q.trim()) sp.set("q", q.trim());
      sp.set("limit", "20");
      if (nextCursor.cursorUpdatedAt) sp.set("cursorUpdatedAt", nextCursor.cursorUpdatedAt);
      sp.set("cursorPledgeId", nextCursor.cursorPledgeId);

      const res = await fetch(`/api/pledges?${sp.toString()}`, { cache: "no-store" });
      const json = (await res.json()) as PledgesApi;
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

      setItems((prev) => [...prev, ...(json.data ?? [])]);
      setNextCursor(json.nextCursor ?? null);
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusBars = useMemo(() => {
    const by = dash?.pledges?.byStatus ?? {};
    const total = dash?.pledges?.total ?? 0;
    const rows = Object.entries(by).sort((a, b) => b[1] - a[1]);
    return { total, rows };
  }, [dash]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">고양시 공약·집행 감시 대시보드</h1>
          <p className="mt-1 text-sm text-gray-600">
            공약(말) → 증거(링크) → 집행(입찰/예산) → 시민 반응까지 한 화면에서.
          </p>
        </div>
        <button
          onClick={fetchFirst}
          className="rounded-lg border bg-white px-4 py-2 text-sm shadow-sm hover:bg-gray-50"
        >
          새로고침
        </button>
      </div>

      {/* 필터 */}
      <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs text-gray-500">임기(term)</label>
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="2022-2026"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">시장(mayor)</label>
            <input
              value={mayor}
              onChange={(e) => setMayor(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="이동환"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchFirst}
              className="w-full rounded-lg bg-black px-3 py-2 text-white hover:opacity-90"
            >
              적용
            </button>
          </div>

          <div className="md:col-span-1">
            <label className="text-xs text-gray-500">검색(q)</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="공약명/카테고리/요약"
            />
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              onClick={fetchFirst}
              className="w-full rounded-lg border bg-gray-50 px-3 py-2 hover:bg-gray-100"
            >
              검색 반영
            </button>
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          현재 호출: <span className="font-mono">{dashboardUrl.replace("/api/dashboard", "/api/dashboard")}</span>
        </div>
      </div>

      {/* 상단 카드 */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-xs text-gray-500">공약 총수</div>
          <div className="mt-2 text-4xl font-semibold">{dash?.pledges?.total ?? 0}개</div>
          <div className="mt-1 text-sm text-gray-500">현재 DB(pledges) 기준</div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-xs text-gray-500">평균 진행률</div>
          <div className="mt-2 text-4xl font-semibold">{pct(dash?.pledges?.avgProgress ?? 0)}</div>
          <div className="mt-1 text-sm text-gray-500">progress 평균</div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-xs text-gray-500">증거 링크</div>
          <div className="mt-2 text-4xl font-semibold">{dash?.evidence?.total ?? 0}개</div>
          <div className="mt-1 text-sm text-gray-500">pledge_evidence 총합</div>
        </div>
      </div>

      {/* 상태바 + 업데이트 */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold">상태별 공약 현황</div>
            <div className="text-xs text-gray-500">startedAt: {dash?.startedAt ? new Date(dash.startedAt).toLocaleString() : "-"}</div>
          </div>
          <div className="mt-4 space-y-3">
            {statusBars.rows.length === 0 ? (
              <div className="text-sm text-gray-500">데이터가 없습니다.</div>
            ) : (
              statusBars.rows.map(([k, v]) => {
                const p = statusBars.total ? (v / statusBars.total) * 100 : 0;
                return (
                  <div key={k} className="rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{k}</div>
                      <div className="text-sm text-gray-600">
                        {v}개 · {pct(p)}
                      </div>
                    </div>
                    <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-black" style={{ width: `${Math.max(2, p)}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
            다음 단계: 공약 상세(클릭)에서 업데이트(pledge_updates)와 증거(pledge_evidence)를 누적하면
            이 화면이 자동으로 살아납니다.
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold">최근 업데이트 로그</div>
            <div className="text-xs text-gray-500">최근 10건</div>
          </div>

          <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
            아직 업데이트가 없습니다. (pledge_updates가 0개)
            <div className="mt-3 text-xs text-gray-500">
              다음 단계: 공약 상세에서 “월별 업데이트 추가(POST)”를 만들면, 시민이 변화를 추적할 수 있습니다.
            </div>
          </div>
        </div>
      </div>

      {/* 공약 목록(카드) */}
      <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-base font-semibold">공약 목록</div>
          </div>
          <div className="text-xs text-gray-500">총 {items.length} / {dash?.pledges?.total ?? items.length}</div>
        </div>

        {err && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>}

        <div className="mt-4 space-y-3">
          {items.map((p) => (
            <Link
              key={p.pledge_id}
              href={`/pledges/${p.pledge_id}`}
              className="block rounded-2xl border p-4 hover:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold">{p.title}</div>
                  <div className="mt-1 text-sm text-gray-600">
                    {(p.category ?? "미분류")} · {(p.term ?? "-")} · {(p.mayor ?? "-")}
                  </div>
                  <div className="mt-2 text-sm text-gray-700">
                    {p.summary?.trim() ? p.summary : <span className="text-gray-400">요약 없음</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">{p.status ?? "UNKNOWN"} · {pct(p.progress ?? 0)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-center">
          <button
            onClick={fetchMore}
            disabled={!nextCursor || loading}
            className="rounded-xl border bg-white px-6 py-2 text-sm shadow-sm disabled:opacity-50"
          >
            {loading ? "불러오는 중..." : nextCursor ? "더 보기" : "끝"}
          </button>
        </div>

        <div className="mt-6 text-xs text-gray-500">{dash?.note ?? "Dashboard summary (v1)."}</div>
      </div>
    </main>
  );
}