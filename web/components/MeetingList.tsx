"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usePersistentToggle } from "@/lib/usePersistentToggle";
import { ConfirmDialog } from "./ConfirmDialog";
import { MeetingEditModal } from "./MeetingEditModal";
import { ShareButton } from "./ShareButton";
import type { Meeting, RoomMode } from "@/lib/types";

function fmtDate(d: string | null) {
  if (!d) return "";
  return d.slice(0, 10);
}

function fmtDeadline(ts: string) {
  const dt = new Date(ts);
  return dt.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 로컬 기준 오늘 날짜 (YYYY-MM-DD)
function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function MeetingList({
  initialMeetings,
  isLoggedIn,
  defaultOpen = false,
}: {
  initialMeetings: Meeting[];
  isLoggedIn: boolean;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings);
  const [show, setShow] = useState(defaultOpen && isLoggedIn);
  const [hideDone, setHideDone] = usePersistentToggle("hideDoneMeetings", true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<RoomMode>("offline");
  // 투표 옵션: 기본 OFF. OFF면 단일 날짜로 즉시 방 생성, ON이면 여러 날짜 투표.
  const [vote, setVote] = useState(false);
  const [dates, setDates] = useState<string[]>([""]);
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 삭제 확인 다이얼로그 상태
  const [pendingDelete, setPendingDelete] = useState<Meeting | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // 수정 모달 상태
  const [editing, setEditing] = useState<Meeting | null>(null);

  // soft navigation(예: 헤더의 "방 만들기" → /?new=1) 시에는 컴포넌트가
  // 재마운트되지 않아 useState 초기값이 갱신되지 않는다. defaultOpen prop이
  // 바뀌면 다이얼로그 상태를 동기화해 새로고침 없이도 열리도록 한다.
  useEffect(() => {
    if (defaultOpen && isLoggedIn) setShow(true);
  }, [defaultOpen, isLoggedIn]);

  // 진행 완료(확정 + 날짜 지남) 방 숨기기
  const visible = useMemo(() => {
    if (!hideDone) return meetings;
    const t = todayStr();
    return meetings.filter(
      (m) => !(m.status === "confirmed" && m.confirmed_date && m.confirmed_date < t)
    );
  }, [meetings, hideDone]);

  function addDateField() {
    setDates((prev) => [...prev, ""]);
  }
  function setDate(i: number, v: string) {
    setDates((prev) => prev.map((d, idx) => (idx === i ? v : d)));
  }
  function removeDate(i: number) {
    setDates((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function createMeeting() {
    setError("");
    const cleanTitle = title.trim();
    const cleanDates = Array.from(
      new Set(dates.map((d) => d.trim()).filter(Boolean))
    );
    if (!cleanTitle) return setError("방 제목을 입력하세요.");
    if (cleanDates.length === 0) return setError("날짜를 1개 이상 정하세요.");
    if (vote && !deadline) return setError("투표 마감 일시를 정하세요.");

    setSaving(true);
    // 투표 OFF면 즉시 확정되도록 마감을 과거로 설정한다.
    const voteDeadline = vote
      ? new Date(deadline).toISOString()
      : new Date(Date.now() - 1000).toISOString();

    const { data: meeting, error: mErr } = await supabase
      .from("meetings")
      .insert({
        title: cleanTitle,
        description: description.trim() || null,
        mode,
        vote_deadline: voteDeadline,
        status: "voting",
      })
      .select("id")
      .single();
    if (mErr || !meeting) {
      setSaving(false);
      return setError(`방 생성 실패: ${mErr?.message ?? ""}`);
    }

    // 투표 OFF면 첫 날짜만 사용
    const useDates = vote ? cleanDates : [cleanDates[0]];
    const rows = useDates.map((d) => ({ meeting_id: meeting.id, d }));
    const { error: dErr } = await supabase.from("meeting_dates").insert(rows);
    if (dErr) {
      setSaving(false);
      return setError(`날짜 저장 실패: ${dErr.message}`);
    }

    // 투표 OFF: 즉시 확정 → 방 생성 후 방으로 이동
    if (!vote) {
      try {
        const res = await fetch("/api/meetings/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meeting_id: meeting.id }),
        });
        const data = await res.json().catch(() => null);
        setSaving(false);
        if (res.ok && data?.room_id) {
          router.push(`/rooms/${data.room_id}`);
          return;
        }
        return setError(data?.error ?? "방 생성에 실패했어요.");
      } catch {
        setSaving(false);
        return setError("방 생성에 실패했어요.");
      }
    }

    setSaving(false);
    router.push(`/meetings/${meeting.id}`);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/meetings/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_id: pendingDelete.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `삭제 실패 (${res.status})`);
      }
      setMeetings((prev) => prev.filter((m) => m.id !== pendingDelete.id));
      setPendingDelete(null);
      router.refresh();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "삭제에 실패했어요.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {show && (
        <div className="card" style={{ marginBottom: 16, display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0 }}>새 방 만들기</h3>
          <label>
            <div className="small muted" style={{ marginBottom: 6 }}>제목</div>
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 3월 뜬구름 방"
            />
          </label>
          <label>
            <div className="small muted" style={{ marginBottom: 6 }}>설명 (선택)</div>
            <textarea
              className="field"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label>
            <div className="small muted" style={{ marginBottom: 6 }}>형태</div>
            <select
              className="field"
              value={mode}
              onChange={(e) => setMode(e.target.value as RoomMode)}
            >
              <option value="offline">오프라인</option>
              <option value="online">온라인</option>
            </select>
          </label>

          <label className="row small">
            <input
              type="checkbox"
              checked={vote}
              onChange={(e) => setVote(e.target.checked)}
            />
            여러 날짜로 투표 받기
          </label>

          <div>
            <div className="small muted" style={{ marginBottom: 6 }}>
              {vote ? "후보 날짜" : "날짜"}
            </div>
            <div className="grid">
              {(vote ? dates : dates.slice(0, 1)).map((d, i) => (
                <div key={i} className="row" style={{ gap: 8 }}>
                  <input
                    className="field"
                    type="date"
                    value={d}
                    onChange={(e) => setDate(i, e.target.value)}
                  />
                  {vote && dates.length > 1 && (
                    <button className="btn" onClick={() => removeDate(i)}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {vote && (
              <button className="btn" style={{ marginTop: 8 }} onClick={addDateField}>
                + 날짜 추가
              </button>
            )}
          </div>

          {vote && (
            <label>
              <div className="small muted" style={{ marginBottom: 6 }}>투표 마감 일시</div>
              <input
                className="field"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </label>
          )}

          {error && <span className="small" style={{ color: "var(--pink-deep)" }}>{error}</span>}
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" onClick={() => setShow(false)}>
              취소
            </button>
            <button className="btn primary" onClick={createMeeting} disabled={saving}>
              {saving ? "생성 중..." : "방 만들기"}
            </button>
          </div>
        </div>
      )}

      <div className="row spread" style={{ marginBottom: 12 }}>
        <label className="row small">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
          />
          진행 완료한 방 숨기기
        </label>
      </div>

      {visible.length === 0 ? (
        <p
          className="muted"
          style={{ fontSize: 20, textAlign: "center", padding: "40px 0" }}
        >
          {meetings.length === 0 ? (
            <>
              아직 만들어진 방이 없어요.
              <br />
              방 만들기로 시작해 보세요.
            </>
          ) : (
            "표시할 방이 없어요."
          )}
        </p>
      ) : (
        visible.map((m) => (
          <div key={m.id} className="meeting-item" style={{ position: "relative" }}>
            <Link
              href={
                m.status === "confirmed" && m.room_id
                  ? `/rooms/${m.room_id}`
                  : `/meetings/${m.id}`
              }
              className="stretch-link"
              aria-label={m.title}
            />
            <div className="row spread">
              <strong style={{ fontSize: 16 }}>{m.title}</strong>
              <div className="row" style={{ gap: 8, position: "relative", zIndex: 1 }}>
                {m.status === "confirmed" ? (
                  <span className="badge confirmed">확정 · {fmtDate(m.confirmed_date)}</span>
                ) : (
                  <span className="badge voting">투표중</span>
                )}
                <ShareButton
                  path={
                    m.status === "confirmed" && m.room_id
                      ? `/rooms/${m.room_id}`
                      : `/meetings/${m.id}`
                  }
                />
                {isLoggedIn && (
                  <>
                    <button className="btn sm" onClick={() => setEditing(m)}>
                      수정
                    </button>
                    <button
                      className="btn sm danger"
                      onClick={() => {
                        setDeleteError("");
                        setPendingDelete(m);
                      }}
                    >
                      삭제
                    </button>
                  </>
                )}
              </div>
            </div>
            {m.description && (
              <div className="small muted" style={{ marginTop: 6 }}>{m.description}</div>
            )}
            <div className="row meta" style={{ gap: 10, marginTop: 6 }}>
              <span>{m.mode === "online" ? "💻 온라인" : "📍 오프라인"}</span>
              {m.status === "voting" && <span>⏰ 마감 {fmtDeadline(m.vote_deadline)}</span>}
            </div>
          </div>
        ))
      )}

      {editing && (
        <MeetingEditModal
          meeting={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setMeetings((prev) =>
              prev.map((m) => (m.id === updated.id ? updated : m))
            );
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="방을 삭제할까요?"
        message={
          pendingDelete
            ? `"${pendingDelete.title}" 방과 관련된 채팅·주제·기록이 모두 삭제됩니다. 되돌릴 수 없어요.`
            : undefined
        }
        confirmText="삭제"
        danger
        busy={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
      />
    </>
  );
}
