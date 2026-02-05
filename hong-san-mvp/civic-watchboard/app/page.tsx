import WatchBoard from "./watchboard/WatchBoard";

export const metadata = {
  title: "고양시 약속 현황판 (시범)",
  description: "약속은 문장보다 상태로 본다. 공식 근거로 확인하는 시민 감시 보드.",
};

export default function Page() {
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <WatchBoard />
    </main>
  );
}
