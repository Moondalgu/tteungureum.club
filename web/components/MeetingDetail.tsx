"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Meeting, MeetingDate } from "@/lib/types";

function weekday(d: string) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return days[new Date(d + "T00:00:00").getDay()];
}

export function MeetingDetail({
  meeting: initialMeeting,
  dates,
  initialCounts,
  initialMyVotes,
  userId,
  roomId: initialRoomId,
  discordUrl: initialDiscordUrl,
}: {
  meeting: Meeting;
  dates: MeetingDate[];
  initialCounts: Record<number, number>;
  initialMyVotes: number[];
  userId: string | null;
  roomId: number | null;
  discordUrl: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [meeting, setMeeting] = useState(initialMeeting);
  const [counts, setCounts] = useState<Record<number, number>>(initialCounts);
  const [myVotes, setMyVotes] = useState<Set<number>>(new Set(initialMyVotes));
  const [roomId, setRoomId] = useState<number | null>(initialRoomId);
  const [discordUrl, setDiscordUrl] = useState<string | null>(initialDiscordUrl);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState("");

  const deadlinePassed = useMemo(
    () => new Date(meeting.vote_deadline).getTime() <= Date.now(),
    [meeting.vote_deadline]
  );
  const confirmed = meeting.status === "confirmed";

  // 마감 지났는데 아직 voting 이면 자동 확정 시도
  useEffect(() => {
    if (confirmed || !deadlinePassed || finalizing) return;
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
          if (j.discord_url) setDiscordUrl(j.discord_url);
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
    // 낙관적 업데이트
    setMyVotes((prev) => {
      const next = new Set(prev);
      if (has) next.delete(dateId);
      else next.add(dateId);
      return next;
    });
    setCounts((prev) => ({
      ...prev,
      [dateId]: Math.max(0, (prev[dateId] ?? 0) + (has ? -1 : 1)),
    }));

    if (has) {
      const { error } = await supabase
        .from("meeting_votes")
        .delete()
        .eq("meeting_date_id", dateId)
        .eq("user_id", userId);
      if (error) setError(`취소 실패: ${error.message}`);
    } else {
      const { error } = await supabase.from("meeting_votes").insert({
        meeting_date_id: dateId,
        meeting_id: meeting.id,
        user_id: userId,
      });
      if (error) setError(`투표 실패: ${error.message}`);
    }
  }

  return (
    <>
      <div className="row spread" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>{meeting.title}</h1>
        {confirmed ? (
          <span className="badge confirmed">확정</span>
        ) : (
          <span className="badge voting">투표중</span>
        )}
      </div>
      {meeting.description && (
        <p className="muted" style={{ marginTop: 0 }}>{meeting.description}</p>
      )}
      <div className="row meta" style={{ gap: 10, marginBottom: 16 }}>
        <span>{meeting.mode === "online" ? "💻 온라인" : "📍 오프라인"}</span>
        <span>
          ⏰ 마감 {new Date(meeting.vote_deadline).toLocaleString("ko-KR")}
        </span>
      </div>

      {confirmed && (
        <div className="card" style={{ marginBottom: 16, background: "var(--lime)" }}>
          <div style={{ fontSize: 16 }}>
            🎉 확정일: <b>{meeting.confirmed_date} ({meeting.confirmed_date && weekday(meeting.confirmed_date)})</b>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            {roomId && (
              <Link className="btn primary" href={`/rooms/${roomId}`}>
                토론방 입장 →
              </Link>
            )}
            {discordUrl && (
              <a className="btn cyan" href={discordUrl} target="_blank" rel="noreferrer">
                디스코드 채널
              </a>
            )}
          </div>
        </div>
      )}

      {finalizing && <p className="muted small">날짜 확정 처리 중...</p>}

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
            style={{ width: "100%", textAlign: "left" }}
          >
            <span>
              {d.d} ({weekday(d.d)}) {voted && "✓"}
            </span>
            <span className="vote-count">{c}표</span>
          </button>
        );
      })}

      {error && (
        <p className="small" style={{ color: "var(--pink-deep)" }}>{error}</p>
      )}
    </>
  );
}
