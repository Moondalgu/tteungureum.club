import { NextResponse } from "next/server";
import { createAdminClient, getCurrentUser } from "@/lib/supabase/server";

// 회원 탈퇴. 로그인한 본인 계정만 삭제 가능.
// auth.users 삭제 → profiles 가 cascade 삭제된다.
// 그 외 작성물(topics/messages 등)의 user_id 는 set null 로 남는다.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
