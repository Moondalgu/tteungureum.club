import { redirect } from "next/navigation";

// /rooms 목록 페이지는 홈과 역할이 중복되어 폐기 (2026-07 점검 결정).
// 개별 토론방(/rooms/[id])은 그대로 유지된다.
export default function RoomsPage() {
  redirect("/");
}
