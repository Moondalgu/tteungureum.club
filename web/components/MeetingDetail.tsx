"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Meeting, MeetingDate, RoomMode } from "@/lib/types";

function weekday(d: string) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return days[new Date(d + "T00:00:00").getDay()];
}

// ISO 문자열 → datetime-local 입력값(YYYY-MM-DDTHH:mm)
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

type EditDate = { id: number | null; d: string };

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

  // ── 수정 패널 상태 ──
  const [editing, setEditing] = useState(false);
  const [eTitle, setETitle] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eMode, setEMode] = useState<RoomMode>("offline");
  const [eDeadline, setEDeadline] = useState("");
  const [eDates, setEDates] = useState<EditDate[]>([]);
  const [eReopen, setEReopen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

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

  function openEdit() {
    setETitle(meeting.title);
    setEDesc(meeting.description ?? "");
    setEMode(meeting.mode);
    setEDeadline(toLocalInput(meeting.vote_deadline));
    setEDates(dates.map((d) => ({ id: d.id, d: d.d })));
    setEReopen(false);
    setEditError("");
    setEditing(true);
  }

  function setEDate(i: number, v: string) {
    setEDates((prev) => prev.map((x, idx) => (idx === i ? { ...x, d: v } : x)));
  }
  function addEDate() {
    setEDates((prev) => [...prev, { id: null, d: "" }]);
  }
  function removeEDate(i: number) {
    setEDates((prev) => prev.filter((_, idx) => idx !== i));
  }

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

  async function saveEdit() {
    setEditError("");
    const cleanTitle = eTitle.trim();
    const cleanDates = eDates
      .map((x) => ({ id: x.id, d: x.d.trim() }))
      .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.d));
    if (!cleanTitle) return setEditError("제목을 입력하세요.");
    if (cleanDates.length === 0) return setEditError("날짜를 1개 이상 정하세요.");
    if (!eDeadline) return setEditError("마감 일시를 정하세요.");

    setSavingEdit(true);
    try {
      const res = await fetch("/api/meetings/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting_id: meeting.id,
          title: cleanTitle,
          description: eDesc.trim() || null,
          mode: eMode,
          vote_deadline: new Date(eDeadline).toISOString(),
          dates: cleanDates,
          reopen: confirmed && eReopen,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `수정 실패 (${res.status})`);
      }
      // 로컬 상태 갱신
      setMeeting((m) => ({
        ...m,
        title: cleanTitle,
        description: eDesc.trim() || null,
        mode: eMode,
        vote_deadline: new Date(eDeadline).toISOString(),
        ...(confirmed && eReopen
          ? { status: "voting" as const, confirmed_date: null }
          : {}),
      }));
      await reload();
      setEditing(false);
      router.refresh();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "수정에 실패했어요.");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <>
      <div className="row spread" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>{meeting.title}</h1>
        <div className="row" style={{ gap: 8 }}>
          {confirmed ? (
            <span className="badge confirmed">확정</span>
          ) : (
            <span className="badge voting">투표중</span>
          )}
          {isLoggedIn && !editing && (
            <button className="btn sm" onClick={openEdit}>
              ✏️ 수정
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="card" style={{ display: "grid", gap: 12, marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>모임 수정</h3>
          <label>
            <div className="small muted" style={{ marginBottom: 6 }}>제목</div>
            <input
              className="field"
              value={eTitle}
              onChange={(e) => setETitle(e.target.value)}
            />
          </label>
          <label>
            <div className="small muted" style={{ marginBottom: 6 }}>설명 (선택)</div>
            <textarea
              className="field"
              rows={2}
              value={eDesc}
              onChange={(e) => setEDesc(e.target.value)}
            />
          </label>
          <label>
            <div className="small muted" style={{ marginBottom: 6 }}>형태</div>
            <select
              className="field"
              value={eMode}
              onChange={(e) => setEMode(e.target.value as RoomMode)}
            >
              <option value="offline">오프라인</option>
              <option value="online">온라인</option>
            </select>
          </label>

          <div>
            <div className="small muted" style={{ marginBottom: 6 }}>후보 날짜</div>
            <div className="grid">
              {eDates.map((x, i) => (
                <div key={i} className="row" style={{ gap: 8 }}>
                  <input
                    className="field"
                    type="date"
                    value={x.d}
                    onChange={(e) => setEDate(i, e.target.value)}
                  />
                  {eDates.length > 1 && (
                    <button className="btn" onClick={() => removeEDate(i)}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button className="btn" style={{ marginTop: 8 }} onClick={addEDate}>
              + 날짜 추가
            </button>
          </div>

          <label>
            <div className="small muted" style={{ marginBottom: 6 }}>투표 마감 일시</div>
            <input
              className="field"
              type="datetime-local"
              value={eDeadline}
              onChange={(e) => setEDeadline(e.target.value)}
            />
          </label>

          {confirmed && (
            <label className="row small">
              <input
                type="checkbox"
                checked={eReopen}
                onChange={(e) => setEReopen(e.target.checked)}
              />
              확정 해제하고 다시 투표받기 (방은 유지, 날짜만 다시 정함)
            </label>
          )}

          {editError && (
            <span className="small" style={{ color: "var(--pink-deep)" }}>{editError}</span>
          )}
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" onClick={() => setEditing(false)} disabled={savingEdit}>
              취소
            </button>
            <button className="btn primary" onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      ) : (
        meeting.description && (
          <p className="muted" style={{ marginTop: 0 }}>{meeting.description}</p>
        )
      )}

      {!editing && (
        <>
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
      )}
    </>
  );
}
