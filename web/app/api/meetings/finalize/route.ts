import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// 모임 날짜투표 자동 확정:
// 마감일시가 지났는데 아직 status=voting 이면 →
//   ① 표 집계 → 최다 득표일(동률이면 가장 이른 날) 확정
//   ② rooms 생성(이미 방이 있으면 날짜/제목만 갱신 — 재투표 케이스)
//   ③ meetings 갱신
// 접속 시점에 클라이언트가 호출(서버리스 친화, 별도 크론 불필요).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const meetingId = Number(body?.meeting_id);
  if (!Number.isFinite(meetingId)) {
    return NextResponse.json({ error: "meeting_id 가 필요합니다." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: meeting, error: mErr } = await admin
    .from("meetings")
    .select("id, title, mode, vote_deadline, status, room_id")
    .eq("id", meetingId)
    .single();
  if (mErr || !meeting) {
    return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
  }

  // 이미 확정됐으면 그대로 반환
  if (meeting.status === "confirmed") {
    return NextResponse.json({ status: "confirmed", room_id: meeting.room_id });
  }

  // 아직 마감 전이면 아무것도 안 함
  if (new Date(meeting.vote_deadline).getTime() > Date.now()) {
    return NextResponse.json({ status: "voting" });
  }

  // ── 표 집계 ──
  const { data: dates } = await admin
    .from("meeting_dates")
    .select("id, d")
    .eq("meeting_id", meetingId)
    .order("d", { ascending: true });

  if (!dates || dates.length === 0) {
    return NextResponse.json({ error: "후보 날짜가 없습니다." }, { status: 400 });
  }

  const { data: votes } = await admin
    .from("meeting_votes")
    .select("meeting_date_id")
    .eq("meeting_id", meetingId);

  const tally = new Map<number, number>();
  for (const v of votes ?? []) {
    tally.set(v.meeting_date_id, (tally.get(v.meeting_date_id) ?? 0) + 1);
  }

  // dates 는 날짜 오름차순 → 첫 최다 득표가 곧 동률 시 가장 이른 날
  let winner = dates[0];
  let best = tally.get(dates[0].id) ?? 0;
  for (const d of dates) {
    const c = tally.get(d.id) ?? 0;
    if (c > best) {
      best = c;
      winner = d;
    }
  }

  const confirmedDate = winner.d as string;

  // ── 방 생성 또는 갱신 ──
  // 이미 방이 있으면(재투표 케이스) 날짜/제목/형태만 갱신하고 방을 유지한다.
  let roomId = meeting.room_id as number | null;
  if (roomId) {
    await admin
      .from("rooms")
      .update({ title: meeting.title, date: confirmedDate, mode: meeting.mode })
      .eq("id", roomId);
  } else {
    const { data: room, error: rErr } = await admin
      .from("rooms")
      .insert({
        title: meeting.title,
        date: confirmedDate,
        mode: meeting.mode,
        meeting_id: meetingId,
      })
      .select("id")
      .single();
    if (rErr || !room) {
      return NextResponse.json(
        { error: rErr?.message ?? "방 생성 실패" },
        { status: 500 }
      );
    }
    roomId = room.id;
  }

  // ── 모임 확정 갱신 ──
  await admin
    .from("meetings")
    .update({ status: "confirmed", confirmed_date: confirmedDate, room_id: roomId })
    .eq("id", meetingId);

  return NextResponse.json({
    status: "confirmed",
    room_id: roomId,
    confirmed_date: confirmedDate,
  });
}
