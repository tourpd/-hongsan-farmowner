// app/pledges/[id]/page.tsx
import Link from "next/link";

type Pledge = {
  pledge_id: string;
  term: string | null;
  mayor: string | null;
  title: string;
  category: string | null;
  status: string | null;
  progress: number | null;
  owner_dept: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

type UpdateRow = {
  id: string;
  pledge_id: string;
  update_date: string | null;
  note: string | null;
  progress_delta: number | null;
  created_at: string;
};

type EvidenceRow = {
  id: string;
  pledge_id: string;
  kind: string | null;
  title: string | null;
  url: string | null;
  published_at: string | null;
  created_at: string;
};

type ApiOk = {
  ok: true;
  pledge: Pledge;
  updates: UpdateRow[];
  evidence: EvidenceRow[];
  citizen: { total: number; byType: Record<string, number> };
  note?: string;
};

type ApiErr = { ok: false; error: string };

function fmtDate(s?: string | null) {
  if (!s) return "-";
  try {
    const d = new Date(s);
    return d.toLocaleString("ko-KR");
  } catch {
    return s;
  }
}

function pct(n?: number | null) {
  const v = typeof n === "number" ? n : 0;
  return `${Math.max(0, Math.min(100, v))}%`;
}

export default async function PledgeDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;

  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/pledges/${id}`, {
    cache: "no-store",
  }).catch(() => null);

  let data: ApiOk | null = null;
  let err: string | null = null;

  if (!res) {
    err = "서버 요청 실패 (fetch).";
  } else {
    const json = (await res.json().catch(() => null)) as ApiOk | ApiErr | null;
    if (!json) err = "Invalid JSON";
    else if ((json as any).ok) data = json as ApiOk;
    else err = (json as ApiErr).error ?? `HTTP ${res.status}`;
  }

  if (err || !data) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-4">
          <Link href="/" className="text-sm text-gray-600 underline">← 메인으로</Link>
        </div>
        <h1 className="text-2xl font-bold">공약 상세</h1>
        <p className="mt-3 rounded-xl border bg-white p-4 text-red-600">
          에러: {err ?? "unknown"}
        </p>
        <p className="mt-3 text-sm text-gray-500">
          확인: /api/pledges/{id} 가 200 JSON을 반환하는지 보십시오.
        </p>
      </main>
    );
  }

  const p = data.pledge;
  const byType = data.citizen?.byType ?? {};
  const agree = byType["AGREE"] ?? 0;
  const disagree = byType["DISAGREE"] ?? 0;
  const important = byType["IMPORTANT"] ?? 0;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-gray-600 underline">← 메인으로</Link>
        <div className="text-xs text-gray-500">updated: {fmtDate(p.updated_at)}</div>
      </div>

      <div className="rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{p.title}</h1>
            <div className="mt-2 text-sm text-gray-600">
              {p.category ?? "미분류"} · {p.term ?? "-"} · {p.mayor ?? "-"}
            </div>
          </div>

          <div className="mt-3 flex gap-2 md:mt-0">
            <span className="rounded-full border px-3 py-1 text-sm">
              {p.status ?? "UNKNOWN"}
            </span>
            <span className="rounded-full border px-3 py-1 text-sm">
              진행 {pct(p.progress)}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
          {p.summary?.trim() ? p.summary : "요약이 아직 없습니다. (summary 컬럼)"}
        </div>
      </div>

      {/* 시민 반응 */}
      <section className="mt-6 rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-semibold">시민 반응</h2>
        <p className="mt-1 text-sm text-gray-600">
          하루 1회 제한(같은 기기/브라우저/IP+UA 기준) — 중복 클릭은 DB에서 막힙니다.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <button
            className="rounded-xl border bg-white p-4 text-left hover:bg-gray-50"
            onClick={async () => {
              const r = await fetch(`/api/pledges/${p.pledge_id}/actions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action_type: "AGREE" }),
              });
              const j = await r.json().catch(() => null);
              alert(j?.ok ? "등록 완료" : (j?.error ?? "실패"));
              if (j?.ok) location.reload();
            }}
          >
            <div className="text-sm text-gray-500">찬성</div>
            <div className="mt-1 text-2xl font-bold">{agree}</div>
          </button>

          <button
            className="rounded-xl border bg-white p-4 text-left hover:bg-gray-50"
            onClick={async () => {
              const r = await fetch(`/api/pledges/${p.pledge_id}/actions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action_type: "DISAGREE" }),
              });
              const j = await r.json().catch(() => null);
              alert(j?.ok ? "등록 완료" : (j?.error ?? "실패"));
              if (j?.ok) location.reload();
            }}
          >
            <div className="text-sm text-gray-500">반대</div>
            <div className="mt-1 text-2xl font-bold">{disagree}</div>
          </button>

          <button
            className="rounded-xl border bg-white p-4 text-left hover:bg-gray-50"
            onClick={async () => {
              const r = await fetch(`/api/pledges/${p.pledge_id}/actions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action_type: "IMPORTANT" }),
              });
              const j = await r.json().catch(() => null);
              alert(j?.ok ? "등록 완료" : (j?.error ?? "실패"));
              if (j?.ok) location.reload();
            }}
          >
            <div className="text-sm text-gray-500">중요</div>
            <div className="mt-1 text-2xl font-bold">{important}</div>
          </button>
        </div>
      </section>

      {/* 업데이트 */}
      <section className="mt-6 rounded-2xl border bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">월별 업데이트(pledge_updates)</h2>
          <div className="text-xs text-gray-500">최근 {data.updates.length}건</div>
        </div>

        {data.updates.length === 0 ? (
          <div className="mt-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
            아직 업데이트가 없습니다. (다음 단계: “월별 업데이트 추가 POST” 붙이면 이 카드가 살아납니다.)
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.updates.map((u) => (
              <li key={u.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {u.update_date ?? "(날짜없음)"}{" "}
                    {typeof u.progress_delta === "number" ? (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-1 text-xs">
                        {u.progress_delta > 0 ? `+${u.progress_delta}` : `${u.progress_delta}`}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-500">{fmtDate(u.created_at)}</div>
                </div>
                <div className="mt-2 whitespace-pre-line text-sm text-gray-700">
                  {u.note?.trim() ? u.note : <span className="text-gray-400">(내용 없음)</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 증거 */}
      <section className="mt-6 rounded-2xl border bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">증거 링크(pledge_evidence)</h2>
          <div className="text-xs text-gray-500">총 {data.evidence.length}건</div>
        </div>

        {data.evidence.length === 0 ? (
          <div className="mt-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
            아직 증거 링크가 없습니다. (보도자료/시의회 자료/입찰/예산서 링크를 누적하면 “증거 기반”이 됩니다.)
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.evidence.map((e) => (
              <li key={e.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {e.title ?? "(제목없음)"}{" "}
                    {e.kind ? (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-1 text-xs">{e.kind}</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-500">{e.published_at ?? "-"}</div>
                </div>
                {e.url ? (
                  <a className="mt-2 block break-all text-sm text-blue-600 underline" href={e.url} target="_blank">
                    {e.url}
                  </a>
                ) : (
                  <div className="mt-2 text-sm text-gray-400">(URL 없음)</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 text-xs text-gray-500">{data.note ?? "Pledge detail (v1)."}</div>
    </main>
  );
}