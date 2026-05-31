import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Whiteboard } from "@/components/Whiteboard";
import { RoomTopics } from "@/components/RoomTopics";
import { Countdown } from "@/components/Countdown";
import type { RoomTopic, Stroke, Topic } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const roomId = Number(id);
  if (!Number.isFinite(roomId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, title, date, mode, discord_url")
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

  return (
    <main className="container">
      <div className="row spread" style={{ marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>{room.title}</h1>
          <div className="muted small">
            📅 {room.date} · {room.mode === "online" ? "온라인" : "오프라인"}
          </div>
        </div>
        {room.discord_url && (
          <a className="btn cyan" href={room.discord_url} target="_blank" rel="noreferrer">
            디스코드 채널 열기
          </a>
        )}
      </div>

      <RoomTopics
        roomId={roomId}
        initialTopics={(roomTopics ?? []) as RoomTopic[]}
        boxTopics={(box ?? []) as Topic[]}
        isLoggedIn={!!user}
      />

      <section style={{ marginBottom: 20 }}>
        <Countdown roomId={roomId} />
      </section>

      <section>
        <h3>화이트보드 (실시간 공동편집)</h3>
        <Whiteboard
          roomId={roomId}
          initialStrokes={(strokes ?? []) as Stroke[]}
        />
      </section>
    </main>
  );
}
