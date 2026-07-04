import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { MeetingDetail } from "@/components/MeetingDetail";
import type { Meeting, MeetingDate } from "@/lib/types";

export const dynamic = "force-dynamic";

// 카톡 공유 시 모임 제목이 보이도록 동적 OG.
// 주의: openGraph 는 상위(layout)와 얕은 병합이라 images 를 다시 명시해야 한다.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const meetingId = Number(id);
  if (!Number.isFinite(meetingId)) return {};
  const supabase = await createClient();
  const { data: meeting } = await supabase
    .from("meetings")
    .select("title, status, confirmed_date")
    .eq("id", meetingId)
    .single();
  if (!meeting) return {};
  const description =
    meeting.status === "confirmed"
      ? `🎉 ${meeting.confirmed_date ?? ""} 모임이 확정됐어요!`
      : "📅 가능한 날짜에 투표하고 모임에 함께해요!";
  return {
    title: meeting.title,
    description,
    openGraph: {
      title: `${meeting.title} — 뜬구름클럽`,
      description,
      images: [{ url: "/og-v3.png", width: 1200, height: 630, alt: "뜬구름클럽" }],
    },
  };
}

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meetingId = Number(id);
  const supabase = await createClient();
  const user = await getCurrentUser();

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

  return (
    <main className="container">
      <MeetingDetail
        meeting={meeting as Meeting}
        dates={(dates ?? []) as MeetingDate[]}
        initialCounts={counts}
        initialMyVotes={myVotes}
        userId={user?.id ?? null}
        roomId={meeting.room_id}
        isLoggedIn={!!user}
      />
    </main>
  );
}
