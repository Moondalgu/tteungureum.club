import { NextResponse } from "next/server";
import { createAdminClient, getCurrentUser } from "@/lib/supabase/server";

// 모임 수정. 로그인 사용자만 가능(소규모 신뢰 그룹).
// - 제목/설명/형태/마감 갱신
// - 후보 날짜 reconcile(있던 건 갱신, 삭제된 건 제거, 새 건 추가)
// - reopen=true 면 확정 해제하고 다시 투표(status=voting, confirmed_date=null, 방은 유지)
// - 연결된 방이 있으면 제목/형태를 함께 갱신(날짜는 재확정 시 finalize 가 갱신)
// RLS 에 수정 정책이 없으므로 service_role(admin) 로 처리한다.
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

  const title = String(body?.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "제목을 입력하세요." }, { status: 400 });
  }

  const description = body?.description ? String(body.description).trim() : null;
  const mode = body?.mode === "online" ? "online" : "offline";
  const reopen = body?.reopen === true;

  const voteDeadline = body?.vote_deadline
    ? new Date(body.vote_deadline)
    : null;
  if (!voteDeadline || Number.isNaN(voteDeadline.getTime())) {
    return NextResponse.json({ error: "마감 일시가 올바르지 않습니다." }, { status: 400 });
  }

  // dates: [{ id?: number, d: "YYYY-MM-DD" }]
  const rawDates = Array.isArray(body?.dates) ? body.dates : [];
  const dates = rawDates
    .map((x: { id?: number; d?: string }) => ({
      id: Number.isFinite(Number(x?.id)) ? Number(x.id) : null,
      d: String(x?.d ?? "").trim(),
    }))
    .filter((x: { id: number | null; d: string }) => /^\d{4}-\d{2}-\d{2}$/.test(x.d));
  if (dates.length === 0) {
    return NextResponse.json({ error: "날짜를 1개 이상 정하세요." }, { status: 400 });
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

  // ── 모임 갱신 ──
  const update: Record<string, unknown> = {
    title,
    description,
    mode,
    vote_deadline: voteDeadline.toISOString(),
  };
  if (reopen) {
    update.status = "voting";
    update.confirmed_date = null;
  }
  const { error: mErr } = await admin
    .from("meetings")
    .update(update)
    .eq("id", meetingId);
  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  // ── 후보 날짜 reconcile ──
  const { data: existing } = await admin
    .from("meeting_dates")
    .select("id")
    .eq("meeting_id", meetingId);
  const existingIds = new Set((existing ?? []).map((r) => r.id as number));
  const keepIds = new Set(
    dates.filter((x: { id: number | null }) => x.id !== null).map((x: { id: number | null }) => x.id as number)
  );

  // 삭제된 날짜 제거(연결된 표는 cascade)
  const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
  if (toDelete.length > 0) {
    await admin.from("meeting_dates").delete().in("id", toDelete);
  }
  // 기존 날짜 값 갱신
  for (const x of dates) {
    if (x.id !== null && existingIds.has(x.id)) {
      await admin.from("meeting_dates").update({ d: x.d }).eq("id", x.id);
    }
  }
  // 새 날짜 추가
  const newRows = dates
    .filter((x: { id: number | null }) => x.id === null)
    .map((x: { d: string }) => ({ meeting_id: meetingId, d: x.d }));
  if (newRows.length > 0) {
    await admin.from("meeting_dates").insert(newRows);
  }

  // ── 연결된 방 제목/형태 동기화 ──
  if (meeting.room_id) {
    await admin.from("rooms").update({ title, mode }).eq("id", meeting.room_id);
  }

  return NextResponse.json({ ok: true });
}
