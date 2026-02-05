// app/watchboard/data/projects.ts (또는 현재 쓰는 파일 경로에 그대로 덮어쓰기)

export type EvidenceType = "PRESS" | "BUDGET" | "BID" | "PROGRESS" | "DONE";

// ✅ 근거의 성격: POS(증거가 있다), NEG(없음/미확인/부재 확인)
export type EvidencePolarity = "POS" | "NEG";

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
  note?: string; // 사람이 쓰는 짧은 설명

  // ✅ 핵심: "없음/미확인"도 근거로 남기되 점수/단계에는 반영하지 않음
  polarity?: EvidencePolarity; // default "POS"
};

export type Project = {
  id: string;
  title: string;
  summary: string;
  area: string;
  category: string;
  tags?: string[];

  // ✅ 사람이 쓰는 1줄 판단(없으면 "근거 부족"으로 보이게)
  analystNote?: string;

  evidences: Evidence[]; // 단계 대신 '근거들'을 모읍니다 (핵심!)
};

// ✅ POS 근거 타입만 모음 (NEG는 점수/단계 판단에서 제외)
export function getPositiveTypes(project: Project) {
  const types = new Set<EvidenceType>();
  for (const e of project.evidences) {
    const polarity = e.polarity ?? "POS";
    if (polarity === "POS") types.add(e.type);
  }
  return types;
}

export function getScore(project: Project) {
  // 같은 타입 POS 근거는 1개만 점수로 인정(중복 방지)
  const types = getPositiveTypes(project);
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

export const PROJECTS: Project[] = [
  {
    id: "goyang-daegok-transfer",
    title: "대곡역 환승체계 개선",
    summary: "GTX-A·서해선·경의중앙선 연계 환승 동선/접근성 개선",
    area: "고양시",
    category: "교통",
    tags: ["대곡역", "환승", "GTX-A"],

    // ✅ 신뢰도 높은 결론: “예산(분야) 증액은 확인, 그러나 사업 전용 예산/입찰은 미확인”
    analystNote:
      "발표(보도) 근거는 확인됨. 2026 본예산에서 교통·철도 분야 특별회계가 증액되어 ‘준비 단계’ 가능성은 커졌으나, ‘대곡역 환승체계 개선’ 명시 사업 예산(세부사업)과 설계/공사 발주(입찰) 문서는 아직 확인되지 않음.",

    evidences: [
      // 1) 발표(참고)
      {
        type: "PRESS",
        title: "고양에서 서울역·의정부까지 한번에…수도권 철도망 촘촘해진다",
        date: "2024-11",
        url: "https://www.goyang.go.kr/news/user/bbs/BD_selectBbs.do?q_bbsCode=1090&q_bbscttSn=20241112155609449&q_estnColumn1=All",
        note: "공식 발표/홍보 성격. 실행 증거(예산·입찰)는 별도 확인 필요.",
      },

      // 2) 예산(분야) 근거: “교통/철도 특별회계 증액” (POS로 인정 가능)
      //    단, '대곡역 환승체계 개선' 세부사업이 문서 내에 명시됐는지까지는 추가 확인 필요
      {
        type: "BUDGET",
        title: "2026년 본예산서: 도시교통사업·철도사업 특별회계 증액",
        date: "2025-12",
        url: "https://www.goyang.go.kr/www/user/bbs/BD_selectBbs.do?q_bbsCode=1045", // TODO: ‘2026년 본예산서 게시’ 상세글 URL로 교체 권장
        note: "교통·철도 분야 재정 투입 확대(분야 예산 증가)는 확인. 다만 ‘대곡역 환승체계 개선’ 세부사업 항목(부서/세부사업/예산액) 확인은 추가 필요.",
      },

      // 3) 입찰/계약: ‘없음’도 근거로 남김 (NEG → 점수/단계에는 반영하지 않음)
      {
        type: "BID",
        polarity: "NEG",
        title: "나라장터: 대곡역 환승 관련 입찰/계약 공고(키워드) 검색 결과 0건",
        date: "2026-02-01",
        url: "https://www.g2b.go.kr",
        note: "키워드(대곡역환승 등)로 검색했으나 공고/계약을 확인하지 못함. 실제 발주는 다른 명칭으로 올라갈 수 있어(예: ‘환승동선’, ‘연계교통’, ‘GTX 연계’) 추가 키워드/기관(고양시) 필터로 재확인 필요.",
      },

      // ✅ 앞으로 실제로 입찰 공고를 찾으면 아래처럼 POS BID로 추가하면 됨
      // {
      //   type: "BID",
      //   title: "대곡역 환승체계 개선 기본/실시설계 용역 입찰 공고",
      //   date: "YYYY-MM-DD",
      //   url: "나라장터 공고 상세 링크",
      //   note: "발주기관/사업명/사업번호/금액 확인",
      // },
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
      "현재는 사례/성과 소개 수준의 공식 게시물만 있음. ‘대상지 확정 공고’(구역/사업명)와 ‘예산 반영(세부사업)’ 원문이 확보되어야 실행 단계 판단 가능.",
    evidences: [
      {
        type: "PRESS",
        title: "도시재생 관련 보도/자료(사례 소개)",
        date: "2021-10",
        url: "https://www.goyang.go.kr/news/user/bbs/BD_selectBbs.do?q_bbsCode=1090&q_bbscttSn=20211012135208196&q_estnColumn1=Y",
        note: "사례 소개/홍보 성격. 대상지·예산·입찰 원문 필요.",
      },
      // 예산서에서 ‘도시재생(특정 구역명)’ 세부사업을 찾으면 BUDGET(POS) 추가
      // 나라장터에 ‘도시재생 OO구역 기본계획/실시설계’ 뜨면 BID(POS) 추가
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
      "현재는 사업 안내 페이지 수준. ‘예산서(세부사업)’와 ‘대상 학교/구간’ 및 ‘공사 발주(입찰)’ 근거 확보가 핵심.",
    evidences: [
      {
        type: "PRESS",
        title: "통학로 환경개선 사업 안내(시 홈페이지)",
        date: "상시",
        url: "https://www.goyang.go.kr/www/www03/www03_9/www03_9_1/www03_9_1_tab1.jsp",
        note: "정책 안내(참고). 예산/입찰 원문 확인 필요.",
      },
      // 예산서에서 ‘어린이보호구역 개선/통학로 개선’ 세부사업 찾으면 BUDGET(POS) 추가
      // 나라장터에 ‘스쿨존 개선 공사’ 등 발주 뜨면 BID(POS) 추가
    ],
  },
];