import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TopBar } from "@/components/TopBar";
import { AuthListener } from "@/components/AuthListener";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "뜬구름클럽",
  description: "주제를 정해 자유롭게 토론하는 모임",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  let nickname: string | null = null;
  let avatarUrl: string | null = null;
  if (user) {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("nickname, avatar_url")
      .eq("id", user.id)
      .single();
    nickname = profile?.nickname ?? null;
    avatarUrl = profile?.avatar_url ?? null;
  }

  return (
    <html lang="ko">
      <body>
        <AuthListener />
        <TopBar
          isLoggedIn={!!user}
          nickname={nickname}
          avatarUrl={avatarUrl}
        />
        {/* 상단바는 body 의 일반 흐름에 두고, 스크롤은 이 내부 컨테이너에서만
            일어나게 한다. 그래야 iOS 고무줄(overscroll) 바운스가 상단바를
            끌어내리지 못한다. */}
        <div className="app-scroll">{children}</div>
      </body>
    </html>
  );
}
