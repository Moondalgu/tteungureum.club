import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MeetingDetail } from "@/components/MeetingDetail";
import type { Meeting, MeetingDate } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meetingId = Number(id);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: meeting } = await supabase
    .from("meetings")
    .select(
      "id, title, description, mode, vote_deadline, status, confirmed_date, room_id, created_at"
    )
    .eq("id", meetingId)
    .single();

  if (!meeting) notFound();

  const { data: dates } = await supabase
    .from("meeting_dates")
    .select("id, meeting_id, d")
    .eq("meeting_id", meetingId)
    .order("d", { ascending: true });

  const { data: votes } = await supabase
    .from("meeting_votes")
    .select("meeting_date_id, user_id")
    .eq("meeting_id", meetingId);

  const counts: Record<number, number> = {};
  const myVotes: number[] = [];
  for (const v of votes ?? []) {
    counts[v.meeting_date_id] = (counts[v.meeting_date_id] ?? 0) + 1;
    if (user && v.user_id === user.id) myVotes.push(v.meeting_date_id);
  }

  // 확정된 모임이면 방 디스코드 링크도 가져오기
  let discordUrl: string | null = null;
  if (meeting.room_id) {
    const { data: room } = await supabase
      .from("rooms")
      .select("discord_url")
      .eq("id", meeting.room_id)
      .single();
    discordUrl = room?.discord_url ?? null;
  }

  return (
    <main className="container">
      <MeetingDetail
        meeting={meeting as Meeting}
        dates={(dates ?? []) as MeetingDate[]}
        initialCounts={counts}
        initialMyVotes={myVotes}
        userId={user?.id ?? null}
        roomId={meeting.room_id}
        discordUrl={discordUrl}
      />
    </main>
  );
}
