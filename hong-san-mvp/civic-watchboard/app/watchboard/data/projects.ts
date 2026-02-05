// app/watchboard/data/projects.ts

export type EvidenceType = "PRESS" | "BUDGET" | "BID" | "PROGRESS" | "DONE";

export const EvidenceTypeLabel: Record<EvidenceType, string> = {
  PRESS: "보도/발표(참고)",
  BUDGET: "예산/의회",
  BID: "입찰/계약",
  PROGRESS: "착공/공정",
  DONE: "준공/개통",
};

// ✅ 신뢰 점수(권장) - 보도자료는 낮게
export const EvidenceWeight: Record<EvidenceType, number> = {
  PRESS: 10,
  BUDGET: 30,
  BID: 30,
  PROGRESS: 20,
  DONE: 10,
};

export type Evidence = {
  type: EvidenceType;
  title: string;
  date: string; // YYYY-MM or YYYY-MM-DD
  url: string;
  note?: string; // 사람이 쓰는 짧은 설명(핵심)
};

export type Project = {
  id: string;
  title: string;
  summary: string;
  area: string;
  category: string;
  tags?: string[];

  analystNote?: string; // 사람이 쓰는 1줄 판단
  evidences: Evidence[];
};

export function getScore(project: Project) {
  // 같은 타입 근거는 1개만 점수로 인정(중복 방지)
  const types = new Set(project.evidences.map((e) => e.type));
  let score = 0;
  for (const t of types) score += EvidenceWeight[t];
  const percent = Math.min(100, Math.max(0, score));
  return { score, percent, types };
}

export function getNextCheck(types: Set<EvidenceType>) {
  if (!types.has("BUDGET")) return "예산서/추경/의회 의결에서 관련 항목 확인";
  if (!types.has("BID")) return "나라장터·시 입찰/계약 공고에서 용역/공사 발주 확인";
  if (!types.has("PROGRESS")) return "착공 공지/공정 보고/현장 사진 등 진행 증거 확보";
  if (!types.has("DONE")) return "준공/개통 공지 또는 완료 보고서 확인";
  return "완료 후 성과(유지관리/민원) 모니터링";
}

/**
 * ✅ BUDGET 근거 링크 규칙
 * public/docs/budget-2026.pdf 를 넣어두었다는 전제
 * 브라우저에서: /docs/budget-2026.pdf#page=8 형태로 바로 열림
 *
 * (확인된 근거)
 * - 예산 총괄/회계별 규모: p7
 * - 전년도 대비 증감 비교표: p8  ← '증액 확인' 핵심 페이지
 */
const BUDGET_2026_P7 = "/docs/budget-2026.pdf#page=7";
const BUDGET_2026_P8 = "/docs/budget-2026.pdf#page=8";

export const PROJECTS: Project[] = [
  {
    id: "goyang-daegok-transfer",
    title: "대곡역 환승체계 개선",
    summary: "GTX-A·서해선·경의중앙선 연계 환승 동선/접근성 개선",
    area: "고양시",
    category: "교통",
    tags: ["대곡역", "환승", "GTX-A"],
    analystNote:
      "보도자료는 ‘참고’로만 취급. 현재는 ‘교통/철도 예산 증액’까지만 예산서로 확인됨. ‘대곡역 환승체계 개선’이 세부사업으로 실제 편성됐는지는 세부 세출(부서·세부사업) 페이지 추가 확인이 필요.",
    evidences: [
      {
        type: "PRESS",
        title: "고양에서 서울역·의정부까지 한번에…수도권 철도망 촘촘해진다",
        date: "2024-11",
        url: "https://www.goyang.go.kr/news/user/bbs/BD_selectBbs.do?q_bbsCode=1090&q_bbscttSn=20241112155609449&q_estnColumn1=All",
        note:
          "확인된 사실: 공식 발표/홍보 문서.\n추가 확인 필요: 예산/입찰/착공 근거가 확보되기 전까지 실행 확정으로 단정하지 않음.",
      },
      {
        type: "BUDGET",
        title: "2026년도 본예산(회계별 규모): 도시교통사업·철도사업 특별회계 존재 확인",
        date: "2025-12",
        url: BUDGET_2026_P7,
        note:
          "확인된 사실: 2026년 본예산에서 ‘도시교통사업 특별회계’, ‘철도사업 특별회계’가 항목으로 존재(총괄).\n추가 확인 필요: ‘대곡역 환승체계 개선’ 세부사업 명칭/코드로 직접 연결되는지(세부 세출에서 확인).",
      },
      {
        type: "BUDGET",
        title: "2026년도 본예산(전년 대비 증감): 도시교통 +21.1%, 철도 +55.7% 증액 확인",
        date: "2025-12",
        url: BUDGET_2026_P8,
        note:
          "확인된 사실: 전년도 대비 ‘도시교통사업 특별회계’와 ‘철도사업 특별회계’가 각각 증액(증감표).\n추가 확인 필요: 증액분이 ‘대곡역 환승체계 개선’에 직접 배정됐는지 세부사업(부서/세부사업/예산액) 페이지로 교차검증 필요.",
      },
      {
        type: "BID",
        title: "나라장터 키워드 검색(대곡역환승 등) 결과 0건",
        date: "2026-02-01",
        url: "https://www.g2b.go.kr/",
        note:
          "확인된 사실: ‘대곡역환승’ 등 단일 키워드 검색에서는 공고/계약을 아직 확인하지 못함.\n추가 확인 필요: 실제 발주는 다른 명칭(환승동선/연계교통/GTX 연계/대곡역 일원 등)으로 올라갈 수 있으므로 키워드 확장 + 수요기관/공고기관(고양시) 필터로 재검색 필요.",
      },
    ],
  },

  {
    id: "goyang-urban-regeneration",
    title: "노후 주거지 도시재생",
    summary: "노후 주거지 주거환경 개선 및 생활 SOC 확충",
    area: "고양시",
    category: "도시/주거",
    tags: ["도시재생", "주거환경", "생활SOC"],
    analystNote:
      "현재는 ‘예산 총괄에서 교통/철도 증액’만 예시로 연결한 상태. 도시재생은 ‘대상지 확정 공고’ + ‘예산(세부사업)’ + ‘입찰(용역/공사)’ 3종을 먼저 확보해야 신뢰도 있게 진행 판단 가능.",
    evidences: [
      {
        type: "PRESS",
        title: "도시재생 관련 보도/자료(사례 소개)",
        date: "2021-10",
        url: "https://www.goyang.go.kr/news/user/bbs/BD_selectBbs.do?q_bbsCode=1090&q_bbscttSn=20211012135208196&q_estnColumn1=Y",
        note:
          "확인된 사실: 사례 소개/홍보 성격.\n추가 확인 필요: 대상지 확정 공고 + 예산(세부사업) + 입찰(용역/공사) 근거 확보 필요.",
      },
    ],
  },

  {
    id: "goyang-school-route-safety",
    title: "학교 주변 통학로 안전 개선",
    summary: "어린이보호구역·통학로 보행안전 시설 정비 및 환경 개선",
    area: "고양시",
    category: "교육/안전",
    tags: ["통학로", "어린이보호구역", "스쿨존"],
    analystNote:
      "정책 안내만으로 진행률을 올리지 않음. ‘예산서에서 스쿨존/통학로 시설개선 세부사업’이 확인되면 BUDGET을 추가하고, 이어서 입찰/공사 근거를 붙여 신뢰도를 올리는 방식으로 운영.",
    evidences: [
      {
        type: "PRESS",
        title: "통학로 환경개선 사업 안내(시 홈페이지)",
        date: "상시",
        url: "https://www.goyang.go.kr/www/www03/www03_9/www03_9_1/www03_9_1_tab1.jsp",
        note:
          "확인된 사실: 정책/사업 안내 페이지.\n추가 확인 필요: 예산서 세부사업(부서/세부사업/금액) + 입찰/공사 근거 확보 필요.",
      },
    ],
  },
];