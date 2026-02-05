"use client";

// app/watchboard/WatchBoard.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  PROJECTS,
  EvidenceTypeLabel,
  type Project,
  type EvidenceType,
  getNextCheck,
  getScore,
} from "./data/projects";
import BidsPanel from "./data/BidsPanel";

const STORAGE_KEY = "civic_watch_watchlist_v2";

function pill(text: string) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
      {text}
    </span>
  );
}

function evidenceBadge(t: EvidenceType) {
  const label = EvidenceTypeLabel[t];
  const cls =
    t === "BUDGET" || t === "BID"
      ? "border-black text-black"
      : "border-zinc-300 text-zinc-700";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>
      {label}
    </span>
  );
}

export default function WatchBoard() {
  const [q, setQ] = useState("");
  const [watching, setWatching] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setWatching(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watching));
    } catch {}
  }, [watching]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return PROJECTS;

    const tokens = query.split(/\s+/).filter(Boolean);
    return PROJECTS.filter((p) => {
      const hay = [
        p.title,
        p.summary,
        p.area,
        p.category,
        ...(p.tags || []),
        ...(p.evidences || []).map((e) => `${e.type} ${e.title} ${e.note || ""}`),
      ]
        .join(" ")
        .toLowerCase();

      return tokens.every((t) => hay.includes(t));
    });
  }, [q]);

  const toggleWatch = (id: string) =>
    setWatching((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="min-h-screen bg-white px-4 py-8 text-zinc-950">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">고양시 시민 감시 현황판 (시범)</h1>
        <p className="mt-2 text-sm text-zinc-600">
          “기사 링크 1개”가 아니라, <b>근거(예산/입찰/공정/준공)</b>를 쌓아 신뢰도를 올리는 방식입니다.
          <br />
          원칙: <b>예산/입찰 근거가 나오기 전까지 ‘실행 확정’으로 단정하지 않습니다.</b>
        </p>
      </header>

      <div className="mb-6">
        <input
          className="w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-black"
          placeholder="검색: 대곡역, 도시재생, 통학로, 예산, 입찰, 철도..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* ✅ 입찰 탭 패널 (고양시정/기타) */}
      <div className="mb-8">
        <BidsPanel />
      </div>

      <div className="space-y-5">
        {filtered.map((p) => (
          <ProjectCard
            key={p.id}
            p={p}
            watching={!!watching[p.id]}
            onToggleWatch={() => toggleWatch(p.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectCard({
  p,
  watching,
  onToggleWatch,
}: {
  p: Project;
  watching: boolean;
  onToggleWatch: () => void;
}) {
  const { percent, types } = getScore(p);
  const nextCheck = getNextCheck(types);

  // ✅ 예산/입찰이 있으면 ‘신뢰 근거 확보’로 보이게
  const strong = types.has("BUDGET") || types.has("BID");

  return (
    <section className="rounded-2xl border p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{p.title}</h2>
          <p className="mt-1 text-sm text-zinc-700">{p.summary}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {pill(p.category)}
            {p.tags?.map((t) => (
              <React.Fragment key={t}>{pill(`#${t}`)}</React.Fragment>
            ))}
          </div>
        </div>

        <button
          onClick={onToggleWatch}
          className="shrink-0 rounded-lg border px-3 py-2 text-sm hover:bg-zinc-50"
        >
          {watching ? "지켜보는중" : "지켜보기"}
        </button>
      </div>

      <div className="mt-4 rounded-xl bg-zinc-50 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <b>신뢰 점수:</b>{" "}
            <span className={strong ? "text-black" : "text-zinc-700"}>
              {percent}%
            </span>{" "}
            <span className="text-zinc-500">
              (근거 타입 {Array.from(types).length}개)
            </span>
          </div>
          <div className="flex gap-2">
            {Array.from(types).map((t) => (
              <React.Fragment key={t}>{evidenceBadge(t)}</React.Fragment>
            ))}
          </div>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-2 rounded-full bg-black"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="mt-3 text-sm text-zinc-700">
          <b>다음 확인 포인트:</b> {nextCheck}
        </div>

        {p.analystNote && (
          <div className="mt-3 text-sm text-zinc-700">
            <b>판단 메모:</b> {p.analystNote}
          </div>
        )}
      </div>

      <h3 className="mt-5 text-sm font-semibold">공식 근거(원문 링크)</h3>
      <div className="mt-3 space-y-3">
        {p.evidences.map((e, idx) => (
          <div key={`${p.id}-${idx}`} className="rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{e.title}</div>
                <div className="mt-1 text-xs text-zinc-600">시점: {e.date}</div>
              </div>
              <div className="shrink-0">{evidenceBadge(e.type)}</div>
            </div>

            {e.note && (
              <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                {e.note}
              </pre>
            )}

            <a
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm text-blue-600 underline"
            >
              원문 열기
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}