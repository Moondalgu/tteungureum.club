"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LoginPromptModal } from "./LoginPromptModal";

// 모바일 전용 하단 탭바 (<768px, CSS 로 표시 제어).
// 데스크톱 상단바와 항목이 동일하다 — IA 는 같고 배치만 다르게(썸존).
export function BottomNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // 모임/방 흐름은 홈 탭 소속으로 취급
  const homeActive =
    pathname === "/" ||
    pathname.startsWith("/meetings") ||
    pathname.startsWith("/rooms");
  const boxActive = pathname.startsWith("/box");
  const profileActive = pathname.startsWith("/profile");

  return (
    <nav className="tabbar" aria-label="주요 메뉴">
      <Link
        href="/"
        className={`tab ${homeActive ? "active" : ""}`}
        aria-current={homeActive ? "page" : undefined}
      >
        <span className="ticon" aria-hidden>
          ☁
        </span>
        홈
      </Link>
      <Link
        href="/box"
        className={`tab ${boxActive ? "active" : ""}`}
        aria-current={boxActive ? "page" : undefined}
      >
        <span className="ticon" aria-hidden>
          📦
        </span>
        N의 상자
      </Link>
      {isLoggedIn ? (
        <Link
          href="/profile"
          className={`tab ${profileActive ? "active" : ""}`}
          aria-current={profileActive ? "page" : undefined}
        >
          <span className="ticon" aria-hidden>
            👤
          </span>
          프로필
        </Link>
      ) : (
        <button className="tab" onClick={() => setShowLoginPrompt(true)}>
          <span className="ticon" aria-hidden>
            👤
          </span>
          프로필
        </button>
      )}

      <LoginPromptModal
        open={showLoginPrompt}
        message="프로필을 설정하려면 로그인이 필요해요."
        next="/profile"
        onClose={() => setShowLoginPrompt(false)}
      />
    </nav>
  );
}
