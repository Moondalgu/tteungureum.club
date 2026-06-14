import { NextResponse } from "next/server";
import { createAdminClient, getCurrentUser } from "@/lib/supabase/server";
import { deleteDiscordChannel } from "@/lib/discord";

// 모임/방 삭제. 로그인 사용자만 가능(소규모 신뢰 그룹).
// rooms 삭제 → room_topics / strokes / room_messages 가 cascade 삭제,
// meetings 삭제 → meeting_dates / meeting_votes 가 cascade 삭제.
// RLS 에 삭제 정책이 없으므로 service_role(admin) 로 처리한다.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const meetingId = Number(body?.meeting_id);
  if (!Number.isFinite(meetingId)) {
    return NextResponse.json({ error: "meeting_id 가 필요합니다." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: meeting } = await admin
    .from("meetings")
    .select("id, room_id")
    .eq("id", meetingId)
    .single();
  if (!meeting) {
    return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
  }

  // 방이 있으면 디스코드 채널 정리 후 방 삭제(자식 cascade)
  if (meeting.room_id) {
    const { data: room } = await admin
      .from("rooms")
      .select("discord_channel_id")
      .eq("id", meeting.room_id)
      .single();
    if (room?.discord_channel_id) {
      try {
        await deleteDiscordChannel(room.discord_channel_id);
      } catch (e) {
        console.error("[delete discord]", e);
      }
    }
    await admin.from("rooms").delete().eq("id", meeting.room_id);
  }

  const { error } = await admin.from("meetings").delete().eq("id", meetingId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
