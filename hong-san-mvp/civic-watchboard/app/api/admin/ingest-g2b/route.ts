// app/api/admin/ingest-g2b/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BizType = "cnstwk" | "servc" | "thng" | "frgcpt";

/**
 * 조달청 나라장터 입찰공고정보서비스
 * Service URL: https://apis.data.go.kr/1230000/ad/BidPublicInfoService
 */
const BASE_URL = "https://apis.data.go.kr/1230000/ad/BidPublicInfoService";

const OP_BY_BIZ: Record<BizType, string> = {
  cnstwk: "getBidPblancListInfoCnstwk",
  servc: "getBidPblancListInfoServc",
  thng: "getBidPblancListInfoThng",
  frgcpt: "getBidPblancListInfoFrgcpt",
};

function mustGetEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * default: 최근 24시간 윈도우 (서버 시간 기준)
 * format: YYYYMMDDHHmm
 */
function defaultWindow(): { from: string; to: string } {
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

/**
 * data.go.kr JSON 응답은 보통 response.body.items.item (배열/단일)
 */
function extractItems(payload: any): any[] {
  const item = payload?.response?.body?.items?.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
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

/**
 * 날짜 문자열을 가능한 한 ISO로 변환(실패하면 null)
 * - 202602051230 (YYYYMMDDHHmm)
 * - 20260205123000 (YYYYMMDDHHmmss)
 * - 2026-02-05 12:30:00 / 2026-02-05T12:30:00
 */
function toIsoOrNull(raw: any): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // YYYYMMDDHHmm or YYYYMMDDHHmmss
  if (/^\d{12}$/.test(s) || /^\d{14}$/.test(s)) {
    const yyyy = s.slice(0, 4);
    const mm = s.slice(4, 6);
    const dd = s.slice(6, 8);
    const hh = s.slice(8, 10);
    const mi = s.slice(10, 12);
    const ss = s.length === 14 ? s.slice(12, 14) : "00";
    // 로컬 시간으로 해석(운영상 KST 서버가 아니라면 스케줄러가 KST 윈도우를 넘기는 방식 권장)
    const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // "2026-02-05 12:30:00" -> "2026-02-05T12:30:00"
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)) {
    const d = new Date(s.replace(" ", "T"));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // ISO 비슷하면 그냥 Date 파싱 시도
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function toDateOnly(iso: string | null): string | null {
  if (!iso) return null;
  // YYYY-MM-DD
  return iso.slice(0, 10);
}

/**
 * 우리 tenders 테이블에 들어갈 정규화
 * - bid_no UNIQUE: bidNtceNo-bidNtceOrd 조합
 * - /api/bids가 기대하는 컬럼(announced_at, demand_org, bid_ntce_no/ord, budget 등)을 채움
 */
function normalizeToTender(row: any, biz: BizType) {
  const bidNtceNo = row?.bidNtceNo ?? row?.bidntceno ?? null;
  const bidNtceOrd = row?.bidNtceOrd ?? row?.bidntceord ?? null;

  const bidNo =
    bidNtceNo && bidNtceOrd !== null && bidNtceOrd !== undefined && `${bidNtceOrd}` !== ""
      ? `${bidNtceNo}-${bidNtceOrd}`
      : bidNtceNo
        ? String(bidNtceNo)
        : null;

  if (!bidNo) return null;

  // 제목/기관/수요기관/게시일
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

  const demandOrg =
    row?.dminsttNm ??
    row?.dminsttnm ??
    row?.dmndInsttNm ??
    row?.dmndinsttnm ??
    null;

  const postedRaw =
    row?.bidNtceDt ??
    row?.bidntcedt ??
    row?.ntceDt ??
    row?.ntcedt ??
    null;

  const openRaw =
    row?.opengDt ??
    row?.opengdt ??
    null;

  const postedIso = toIsoOrNull(postedRaw);
  const openIso = toIsoOrNull(openRaw);

  // 기초금액/예정가격(목록에 없을 수도 있음)
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

  // budget 컬럼이 있으면 우선 채움(없으면 null)
  const budget = baseAmount ?? estimatedPrice ?? null;

  // scope(시군구 탭 분리용): 우선 간단 규칙
  const scope =
    typeof agency === "string" && agency.includes("고양시")
      ? "CITY"
      : null;

  // source_key: 소스 식별키(나중에 중복/추적에 유용)
  const sourceKey = `${biz}:${bidNo}`;

  return {
    // ✅ 핵심
    bid_no: bidNo,
    bid_ntce_no: bidNtceNo ? String(bidNtceNo) : null,
    bid_ntce_ord:
      bidNtceOrd === null || bidNtceOrd === undefined || `${bidNtceOrd}` === ""
        ? null
        : String(bidNtceOrd),

    // ✅ /api/bids에서 쓰는 이름과 맞춤
    title,
    agency,
    demand_org: demandOrg ?? agency ?? null,
    announced_at: toDateOnly(postedIso) ?? null,

    // 원본 시각(보존)
    posted_at: postedRaw,
    open_at: openRaw,

    // 금액
    budget,
    base_amount: baseAmount,
    estimated_price: estimatedPrice,

    // 분류/추적
    biz_type: biz,
    source: "data.go.kr",
    source_key: sourceKey,
    scope,

    raw: row,
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
    return { ok: false as const, status: res.status, text };
  }

  try {
    const json = JSON.parse(text);
    return { ok: true as const, json };
  } catch {
    return { ok: false as const, status: 200, text };
  }
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

    const biz = (searchParams.get("biz") as BizType) ?? "cnstwk";
    if (!OP_BY_BIZ[biz]) {
      return NextResponse.json(
        { ok: false, error: `Invalid biz. Use one of: ${Object.keys(OP_BY_BIZ).join(", ")}` },
        { status: 400 }
      );
    }

    const inqryDiv = searchParams.get("inqryDiv") ?? "1";
    const numOfRows = searchParams.get("numOfRows") ?? "100";
    const maxPages = Number(searchParams.get("maxPages") ?? "30");

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const window = from && to ? { from, to } : defaultWindow();

    let pageNo = Number(searchParams.get("pageNo") ?? "1");
    const op = OP_BY_BIZ[biz];

    let totalUpserted = 0;
    let totalFetched = 0;
    let pages = 0;

    while (pages < maxPages) {
      pages++;

      const pageParams: Record<string, string> = {
        __op: op,
        serviceKey,
        pageNo: String(pageNo),
        numOfRows,
        inqryDiv,
        inqryBgnDt: window.from,
        inqryEndDt: window.to,
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
            window,
            status: r.status,
            body: r.text?.slice(0, 2000),
          },
          { status: 502 }
        );
      }

      const items = extractItems(r.json);
      const totalCount = extractTotalCount(r.json);

      totalFetched += items.length;
      if (!items.length) break;

      const rows = items
        .map((it) => normalizeToTender(it, biz))
        .filter(Boolean) as any[];

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

      if (typeof totalCount === "number") {
        const perPage = Number(numOfRows);
        const maxNeededPages = Math.ceil(totalCount / perPage);
        if (pageNo > maxNeededPages) break;
      }
    }

    return NextResponse.json({
      ok: true,
      biz,
      op,
      window,
      pages,
      totalFetched,
      totalUpserted,
      note:
        "이제 tenders에 bid_ntce_no/ord, announced_at, demand_org, budget, source_key, scope가 채워집니다. 이후 enrich-budgets로 base_amount 확정 보강을 진행하세요.",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}