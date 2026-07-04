"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MeetingEditModal } from "./MeetingEditModal";
import { IconClock, IconMonitor, IconPin, IconStar } from "./icons";
import type { Meeting, MeetingDate } from "@/lib/types";

function weekday(d: string) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return days[new Date(d + "T00:00:00").getDay()];
}

export function MeetingDetail({
  meeting: initialMeeting,
  dates: initialDates,
  initialCounts,
  initialMyVotes,
  userId,
  roomId: initialRoomId,
  isLoggedIn,
}: {
  meeting: Meeting;
  dates: MeetingDate[];
  initialCounts: Record<number, number>;
  initialMyVotes: number[];
  userId: string | null;
  roomId: number | null;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [meeting, setMeeting] = useState(initialMeeting);
  const [dates, setDates] = useState<MeetingDate[]>(initialDates);
  const [counts, setCounts] = useState<Record<number, number>>(initialCounts);
  const [myVotes, setMyVotes] = useState<Set<number>>(new Set(initialMyVotes));
  const [roomId, setRoomId] = useState<number | null>(initialRoomId);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState("");

  // 수정 모달 표시 여부
  const [editing, setEditing] = useState(false);

  const deadlinePassed = useMemo(
    () => new Date(meeting.vote_deadline).getTime() <= Date.now(),
    [meeting.vote_deadline]
  );
  const confirmed = meeting.status === "confirmed";

  // 마감 지났는데 아직 voting 이면 자동 확정 시도
  useEffect(() => {
    if (confirmed || !deadlinePassed || finalizing || editing) return;
    setFinalizing(true);
    fetch("/api/meetings/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meeting_id: meeting.id }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.status === "confirmed") {
          setMeeting((m) => ({
            ...m,
            status: "confirmed",
            confirmed_date: j.confirmed_date ?? m.confirmed_date,
            room_id: j.room_id ?? m.room_id,
          }));
          setRoomId(j.room_id ?? null);
          router.refresh();
        }
      })
      .finally(() => setFinalizing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed, deadlinePassed]);

  const maxCount = useMemo(
    () => Math.max(0, ...dates.map((d) => counts[d.id] ?? 0)),
    [counts, dates]
  );

  async function toggleVote(dateId: number) {
    if (!userId) return setError("로그인이 필요합니다.");
    if (confirmed || deadlinePassed) return;
    setError("");

    const has = myVotes.has(dateId);
    const apply = (delta: number, add: boolean) => {
      setMyVotes((prev) => {
        const next = new Set(prev);
        if (add) next.add(dateId);
        else next.delete(dateId);
        return next;
      });
      setCounts((prev) => ({
        ...prev,
        [dateId]: Math.max(0, (prev[dateId] ?? 0) + delta),
      }));
    };

    // 낙관적 반영 — 실패하면 역연산으로 롤백해 화면과 DB 를 일치시킨다
    apply(has ? -1 : 1, !has);

    if (has) {
      const { error } = await supabase
        .from("meeting_votes")
        .delete()
        .eq("meeting_date_id", dateId)
        .eq("user_id", userId);
      if (error) {
        apply(1, true);
        setError(`취소 실패: ${error.message}`);
      }
    } else {
      const { error } = await supabase.from("meeting_votes").insert({
        meeting_date_id: dateId,
        meeting_id: meeting.id,
        user_id: userId,
      });
      if (error) {
        apply(-1, false);
        setError(`투표 실패: ${error.message}`);
      }
    }
  }

  // 투표는 같이 보면서 하는 화면 — 남의 표도 실시간 반영 (마감 전만)
  useEffect(() => {
    if (confirmed || deadlinePassed) return;
    const ch = supabase
      .channel(`meeting-votes-${meeting.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meeting_votes",
          filter: `meeting_id=eq.${meeting.id}`,
        },
        // DELETE 페이로드엔 PK 만 올 수 있어 증분 대신 가볍게 재조회
        () => reload()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting.id, confirmed, deadlinePassed]);

  // 저장 후 최신 날짜/표를 다시 읽어 화면 갱신
  async function reload() {
    const { data: d } = await supabase
      .from("meeting_dates")
      .select("id, meeting_id, d")
      .eq("meeting_id", meeting.id)
      .order("d", { ascending: true });
    const { data: v } = await supabase
      .from("meeting_votes")
      .select("meeting_date_id, user_id")
      .eq("meeting_id", meeting.id);
    const c: Record<number, number> = {};
    const mine: number[] = [];
    for (const row of v ?? []) {
      c[row.meeting_date_id] = (c[row.meeting_date_id] ?? 0) + 1;
      if (userId && row.user_id === userId) mine.push(row.meeting_date_id);
    }
    setDates((d ?? []) as MeetingDate[]);
    setCounts(c);
    setMyVotes(new Set(mine));
  }

  return (
    <>
      <div className="row spread" style={{ marginBottom: 12 }}>
        <h1 className="wrap-title">{meeting.title}</h1>
        <div className="row" style={{ gap: 8 }}>
          {confirmed ? (
            <span className="badge confirmed">확정</span>
          ) : (
            <span className="badge voting">투표중</span>
          )}
          {isLoggedIn && !editing && (
            <button className="btn sm" onClick={() => setEditing(true)}>
              ✏️ 수정
            </button>
          )}
        </div>
      </div>

      {meeting.description && (
        <p className="muted" style={{ marginTop: 0 }}>{meeting.description}</p>
      )}

      <div className="row meta" style={{ gap: 10, marginBottom: 16 }}>
        <span className="row" style={{ gap: 4 }}>
          {meeting.mode === "online" ? <IconMonitor size={12} /> : <IconPin size={12} />}
          {meeting.mode === "online" ? "온라인" : "오프라인"}
        </span>
        {/* 확정 후엔 마감시각이 무의미(단일 날짜 모임은 합성된 과거 시각) */}
        {!confirmed && (
          <span className="row" style={{ gap: 4 }}>
            <IconClock size={12} /> 마감{" "}
            {new Date(meeting.vote_deadline).toLocaleString("ko-KR")}
          </span>
        )}
      </div>

      {confirmed && (
        <div className="card" style={{ marginBottom: 16, background: "var(--lime)" }}>
          <div className="row" style={{ gap: 6 }}>
            <IconStar size={12} /> 확정일:{" "}
            <b>
              {meeting.confirmed_date} (
              {meeting.confirmed_date && weekday(meeting.confirmed_date)})
            </b>
          </div>
          {roomId && (
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <Link className="btn primary" href={`/rooms/${roomId}`}>
                토론방 입장 →
              </Link>
            </div>
          )}
        </div>
      )}

      {finalizing && <p className="muted small">날짜 확정 처리 중...</p>}

      {/* 투표 없이 날짜 하나로 확정된 모임엔 "후보 날짜/0표"가 무의미 */}
      {!(confirmed && dates.length <= 1) && (
        <>
      <h3 style={{ marginBottom: 8 }}>후보 날짜</h3>
      {!confirmed && !deadlinePassed && (
        <p className="small muted" style={{ marginTop: 0 }}>
          가능한 날짜를 모두 골라주세요 (여러 개 선택 가능).
        </p>
      )}
      {dates.map((d) => {
        const c = counts[d.id] ?? 0;
        const voted = myVotes.has(d.id);
        const win = confirmed && meeting.confirmed_date === d.d;
        const isWinning = !confirmed && maxCount > 0 && c === maxCount;
        return (
          <button
            key={d.id}
            className={`date-chip ${voted ? "voted" : ""} ${win || isWinning ? "win" : ""}`}
            onClick={() => toggleVote(d.id)}
            disabled={confirmed || deadlinePassed}
            aria-pressed={voted}
            style={{ width: "100%", textAlign: "left" }}
          >
            <span>
              <span aria-hidden>{voted ? "☑" : "☐"}</span> {d.d} ({weekday(d.d)})
            </span>
            <span className={`vote-count ${win || isWinning ? "top" : ""}`}>
              {(win || isWinning) && c > 0 && "👑 "}
              {c}표
            </span>
          </button>
        );
      })}
        </>
      )}

      {error && (
        <p className="small err">{error}</p>
      )}

      {editing && (
        <MeetingEditModal
          meeting={meeting}
          onClose={() => setEditing(false)}
          onSaved={async (updated) => {
            setMeeting(updated);
            await reload();
            setEditing(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
