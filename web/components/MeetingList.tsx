"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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

  const [meetings] = useState<Meeting[]>(initialMeetings);
  const [show, setShow] = useState(defaultOpen && isLoggedIn);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<RoomMode>("offline");
  const [dates, setDates] = useState<string[]>([""]);
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    if (cleanDates.length === 0) return setError("후보 날짜를 1개 이상 추가하세요.");
    if (!deadline) return setError("투표 마감 일시를 정하세요.");

    setSaving(true);
    const { data: meeting, error: mErr } = await supabase
      .from("meetings")
      .insert({
        title: cleanTitle,
        description: description.trim() || null,
        mode,
        vote_deadline: new Date(deadline).toISOString(),
        status: "voting",
      })
      .select("id")
      .single();
    if (mErr || !meeting) {
      setSaving(false);
      return setError(`방 생성 실패: ${mErr?.message ?? ""}`);
    }

    const rows = cleanDates.map((d) => ({ meeting_id: meeting.id, d }));
    const { error: dErr } = await supabase.from("meeting_dates").insert(rows);
    setSaving(false);
    if (dErr) return setError(`후보 날짜 저장 실패: ${dErr.message}`);

    router.push(`/meetings/${meeting.id}`);
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

          <div>
            <div className="small muted" style={{ marginBottom: 6 }}>후보 날짜</div>
            <div className="grid">
              {dates.map((d, i) => (
                <div key={i} className="row" style={{ gap: 8 }}>
                  <input
                    className="field"
                    type="date"
                    value={d}
                    onChange={(e) => setDate(i, e.target.value)}
                  />
                  {dates.length > 1 && (
                    <button className="btn" onClick={() => removeDate(i)}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button className="btn" style={{ marginTop: 8 }} onClick={addDateField}>
              + 날짜 추가
            </button>
          </div>

          <label>
            <div className="small muted" style={{ marginBottom: 6 }}>투표 마감 일시</div>
            <input
              className="field"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>

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

      {meetings.length === 0 ? (
        <p
          className="muted"
          style={{ fontSize: 20, textAlign: "center", padding: "40px 0" }}
        >
          아직 만들어진 방이 없어요.
          <br />
          방 만들기로 시작해 보세요.
        </p>
      ) : (
        meetings.map((m) => (
          <Link
            key={m.id}
            href={
              m.status === "confirmed" && m.room_id
                ? `/rooms/${m.room_id}`
                : `/meetings/${m.id}`
            }
            className="meeting-item"
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            <div className="row spread">
              <strong style={{ fontSize: 16 }}>{m.title}</strong>
              {m.status === "confirmed" ? (
                <span className="badge confirmed">확정 · {fmtDate(m.confirmed_date)}</span>
              ) : (
                <span className="badge voting">투표중</span>
              )}
            </div>
            {m.description && (
              <div className="small muted" style={{ marginTop: 6 }}>{m.description}</div>
            )}
            <div className="row meta" style={{ gap: 10, marginTop: 6 }}>
              <span>{m.mode === "online" ? "💻 온라인" : "📍 오프라인"}</span>
              {m.status === "voting" && <span>⏰ 마감 {fmtDeadline(m.vote_deadline)}</span>}
            </div>
          </Link>
        ))
      )}
    </>
  );
}
