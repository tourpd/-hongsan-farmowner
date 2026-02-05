// app/api/admin/ingest-g2b/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BizType = "cnstwk" | "servc" | "thng" | "frgcpt";

/**
 * 조달청 나라장터 입찰공고정보서비스
 * Service URL(명세): http://apis.data.go.kr/1230000/ad/BidPublicInfoService
 * 운영에서는 https도 되긴 하지만, 문제시 http로 바꿔 테스트하세요.
 */
const BASE_URL = "https://apis.data.go.kr/1230000/ad/BidPublicInfoService";

const OP_BY_BIZ: Record<BizType, string> = {
  cnstwk: "getBidPblancListInfoCnstwk",
  servc: "getBidPblancListInfoServc",
  thng: "getBidPblancListInfoThng",
  frgcpt: "getBidPblancListInfoFrgcpt",
};

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * default: 최근 24시간 윈도우
 * format: YYYYMMDDHHmm
 */
function defaultWindowKST(): { from: string; to: string } {
  const now = new Date();
  const to = fmtYYYYMMDDHHmm(now);

  const fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const from = fmtYYYYMMDDHHmm(fromDate);
  return { from, to };
}

function fmtYYYYMMDDHHmm(d: Date) {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  return `${yyyy}${mm}${dd}${hh}${min}`;
}

// YYYYMMDDHHmm -> Date(로컬)
function parseYYYYMMDDHHmm(s: string): Date | null {
  const m = String(s).match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  const [, yyyy, MM, dd, hh, mm] = m;
  return new Date(
    Number(yyyy),
    Number(MM) - 1,
    Number(dd),
    Number(hh),
    Number(mm),
    0,
    0
  );
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

/**
 * ✅ data.go.kr 응답 header 추출(정상/에러 모두 대응)
 * - 정상: payload.response.header
 * - 에러: payload["nkoneps.com.response.ResponseError"].header
 */
function extractHeader(payload: any): { resultCode?: string; resultMsg?: string } {
  const h1 = payload?.response?.header;
  if (h1?.resultCode != null || h1?.resultMsg != null) {
    return {
      resultCode: h1?.resultCode != null ? String(h1.resultCode) : undefined,
      resultMsg: h1?.resultMsg != null ? String(h1.resultMsg) : undefined,
    };
  }

  const err = payload?.["nkoneps.com.response.ResponseError"];
  const h2 = err?.header;
  if (h2?.resultCode != null || h2?.resultMsg != null) {
    return {
      resultCode: h2?.resultCode != null ? String(h2.resultCode) : undefined,
      resultMsg: h2?.resultMsg != null ? String(h2.resultMsg) : undefined,
    };
  }

  return {};
}

/**
 * data.go.kr JSON 응답 items 형태는 케이스가 섞입니다.
 * - response.body.items.item (일반)
 * - response.body.items (배열로 바로 오는 케이스)
 */
function extractItems(payload: any): any[] {
  const items = payload?.response?.body?.items;
  if (!items) return [];

  const itemA = items?.item;
  if (itemA) return Array.isArray(itemA) ? itemA : [itemA];

  if (Array.isArray(items)) return items;

  return [];
}

function extractTotalCount(payload: any): number | null {
  const tc = payload?.response?.body?.totalCount;
  if (typeof tc === "number") return tc;
  if (typeof tc === "string" && tc.trim() !== "") return Number(tc);
  return null;
}

function safeNum(x: any): number | null {
  if (x === null || x === undefined) return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  const s = String(x).replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toDateOnly(yyyyMMddOrIso: any): string | null {
  if (!yyyyMMddOrIso) return null;
  const s = String(yyyyMMddOrIso).trim();
  // "2026-02-04 23:51:47" -> "2026-02-04"
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  // "20260204" 같은 케이스 대비
  const m2 = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  return null;
}

/**
 * ✅ tenders 테이블 upsert용 정규화 (현재 스키마 기준)
 * (중요) posted_at 컬럼이 없으므로 넣지 않습니다.
 */
function normalizeToTender(row: any) {
  const bidNtceNo = row?.bidNtceNo ?? row?.bidntceno ?? null;
  const bidNtceOrd = row?.bidNtceOrd ?? row?.bidntceord ?? null;

  const bidNo =
    bidNtceNo && bidNtceOrd !== null && bidNtceOrd !== undefined && `${bidNtceOrd}` !== ""
      ? `${bidNtceNo}-${bidNtceOrd}`
      : bidNtceNo
        ? String(bidNtceNo)
        : null;

  if (!bidNo) return null;

  const title =
    row?.bidNtceNm ??
    row?.bidntcenm ??
    row?.ntceNm ??
    row?.ntcenm ??
    null;

  const agency =
    row?.ntceInsttNm ??
    row?.ntceinsttnm ??
    row?.dminsttNm ??
    row?.dminsttnm ??
    null;

  // 공고일시(원본) -> announced_at(date)만 저장(시간은 raw로 유지)
  const postedAtRaw =
    row?.bidNtceDt ??
    row?.bidntcedt ??
    row?.ntceDt ??
    row?.ntcedt ??
    null;

  const announcedAt = toDateOnly(postedAtRaw);

  const openAt =
    row?.opengDt ??
    row?.opengdt ??
    null;

  const baseAmount =
    safeNum(row?.bscAmt) ??
    safeNum(row?.bscamt) ??
    safeNum(row?.baseAmt) ??
    safeNum(row?.baseamt) ??
    null;

  const estimatedPrice =
    safeNum(row?.presmptPrce) ??
    safeNum(row?.presmptprce) ??
    safeNum(row?.estmtdAmt) ??
    safeNum(row?.estmtdamt) ??
    null;

  return {
    bid_no: bidNo,
    bid_ord: bidNtceOrd != null ? String(bidNtceOrd) : null,
    title,
    agency,
    demand_org:
      row?.dmndInsttNm ??
      row?.dmndinsttnm ??
      row?.dminsttNm ??
      row?.dminsttnm ??
      null,
    announced_at: announcedAt, // ✅ date 컬럼
    open_at: openAt,           // ✅ 방금 추가한 컬럼
    base_amount: baseAmount,
    estimated_price: estimatedPrice,
    bid_ntce_no: bidNtceNo ? String(bidNtceNo) : null,
    bid_ntce_ord: bidNtceOrd != null ? String(bidNtceOrd) : null,
    raw: row,
    source: "g2b_data_go_kr",
    scope: row?.rgstTyNm ? String(row.rgstTyNm) : null, // 일단 참고용(원하면 다른 값으로)
    source_key: null,
    updated_at: new Date().toISOString(),
  };
}

async function fetchPage(params: Record<string, string>) {
  const op = params.__op;
  delete params.__op;

  const apiUrl = `${BASE_URL}/${op}`;
  const u = new URL(apiUrl);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);

  const res = await fetch(u.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    return { ok: false as const, status: res.status, url: u.toString(), text };
  }

  try {
    const json = JSON.parse(text);
    return { ok: true as const, status: res.status, url: u.toString(), json, text };
  } catch {
    return { ok: false as const, status: 200, url: u.toString(), text };
  }
}

/**
 * ✅ 기간 초과(07) 방지용: from~to를 chunkDays 단위로 쪼개서 처리
 * 기본 7일 (안전)
 */
function buildWindows(from: string, to: string, chunkDays: number): { from: string; to: string }[] {
  const dFrom = parseYYYYMMDDHHmm(from);
  const dTo = parseYYYYMMDDHHmm(to);
  if (!dFrom || !dTo) return [{ from, to }];

  const windows: { from: string; to: string }[] = [];
  let cur = dFrom;

  while (cur.getTime() <= dTo.getTime()) {
    const end = minDate(addDays(cur, chunkDays), dTo);
    windows.push({ from: fmtYYYYMMDDHHmm(cur), to: fmtYYYYMMDDHHmm(end) });
    cur = addDays(end, 0.00001 as any); // 안전하게 다음 tick (사실상 다음 루프용)
    // 위가 찝찝하면 1분 더해도 되는데, 여기선 chunkDays 단위라 크게 문제 없습니다.
  }

  // 위 방식이 애매하면 단순히 "끝+1분" 방식으로 하셔도 됩니다.
  return windows;
}

export async function POST(req: NextRequest) {
  try {
    const serviceKey = mustGetEnv("DATA_GO_KR_SERVICE_KEY");
    const supabaseUrl = mustGetEnv("SUPABASE_URL");
    const supabaseServiceRoleKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const { searchParams } = new URL(req.url);

    const debug = searchParams.get("debug") === "1";

    const biz = (searchParams.get("biz") as BizType) ?? "cnstwk";
    if (!OP_BY_BIZ[biz]) {
      return NextResponse.json(
        { ok: false, error: `Invalid biz. Use one of: ${Object.keys(OP_BY_BIZ).join(", ")}` },
        { status: 400 }
      );
    }

    const inqryDiv = searchParams.get("inqryDiv") ?? "1";
    const numOfRows = searchParams.get("numOfRows") ?? "100";
    const maxPages = Number(searchParams.get("maxPages") ?? "50");

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const baseWindow = from && to ? { from, to } : defaultWindowKST();

    // ✅ 기본 7일 단위로 쪼개기 (원하면 chunkDays=3 이런 식으로 조절)
    const chunkDays = Number(searchParams.get("chunkDays") ?? "7");

    const op = OP_BY_BIZ[biz];

    let totalUpserted = 0;
    let totalFetched = 0;
    let totalPages = 0;
    const windows = buildWindows(baseWindow.from, baseWindow.to, chunkDays);

    for (const w of windows) {
      let pageNo = Number(searchParams.get("pageNo") ?? "1");
      let pagesThisWindow = 0;

      while (pagesThisWindow < maxPages) {
        pagesThisWindow++;
        totalPages++;

        const pageParams: Record<string, string> = {
          __op: op,
          serviceKey,
          pageNo: String(pageNo),
          numOfRows,
          inqryDiv,
          inqryBgnDt: w.from,
          inqryEndDt: w.to,
          type: "json",
        };

        const r = await fetchPage(pageParams);

        if (!r.ok) {
          return NextResponse.json(
            {
              ok: false,
              stage: "fetch",
              biz,
              op,
              pageNo,
              window: w,
              status: r.status,
              url: (r as any).url,
              body: (r as any).text?.slice(0, 2000),
            },
            { status: 502 }
          );
        }

        const header = extractHeader(r.json);

        // ✅ 200이어도 API header 에러일 수 있음
        if (header.resultCode && header.resultCode !== "00") {
          // 가장 흔한 케이스: 07 입력범위값 초과
          if (header.resultCode === "07") {
            if (debug) {
              return NextResponse.json({
                ok: false,
                stage: "api-header",
                biz,
                op,
                pageNo,
                window: w,
                url: r.url,
                apiHeader: header,
                bodyPreview: r.text?.slice(0, 800),
                hint:
                  "입력범위값 초과(07)입니다. 기간을 더 잘게(chunkDays를 더 작게) 쪼개서 재시도하세요. 예: chunkDays=3 또는 chunkDays=1",
              });
            }
            // debug 아니면 그냥 이 윈도우는 스킵하고 다음 윈도우로(혹은 즉시 실패로 바꿔도 됨)
            break;
          }

          return NextResponse.json(
            {
              ok: false,
              stage: "api-header",
              biz,
              op,
              pageNo,
              window: w,
              url: r.url,
              apiHeader: header,
              bodyPreview: r.text?.slice(0, 800),
            },
            { status: 502 }
          );
        }

        const items = extractItems(r.json);
        const totalCount = extractTotalCount(r.json);

        if (!items.length) {
          if (debug) {
            return NextResponse.json({
              ok: true,
              biz,
              op,
              window: w,
              pages: totalPages,
              totalFetched,
              totalUpserted,
              apiHeader: header,
              totalCount,
              url: r.url,
              bodyPreview: r.text?.slice(0, 800),
              note: "items=0. 이 윈도우에 데이터가 없거나, 파라미터 조건에 해당 공고가 없는 케이스입니다.",
            });
          }
          break;
        }

        totalFetched += items.length;

        const rows = items.map((it) => normalizeToTender(it)).filter(Boolean) as any[];

        if (rows.length) {
          const { error } = await supabase.from("tenders").upsert(rows, { onConflict: "bid_no" });
          if (error) {
            return NextResponse.json(
              { ok: false, stage: "upsert", error: error.message, hint: (error as any).hint },
              { status: 500 }
            );
          }
          totalUpserted += rows.length;
        }

        pageNo += 1;

        // totalCount 기반 종료
        if (typeof totalCount === "number") {
          const perPage = Number(numOfRows);
          const maxNeededPages = Math.ceil(totalCount / perPage);
          if (pageNo > maxNeededPages) break;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      biz,
      op,
      baseWindow,
      chunkDays,
      windows: windows.length,
      pages: totalPages,
      totalFetched,
      totalUpserted,
      note:
        "기간이 길면 07(입력범위값 초과)이 납니다. 그래서 chunkDays 단위로 기간을 쪼개서 수집합니다. 이후 enrich-budgets + 상세조회(enrich detail)로 금액 확정하세요.",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}