"use client";

import { createClient } from "@/lib/supabase/client";
import { Overlay } from "./Overlay";

// 로그인 유도 모달. 비로그인 사용자가 로그인이 필요한 액션을 시도하면 표시한다.
// 즉시 로그인 페이지로 튕기는 대신, 의도를 보여준 뒤 로그인을 유도해 전환을 높인다.
// 로그인 성공 후 next 경로로 돌아와 원래 하려던 동작을 이어갈 수 있다.
export function LoginPromptModal({
  open,
  title = "로그인이 필요해요",
  message,
  next = "/",
  onClose,
}: {
  open: boolean;
  title?: string;
  message?: string;
  next?: string;
  onClose: () => void;
}) {
  if (!open) return null;

  async function loginWithKakao() {
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo },
    });
  }

  return (
    <Overlay onClose={onClose}>
      <div
        className="card dialog"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0 }}>{title}</h3>
        {message && (
          <p className="muted small" style={{ margin: 0 }}>
            {message}
          </p>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn" onClick={onClose}>
            닫기
          </button>
          <button className="btn kakao" onClick={loginWithKakao}>
            카카오 로그인
          </button>
        </div>
      </div>
    </Overlay>
  );
}
