import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto flex max-w-5xl flex-col items-center px-6 py-16">

        {/* 상단 타이틀 */}
        <h1 className="text-3xl md:text-5xl font-bold text-center mb-4">
          홍산마늘 1농가 1가족 프로젝트
        </h1>
        <p className="text-zinc-600 text-center mb-10">
          한 가족이 한 농가를 응원하고, 진짜 농산물을 직접 연결합니다.
        </p>

        {/* 대표 이미지 */}
        <div className="mb-10">
          <Image
            src="/kelpak.png"   // public 폴더에 kelpak.png 넣어두면 됨
            alt="홍산마늘 프로젝트"
            width={300}
            height={500}
            className="object-contain"
          />
        </div>

        {/* 핵심 설명 */}
        <div className="grid md:grid-cols-3 gap-6 w-full mb-12">
          <div className="bg-white rounded-xl p-6 shadow">
            <h2 className="font-semibold text-lg mb-2">참여하기</h2>
            <p className="text-sm text-zinc-600">
              내가 응원할 농가를 선택하고 가족 명패를 등록합니다.
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow">
            <h2 className="font-semibold text-lg mb-2">직접 연결</h2>
            <p className="text-sm text-zinc-600">
              중간 유통 없이 농가의 마늘을 바로 받아봅니다.
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow">
            <h2 className="font-semibold text-lg mb-2">지속 응원</h2>
            <p className="text-sm text-zinc-600">
              흑마늘·가공품까지 함께 구매하며 농가를 지켜줍니다.
            </p>
          </div>
        </div>

        {/* 버튼 영역 */}
        <div className="flex flex-col md:flex-row gap-4">
          <Link
            href="/join"
            className="px-8 py-4 rounded-lg bg-black text-white text-center font-semibold hover:bg-zinc-800"
          >
            우리 가족 참여하기
          </Link>

          <Link
            href="/shop"
            className="px-8 py-4 rounded-lg border border-black text-black text-center font-semibold hover:bg-black hover:text-white"
          >
            홍산마늘 바로 구매
          </Link>
        </div>

      </main>
    </div>
  );
}