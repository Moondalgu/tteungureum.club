"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LoginPromptModal } from "./LoginPromptModal";

export function TopBar({
  isLoggedIn,
  nickname,
  avatarUrl,
}: {
  isLoggedIn: boolean;
  nickname: string | null;
  avatarUrl: string | null;
}) {
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

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
      {/* 모바일(<768px)에선 홈/N의상자/프로필이 하단 탭바로 내려가고,
          상단바에는 핵심 CTA(방 만들기)와 로그인만 남긴다 */}
      <nav className="row">
        <Link href="/box" className="btn cyan desktop-only">
          N의 상자
        </Link>
        {isLoggedIn ? (
          <Link href="/?new=1" className="btn primary">
            방 만들기
          </Link>
        ) : (
          <button className="btn primary" onClick={() => setShowLoginPrompt(true)}>
            방 만들기
          </button>
        )}
        {isLoggedIn ? (
          <>
            <Link href="/profile" className="row desktop-only" style={{ gap: 8 }}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="avatar" src={avatarUrl} alt="프로필" loading="lazy" />
              ) : (
                <span className="avatar" />
              )}
              <span className="small">{nickname ?? "프로필 설정"}</span>
            </Link>
            <button className="btn desktop-only" onClick={logout}>
              로그아웃
            </button>
          </>
        ) : (
          <button className="btn kakao" onClick={loginWithKakao}>
            카카오 로그인
          </button>
        )}
      </nav>

      <LoginPromptModal
        open={showLoginPrompt}
        message="방을 만들려면 로그인이 필요해요. 로그인하면 바로 방 만들기로 이어집니다."
        next="/?new=1"
        onClose={() => setShowLoginPrompt(false)}
      />
    </header>
  );
}
