"use client";

// app/watchboard/data/BidsPanel.tsx
import React, { useEffect, useMemo, useState } from "react";

type Tab = "city" | "other";

type BidItem = {
  bidNtceDt: string;
  ntceInsttNm: string;
  bidNtceNm: string;
  bidNtceNo: string;
  bidNtceOrd: string;
  bids_scope?: string;
};

type ApiOk = {
  ok: true;
  counts: { city: number; edu: number; other: number; other_detail: number };
  tab: string;
  limit: number;
  items: BidItem[];
};

type ApiFail = { ok: false; error: string };

export default function BidsPanel() {
  const [tab, setTab] = useState<Tab>("city");
  const [limit, setLimit] = useState(20);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiOk | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const counts = data?.counts;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/bids?tab=${tab}&limit=${limit}`, { cache: "no-store" });
        const json = (await res.json()) as ApiOk | ApiFail;
        if (!alive) return;
        if (!json.ok) {
          setErr(json.error || "API error");
          setData(null);
        } else {
          setData(json);
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "fetch failed");
        setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tab, limit]);

  const cityLabel = useMemo(() => {
    const n = counts?.city ?? 0;
    return `고양시정(${n})`;
  }, [counts?.city]);

  const otherLabel = useMemo(() => {
    const n = counts?.other ?? 0; // EDU+OTHER 합산
    return `기타(${n})`;
  }, [counts?.other]);

  return (
    <section className="rounded-2xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">최근 입찰 공고(자동 수집)</div>
          <div className="mt-1 text-xs text-zinc-600">
            탭 기준: CITY(고양시정) vs OTHER(교육+민간/기타)
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("city")}
            className={`rounded-lg border px-3 py-2 text-sm ${
              tab === "city" ? "bg-black text-white border-black" : "hover:bg-zinc-50"
            }`}
          >
            {cityLabel}
          </button>
          <button
            onClick={() => setTab("other")}
            className={`rounded-lg border px-3 py-2 text-sm ${
              tab === "other" ? "bg-black text-white border-black" : "hover:bg-zinc-50"
            }`}
          >
            {otherLabel}
          </button>

          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[10, 20, 30, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}개
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        {loading && <div className="text-sm text-zinc-600">불러오는 중...</div>}
        {err && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}

        {!loading && !err && data && (
          <div className="space-y-3">
            {data.items.map((b) => (
              <div key={`${b.bidNtceNo}-${b.bidNtceOrd}`} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{b.bidNtceNm}</div>
                    <div className="mt-1 text-xs text-zinc-600">
                      {b.bidNtceDt} · {b.ntceInsttNm}
                    </div>
                    <div className="mt-2 text-xs text-zinc-600">
                      공고번호: {b.bidNtceNo} / 차수: {b.bidNtceOrd}{" "}
                      {b.bids_scope ? `· scope: ${b.bids_scope}` : ""}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {data.items.length === 0 && (
              <div className="text-sm text-zinc-600">표시할 항목이 없습니다.</div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}