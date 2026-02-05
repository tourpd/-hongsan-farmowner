import Link from "next/link";

export default function HomePage() {
  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <div className="title">홍산마늘 1농가 1가족</div>
          <div className="sub">농민을 돕고 · 농사에 참여하고 · 수확물을 받는 프로그램</div>
        </div>
        <div className="nav">
          <Link href="/">홈</Link>
          <Link href="/pay">참여 신청</Link>
          <Link href="/admin/pledges">관리자</Link>
        </div>
      </div>

      <div style={{ marginTop: 14 }} className="grid">
        {/* 좌측 메인 */}
        <div className="card">
          <div className="badge">📌 지금 필요한 건 “수확 전 농사비”입니다</div>
          <div style={{ marginTop: 10 }}>
            <div className="h1">농민은 지금 농비가 필요합니다</div>
            <p className="p">
              홍산마늘은 이미 심겨져 있습니다. 하지만 <b>2월 말부터</b> 부직포 제거·추비·농약방제·영양제·인건비가 연속으로 들어가고,
              수익은 <b>6월 중순 수확</b>까지 없습니다.
              <br />
              <b>하루 인건비 1인당 15만원도</b> 현금으로 바로 지급해야 하는 현실 때문에, 많은 농가가 “돈이 묶인 상태”로 버티고 있습니다.
            </p>
          </div>

          <div className="sep" />

          <div style={{ display: "grid", gap: 10 }}>
            <div className="notice">
              <b>이 프로젝트는 “기부”가 아닙니다.</b>
              <br />
              참여자는 농사 과정에 참여하고, 수확물을 <b>아래와 같은 방식으로 </b>받습니다.
              <br />
              농민과 참여자 사이의 관계는 <b>한국농수산TV가 중간에서 연결</b>합니다.
            </div>

            <div className="warn">
              <b>쇼핑몰처럼 ‘오늘 결제 → 내일 배송’ 구조가 아닙니다.</b>
              <br />
              농사 일정(자연/생육)에 따라 진행되며, 수확/체험/가공 신청은 시즌 흐름에 맞춰 안내됩니다.
            </div>
          </div>

          <div className="sep" />

          <div style={{ fontWeight: 900, marginBottom: 10 }}>농사 참여자는 아래와 같은 혜택이 있습니다</div>

          <div style={{ display: "grid", gap: 10 }}>
            <div className="card" style={{ boxShadow: "none" }}>
              <div style={{ fontWeight: 900 }}>🌿 현장 참여</div>
              <div className="p" style={{ marginTop: 6 }}>
                5월 마늘쫑 수확 / 6월 중순 내 밭 마늘 직접 수확(직접 뽑아서 가져가기) 등
              </div>
            </div>

            <div className="card" style={{ boxShadow: "none" }}>
              <div style={{ fontWeight: 900 }}>🧄 홍산마늘 수확시 수령</div>
              <div className="p" style={{ marginTop: 6 }}>
                수확 후 홍산마늘을 생마늘로 받기 또는 현장 수령/택배(추후 안내)
              </div>
            </div>

            <div className="card" style={{ boxShadow: "none" }}>
              <div style={{ fontWeight: 900 }}>🍞 홍산마늘 가공품 신청</div>
              <div className="p" style={{ marginTop: 6 }}>
                종자마늘 / 깐마늘 / 다진마늘 등 가공품은 <b>수확 시점에 미리 신청</b> 받아 재고 없이 운영합니다.
              </div>
            </div>

            <div className="card" style={{ boxShadow: "none" }}>
              <div style={{ fontWeight: 900 }}>🌱 종자·체험</div>
              <div className="p" style={{ marginTop: 6 }}>
                주아(홍산마늘씨) / 종자용 준비 등 “집에서 심어보기” (추후 안내)
              </div>
            </div>
          </div>

          <div className="sep" />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn btnPrimary" href="/pay">
              참여 신청하러 가기 →
            </Link>
            <Link className="btn btnGhost" href="/admin/pledges">
              (관리자) 접수 목록 →
            </Link>
          </div>
        </div>

        {/* 우측 요약/CTA */}
        <div className="card">
          <div style={{ fontWeight: 950, fontSize: 18 }}>지금 참여하시면</div>
          <div className="sep" />

          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900 }}>✅ 농민이 힘들 때 많은 도움이 됩니다</div>
              <div className="p" style={{ marginTop: 6 }}>
                추비/농약/영양제/인건비 등 “지금 당장 필요한 비용”을 감당하게 됩니다.
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 900 }}>✅ 참여자는 농사에 참여합니다</div>
              <div className="p" style={{ marginTop: 6 }}>
                마늘쫑·수확 참여, 농장 방문, 농사 경험 습득으로 “참여자가 농사를 체험한다”는 감각과 연대감이 생깁니다.
              </div>
            </div>

            <div>
            </div>
          </div>

          <div className="sep" />

          <Link className="btn btnDark" href="/pay">
            지금 참여 신청 저장 →
          </Link>

          <div style={{ marginTop: 12 }} className="p">
            ※ 결제 위젯 심사/키 세팅이 완료되면 신청 저장 후 결제까지 한 번에 붙입니다.
          </div>
        </div>
      </div>
    </div>
  );
}