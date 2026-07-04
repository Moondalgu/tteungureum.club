import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { AuthListener } from "@/components/AuthListener";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://tteungureum-club.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "뜬구름클럽 ☁",
    template: "%s — 뜬구름클럽",
  },
  description:
    "뜬구름 잡는 주제로 모이는 N들의 토론 클럽. 주제 뽑고, 날짜 투표하고, 음성으로 떠들어요.",
  openGraph: {
    type: "website",
    siteName: "뜬구름클럽",
    title: "뜬구름클럽 ☁",
    description:
      "뜬구름 잡는 주제로 모이는 N들의 토론 클럽. 주제 뽑고, 날짜 투표하고, 음성으로 떠들어요.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "뜬구름클럽" }],
  },
  twitter: {
    card: "summary_large_image",
  },
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
        {/* 모바일 하단 탭바 — 플렉스 흐름 마지막 자식이라 스크롤 영역이 알아서 줄어든다 */}
        <BottomNav isLoggedIn={!!user} />
      </body>
    </html>
  );
}
