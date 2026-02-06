// scripts/ingest-g2b.ts
import path from "node:path";
import Database from "better-sqlite3";
import axios from "axios";

type Scope = "CITY" | "EDU" | "OTHER";

type BidItem = {
  bidNtceDt: string;     // "YYYY-MM-DD HH:mm:ss"
  ntceInsttNm: string;   // 기관명
  bidNtceNm: string;     // 공고명
  bidNtceNo: string;     // 공고번호
  bidNtceOrd: string;    // 차수
  bids_scope: Scope;     // CITY/EDU/OTHER
};

const DB_PATH = path.join(process.cwd(), "data", "civicwatch.db");

// ✅ 환경변수 키 (따옴표는 “필수 아님”. 특수문자 섞이면 따옴표 권장)
const G2B_SERVICE_KEY = process.env.G2B_SERVICE_KEY || process.env.G2B_SERVICEKEY || "";
if (!G2B_SERVICE_KEY) {
  console.error("❌ G2B_SERVICE_KEY 환경변수가 없습니다. 예: export G2B_SERVICE_KEY='...'");
  process.exit(1);
}

// ✅ 엔드포인트: 04 / 비04 둘 다 시도
const ENDPOINTS = [
  "https://apis.data.go.kr/1230000/BidPublicInfoService04/getBidPblancListInfoServcPPSSrch",
  "https://apis.data.go.kr/1230000/BidPublicInfoService/getBidPblancListInfoServcPPSSrch",
];

// =========================
// 0) 유틸
// =========================
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function maskKey(k: string) {
  if (!k) return "";
  if (k.length <= 8) return "****";
  return `${k.slice(0, 4)}****${k.slice(-4)}`;
}

// =========================
// 1) “고양 우선 + 고양 키워드” 필터
//   - 고양시 기관이 아니더라도
//     대곡/GTX/창릉/킨텍스 등 “고양 관련 핵심 키워드”면 포함
// =========================
const GOYANG_TITLE_KEYWORDS = [
  "고양", "덕양", "일산", "킨텍스",
  "대곡", "대곡역",
  "창릉",
  "GTX", "GTX-A", "광역교통", "환승", "환승센터", "연계", "버스"
];

function isGoyangPriority(instt: string, title: string): boolean {
  const a = (instt || "").trim();
  const b = (title || "").trim();

  // ✅ 1순위: 기관명에 고양/고양시가 명확히 포함
  const insttHit =
    a.includes("경기도 고양시") ||
    a.startsWith("고양시") ||
    a.includes("고양교육지원청") ||
    a.includes("고양") ||
    a.includes("고양시 ");

  if (insttHit) return true;

  // ✅ 2순위: 제목에 고양 관련 핵심 키워드가 있으면 포함 (대곡역/GTX 등)
  const titleHit = GOYANG_TITLE_KEYWORDS.some((kw) => b.includes(kw));
  return titleHit;
}

// =========================
// 2) scope 분류
// =========================
function classifyScope(instt: string): Scope {
  const s = (instt || "").trim();

  if (
    s.includes("교육청") ||
    s.includes("교육지원청") ||
    s.includes("학교") ||
    s.includes("고등학교") ||
    s.includes("중학교") ||
    s.includes("초등학교") ||
    s.includes("유치원")
  ) {
    return "EDU";
  }

  if (
    s.startsWith("경기도 고양시") ||
    s.startsWith("고양시") ||
    s.includes("고양시 ") ||
    s.includes("덕양구") ||
    s.includes("일산동구") ||
    s.includes("일산서구")
  ) {
    return "CITY";
  }

  return "OTHER";
}

// =========================
// 3) 날짜 문자열 정규화
// =========================
function normalizeDt(raw: any): string {
  const v = String(raw ?? "").trim();
  if (!v) return "";

  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(v)) return v;

  if (/^\d{12}$/.test(v) || /^\d{14}$/.test(v)) {
    const yyyy = v.slice(0, 4);
    const mm = v.slice(4, 6);
    const dd = v.slice(6, 8);
    const HH = v.slice(8, 10);
    const MM = v.slice(10, 12);
    const SS = v.length === 14 ? v.slice(12, 14) : "00";
    return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
  }

  return v;
}

// =========================
// 4) DB 준비
// =========================
function openDb() {
  const db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS bids (
      bidNtceDt TEXT,
      ntceInsttNm TEXT,
      bidNtceNm TEXT,
      bidNtceNo TEXT,
      bidNtceOrd TEXT,
      bids_scope TEXT,
      PRIMARY KEY (bidNtceNo, bidNtceOrd)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS ingest_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_bids_scope_dt ON bids(bids_scope, bidNtceDt);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bids_instt ON bids(ntceInsttNm);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bids_title ON bids(bidNtceNm);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bids_dt ON bids(bidNtceDt);`);

  return db;
}

function upsertBid(db: Database.Database, item: BidItem) {
  const stmt = db.prepare(`
    INSERT INTO bids (
      bidNtceDt, ntceInsttNm, bidNtceNm, bidNtceNo, bidNtceOrd, bids_scope
    ) VALUES (
      @bidNtceDt, @ntceInsttNm, @bidNtceNm, @bidNtceNo, @bidNtceOrd, @bids_scope
    )
    ON CONFLICT(bidNtceNo, bidNtceOrd) DO UPDATE SET
      bidNtceDt=excluded.bidNtceDt,
      ntceInsttNm=excluded.ntceInsttNm,
      bidNtceNm=excluded.bidNtceNm,
      bids_scope=excluded.bids_scope
  `);

  stmt.run(item);
}

// =========================
// 5) HTTP 호출 (JSON 우선)
// =========================
async function httpGetJson(url: string, params: Record<string, any>) {
  // data.go.kr는 종종 JSON 요청해도 XML/텍스트를 주기도 해서 방어적으로 처리
  const res = await axios.get(url, {
    params,
    timeout: 30_000,
    validateStatus: () => true,
    responseType: "text",
  });

  if (res.status >= 500) {
    throw new Error(`HTTP ${res.status} (server error): ${String(res.data).slice(0, 200)}`);
  }
  if (res.status >= 400) {
    throw new Error(`HTTP ${res.status}: ${String(res.data).slice(0, 200)}`);
  }

  const text = String(res.data ?? "").trim();
  if (!text) throw new Error("Empty response");

  // JSON 형태면 파싱
  if (text.startsWith("{") || text.startsWith("[")) {
    return JSON.parse(text);
  }

  // JSON이 아니라면 그대로 던져서 원인 파악
  throw new Error(`Non-JSON response(head): ${text.slice(0, 200)}`);
}

// =========================
// 6) G2B API 호출 (04/비04 순차 시도 + retry)
//   - 파라미터는 inqryBgnDt/inqryEndDt 를 기본으로 하고,
//     bidNtceBgnDt/bidNtceEndDt 도 같이 보내 “호환”을 최대화
// =========================
async function fetchG2BPage(from: string, to: string, pageNo: number, numOfRows: number) {
  const baseParams = {
    // ✅ 키 파라미터는 보통 ServiceKey가 맞습니다(대문자).
    // 다만 일부는 serviceKey도 쓰므로 둘 다 넣어 호환성을 올립니다.
    ServiceKey: G2B_SERVICE_KEY,
    serviceKey: G2B_SERVICE_KEY,

    // ✅ type 파라미터: _type을 쓰는 서비스가 많음
    _type: "json",

    pageNo,
    numOfRows,

    // ✅ 조회 구분
    inqryDiv: 1,

    // ✅ 기간 파라미터 (서비스마다 명칭이 달라 둘 다 넣음)
    inqryBgnDt: from,
    inqryEndDt: to,
    bidNtceBgnDt: from,
    bidNtceEndDt: to,
  };

  let lastErr: any = null;

  for (const endpoint of ENDPOINTS) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        // 너무 빠르게 치면 서버가 불안정해질 수 있어서 소폭 딜레이
        if (attempt > 1) await sleep(600 * attempt);

        const payload = await httpGetJson(endpoint, baseParams);
        return payload;
      } catch (e: any) {
        lastErr = e;

        const msg = String(e?.message || e);
        // 500/Non-JSON이면 retry 계속, 그 외는 즉시 실패
        const retryable =
          msg.includes("HTTP 500") ||
          msg.includes("server error") ||
          msg.includes("Non-JSON response") ||
          msg.includes("Empty response") ||
          msg.includes("timeout");

        if (!retryable) {
          throw new Error(
            `❌ non-retryable error at ${endpoint} (key=${maskKey(G2B_SERVICE_KEY)}): ${msg}`
          );
        }
      }
    }
  }

  throw new Error(
    `❌ all endpoints failed (key=${maskKey(G2B_SERVICE_KEY)}): ${String(lastErr?.message || lastErr)}`
  );
}

function extractItems(payload: any): any[] {
  const items1 = payload?.response?.body?.items;
  const items2 = payload?.response?.body?.items?.item;
  if (Array.isArray(items2)) return items2;
  if (Array.isArray(items1)) return items1;
  if (items2) return [items2];
  return [];
}

function extractTotalCount(payload: any): number {
  const tc = payload?.response?.body?.totalCount;
  const n = Number(tc);
  return Number.isFinite(n) ? n : 0;
}

// =========================
// 7) 월 수집 실행
// =========================
async function ingestMonth(yyyymm: string) {
  const yyyy = yyyymm.slice(0, 4);
  const mm = yyyymm.slice(4, 6);

  const from = `${yyyy}${mm}010000`;
  const to = `${yyyy}${mm}312359`;

  const db = openDb();
  const numRows = 200;

  let monthSaved = 0;

  console.log(`=== 📥 BID 월 수집: ${yyyymm} (${from} ~ ${to}) ===`);

  // 1) 첫 페이지로 totalCount 확보
  const firstPayload = await fetchG2BPage(from, to, 1, numRows);
  const totalCount = extractTotalCount(firstPayload);
  const pages = Math.max(1, Math.ceil(totalCount / numRows));

  console.log(`총건수(totalCount): ${totalCount}`);
  console.log(`페이지: 1 ~ ${pages} (numOfRows=${numRows})`);

  // 2) 페이지 루프
  for (let pageNo = 1; pageNo <= pages; pageNo++) {
    const payload = pageNo === 1 ? firstPayload : await fetchG2BPage(from, to, pageNo, numRows);
    const rawItems = extractItems(payload);

    let pageHit = 0;

    for (const r of rawItems) {
      const bidNtceDt = normalizeDt(r.bidNtceDt);
      const ntceInsttNm = String(r.ntceInsttNm ?? "").trim();
      const bidNtceNm = String(r.bidNtceNm ?? "").trim();
      const bidNtceNo = String(r.bidNtceNo ?? "").trim();
      const bidNtceOrd = String(r.bidNtceOrd ?? "").trim();

      if (!bidNtceNo) continue;

      if (!isGoyangPriority(ntceInsttNm, bidNtceNm)) continue;

      const scope = classifyScope(ntceInsttNm);

      upsertBid(db, {
        bidNtceDt,
        ntceInsttNm,
        bidNtceNm,
        bidNtceNo,
        bidNtceOrd,
        bids_scope: scope,
      });

      pageHit++;
      monthSaved++;
    }

    if (pageNo % 10 === 0 || pageNo === pages) {
      console.log(`page ${pageNo}/${pages}  +${pageHit}  (월누적 ${monthSaved})`);
    }

    // 호출 템포 조절
    await sleep(120);
  }

  console.log(`✅ DONE ${yyyymm}: 저장 ${monthSaved}건`);
  db.close();
}

// =========================
// 8) 전체 월 범위 유틸 (202207 ~ 현재월)
// =========================
function yyyymmNowKST(): string {
  // 로컬이 KST라 가정 (사용자 환경)
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}${mm}`;
}

function nextMonth(yyyymm: string): string {
  const y = Number(yyyymm.slice(0, 4));
  const m = Number(yyyymm.slice(4, 6));
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + 1);
  const ny = d.getFullYear();
  const nm = String(d.getMonth() + 1).padStart(2, "0");
  return `${ny}${nm}`;
}

// =========================
// CLI
// =========================
async function main() {
  const arg = process.argv[2];

  if (arg) {
    if (!/^\d{6}$/.test(arg)) {
      console.error("사용법: npx tsx scripts/ingest-g2b.ts 202401");
      process.exit(1);
    }
    await ingestMonth(arg);
    return;
  }

  const start = "202207";
  const end = yyyymmNowKST();

  console.log(`🚀 전체 수집 범위: ${start} ~ ${end}`);

  let cur = start;
  while (cur <= end) {
    try {
      await ingestMonth(cur);
    } catch (e: any) {
      console.error(`❌ ${cur} 수집 실패`, e?.message || e);
      // 실패해도 다음 달 진행
    }
    cur = nextMonth(cur);
  }

  console.log("🎯 전체 수집 완료");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

