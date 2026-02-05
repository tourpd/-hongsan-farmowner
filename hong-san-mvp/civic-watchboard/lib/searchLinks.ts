export function policyToQuery(policy: string) {
  return policy
    .replace(/^정책카드:\s*/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 나라장터(입찰공고 목록) 검색 링크 (열리면 좋고, 로그인 요구 시 참고용)
export function makeNaraLink(q: string) {
  const enc = encodeURIComponent(q);
  return `https://www.g2b.go.kr:8101/ep/tbid/tbidList.do?searchType=1&searchKeyword=${enc}`;
}

// data.go.kr "데이터셋 검색" 링크(공개데이터로 확인)
export function makeDataGoKrSearchLink(q: string) {
  const enc = encodeURIComponent(q);
  return `https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=${enc}`;
}
