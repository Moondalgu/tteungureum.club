"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LoginPromptModal } from "./LoginPromptModal";
import { BrandCloud, IconChevronLeft } from "./icons";

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
  const pathname = usePathname();
  const router = useRouter();

  // 상세 화면(모임/토론방)에선 모바일 헤더가 "뒤로가기 + 섹션명"으로 바뀐다.
  // 홈·탭 루트는 브랜드 유지 — "홈 = 로고, 상세 = 컨텍스트" 하이브리드(iOS HIG/국내앱 관행).
  const isDetail = /^\/(meetings|rooms)\/[^/]+/.test(pathname);
  const sectionTitle = pathname.startsWith("/rooms/") ? "토론방" : "모임";

  // 공유 링크로 직진입해 히스토리가 없으면 홈으로 폴백
  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

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
      {isDetail && (
        <div className="row mobile-only" style={{ gap: 8, minWidth: 0 }}>
          <button className="backbtn" aria-label="뒤로가기" onClick={goBack}>
            <IconChevronLeft />
          </button>
          <strong className="htitle">{sectionTitle}</strong>
        </div>
      )}
      <Link href="/" className={`brand ${isDetail ? "desktop-only" : ""}`}>
        <BrandCloud />
        뜬구름클럽
      </Link>
      {/* 모바일(<768px)에선 내비가 하단 탭바로, 방 만들기는 홈 FAB 로 내려간다.
          상단바 모바일 잔여물은 로그인 버튼뿐 */}
      <nav className="row">
        <Link href="/box" className="btn cyan desktop-only">
          N의 상자
        </Link>
        {isLoggedIn ? (
          <Link href="/?new=1" className="btn primary desktop-only">
            모임 만들기
          </Link>
        ) : (
          <button
            className="btn primary desktop-only"
            onClick={() => setShowLoginPrompt(true)}
          >
            모임 만들기
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
        message="모임을 만들려면 로그인이 필요해요. 로그인하면 바로 모임 만들기로 이어집니다."
        next="/?new=1"
        onClose={() => setShowLoginPrompt(false)}
      />
    </header>
  );
}
