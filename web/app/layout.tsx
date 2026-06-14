import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TopBar } from "@/components/TopBar";
import { AuthListener } from "@/components/AuthListener";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let nickname: string | null = null;
  let avatarUrl: string | null = null;
  if (user) {
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
        {children}
      </body>
    </html>
  );
}
