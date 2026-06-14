"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Meeting, RoomMode } from "@/lib/types";

// ISO 문자열 → datetime-local 입력값(YYYY-MM-DDTHH:mm)
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

type EditDate = { id: number | null; d: string };

// 모임 수정 모달. 홈/상세 어디서든 같은 폼을 모달로 띄운다.
// - 후보 날짜는 열릴 때 직접 조회(부모가 넘겨줄 필요 없음)
// - 저장은 /api/meetings/update (RLS 우회용 admin 라우트)
// - 저장 성공 시 onSaved 로 갱신된 모임을 넘겨 부모가 목록/상세를 갱신
export function MeetingEditModal({
  meeting,
  onClose,
  onSaved,
}: {
  meeting: Meeting;
  onClose: () => void;
  onSaved: (updated: Meeting) => void;
}) {
  const supabase = createClient();
  const confirmed = meeting.status === "confirmed";

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState(meeting.title);
  const [desc, setDesc] = useState(meeting.description ?? "");
  const [mode, setMode] = useState<RoomMode>(meeting.mode);
  const [deadline, setDeadline] = useState(toLocalInput(meeting.vote_deadline));
  const [dates, setDates] = useState<EditDate[]>([]);
  const [reopen, setReopen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 후보 날짜 조회
  useEffect(() => {
    let alive = true;
    supabase
      .from("meeting_dates")
      .select("id, d")
      .eq("meeting_id", meeting.id)
      .order("d", { ascending: true })
      .then(({ data }) => {
        if (!alive) return;
        const rows = (data ?? []).map((r) => ({ id: r.id as number, d: r.d as string }));
        setDates(rows.length > 0 ? rows : [{ id: null, d: "" }]);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting.id]);

  function setDate(i: number, v: string) {
    setDates((prev) => prev.map((x, idx) => (idx === i ? { ...x, d: v } : x)));
  }
  function addDate() {
    setDates((prev) => [...prev, { id: null, d: "" }]);
  }
  function removeDate(i: number) {
    setDates((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setError("");
    const cleanTitle = title.trim();
    const cleanDates = dates
      .map((x) => ({ id: x.id, d: x.d.trim() }))
      .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.d));
    if (!cleanTitle) return setError("제목을 입력하세요.");
    if (cleanDates.length === 0) return setError("날짜를 1개 이상 정하세요.");
    if (!deadline) return setError("마감 일시를 정하세요.");

    setSaving(true);
    try {
      const res = await fetch("/api/meetings/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting_id: meeting.id,
          title: cleanTitle,
          description: desc.trim() || null,
          mode,
          vote_deadline: new Date(deadline).toISOString(),
          dates: cleanDates,
          reopen: confirmed && reopen,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `수정 실패 (${res.status})`);
      }
      onSaved({
        ...meeting,
        title: cleanTitle,
        description: desc.trim() || null,
        mode,
        vote_deadline: new Date(deadline).toISOString(),
        ...(confirmed && reopen
          ? { status: "voting" as const, confirmed_date: null }
          : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "수정에 실패했어요.");
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={() => !saving && onClose()}>
      <div
        className="dialog"
        style={{ maxWidth: 460, textAlign: "left" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0 }}>모임 수정</h3>

        {loading ? (
          <p className="muted small">불러오는 중...</p>
        ) : (
          <>
            <label>
              <div className="small muted" style={{ marginBottom: 6 }}>제목</div>
              <input
                className="field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              <div className="small muted" style={{ marginBottom: 6 }}>설명 (선택)</div>
              <textarea
                className="field"
                rows={2}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
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
                {dates.map((x, i) => (
                  <div key={i} className="row" style={{ gap: 8 }}>
                    <input
                      className="field"
                      type="date"
                      value={x.d}
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
              <button className="btn" style={{ marginTop: 8 }} onClick={addDate}>
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

            {confirmed && (
              <label className="row small">
                <input
                  type="checkbox"
                  checked={reopen}
                  onChange={(e) => setReopen(e.target.checked)}
                />
                확정 해제하고 다시 투표받기 (방은 유지, 날짜만 다시 정함)
              </label>
            )}

            {error && (
              <span className="small" style={{ color: "var(--pink-deep)" }}>{error}</span>
            )}
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={onClose} disabled={saving}>
                취소
              </button>
              <button className="btn primary" onClick={save} disabled={saving}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
