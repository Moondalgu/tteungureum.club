import Link from "next/link";

// 커스텀 404 — Next 기본 영문 페이지 대신 픽셀 톤앤매너 유지
export default function NotFound() {
  return (
    <main className="container">
      <div className="narrow" style={{ textAlign: "center", paddingTop: 40 }}>
        <h1 style={{ marginBottom: 8 }}>구름 속에서 길을 잃었어요</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          찾으시는 페이지가 없거나, 삭제된 모임이에요.
        </p>
        <Link href="/" className="btn primary" style={{ marginTop: 16 }}>
          홈으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
