"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// 로그인/로그아웃/프로필 변경 등 인증 상태가 바뀌면 서버 컴포넌트(레이아웃)를
// 즉시 다시 그려 UI(상단바 등)에 반영한다. Supabase 권장 Next.js 패턴.
export function AuthListener() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED"
      ) {
        router.refresh();
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
