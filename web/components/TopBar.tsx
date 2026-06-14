"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function TopBar({
  isLoggedIn,
  nickname,
  avatarUrl,
}: {
  isLoggedIn: boolean;
  nickname: string | null;
  avatarUrl: string | null;
}) {
  async function loginWithKakao() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  // signOut() 이후 AuthListener 의 onAuthStateChange(SIGNED_OUT) 가
  // router.refresh() 를 호출해 상단바가 즉시 갱신된다.
  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  return (
    <header className="topbar">
      <Link href="/" className="brand">
        뜬구름클럽
      </Link>
      <nav className="row">
        <Link href="/box" className="btn cyan">
          N의 상자
        </Link>
        <Link href="/?new=1" className="btn primary">
          방 만들기
        </Link>
        {isLoggedIn ? (
          <>
            <Link href="/profile" className="row" style={{ gap: 8 }}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="avatar" src={avatarUrl} alt="프로필" />
              ) : (
                <span className="avatar" />
              )}
              <span className="small">{nickname ?? "프로필 설정"}</span>
            </Link>
            <button className="btn" onClick={logout}>
              로그아웃
            </button>
          </>
        ) : (
          <button className="btn kakao" onClick={loginWithKakao}>
            카카오 로그인
          </button>
        )}
      </nav>
    </header>
  );
}
