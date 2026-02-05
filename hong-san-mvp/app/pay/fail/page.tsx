import Link from "next/link";

export default function PayFailPage() {
  return (
    <div className="container">
      <div className="card" style={{ marginTop: 16 }}>
        <h2>❌ 결제 실패</h2>
        <Link className="btn btnPrimary" href="/pay">다시 결제하기 →</Link>
      </div>
    </div>
  );
}