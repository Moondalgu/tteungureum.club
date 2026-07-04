import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { RoomShell } from "@/components/RoomShell";
import { ShareButton } from "@/components/ShareButton";
import type { RoomMessage, RoomTopic, Stroke, Topic } from "@/lib/types";

export const dynamic = "force-dynamic";

// 카톡 공유 시 방 제목이 보이도록 동적 OG.
// 주의: openGraph 는 상위(layout)와 얕은 병합이라 images 를 다시 명시해야 한다.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const roomId = Number(id);
  if (!Number.isFinite(roomId)) return {};
  const supabase = await createClient();
  const { data: room } = await supabase
    .from("rooms")
    .select("title, date")
    .eq("id", roomId)
    .single();
  if (!room) return {};
  const description = `☁ ${room.date} 토론방이 열렸어요. 들어와서 같이 떠들어요!`;
  return {
    title: room.title,
    description,
    openGraph: {
      title: `${room.title} — 뜬구름클럽`,
      description,
      images: [{ url: "/og-v2.png", width: 1200, height: 630, alt: "뜬구름클럽" }],
    },
  };
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const roomId = Number(id);
  if (!Number.isFinite(roomId)) notFound();

  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, title, date, mode")
    .eq("id", roomId)
    .single();
  if (!room) notFound();

  // 방에 담긴 주제 (순서대로)
  const { data: roomTopics } = await supabase
    .from("room_topics")
    .select("id, room_id, topic_id, content, author, position, done")
    .eq("room_id", roomId)
    .order("position", { ascending: true });

  // N의 상자 후보 (진행완료 아닌 것)
  const { data: box } = await supabase
    .from("topics")
    .select("id, author, content, source_date, status, created_at")
    .neq("status", "done")
    .order("created_at", { ascending: false });

  // 기존 화이트보드 획
  const { data: strokes } = await supabase
    .from("strokes")
    .select("id, room_id, payload, created_at")
    .eq("room_id", roomId)
    .order("id", { ascending: true });

  // 채팅 기록 (영구 저장)
  const { data: messages } = await supabase
    .from("room_messages")
    .select("id, room_id, user_id, name, content, created_at")
    .eq("room_id", roomId)
    .order("id", { ascending: true });

  // 로그인 사용자 닉네임 (채팅 표시용)
  let nickname: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("id", user.id)
      .single();
    nickname = profile?.nickname ?? null;
  }

  return (
    <main className="room-page">
      <div className="rhead">
        <h1>{room.title}</h1>
        <span className="badge">📅 {room.date}</span>
        <span className="badge">{room.mode === "online" ? "💻 온라인" : "📍 오프라인"}</span>
        <ShareButton style={{ marginLeft: "auto" }} />
      </div>

      <RoomShell
        roomId={roomId}
        initialTopics={(roomTopics ?? []) as RoomTopic[]}
        boxTopics={(box ?? []) as Topic[]}
        strokes={(strokes ?? []) as Stroke[]}
        isLoggedIn={!!user}
        userId={user?.id ?? null}
        nickname={nickname}
        initialMessages={(messages ?? []) as RoomMessage[]}
      />
    </main>
  );
}
