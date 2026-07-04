"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Overlay } from "./Overlay";
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
  // 투표 옵션: 기본 OFF. OFF면 날짜만 정해 즉시 확정, ON이면 여러 날짜로 투표.
  const [vote, setVote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 후보 날짜 조회 (날짜가 2개 이상이면 투표 모임으로 판단)
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
        setVote(rows.length > 1);
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
    const allDates = dates
      .map((x) => ({ id: x.id, d: x.d.trim() }))
      .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.d));
    if (!cleanTitle) return setError("제목을 입력하세요.");
    if (allDates.length === 0) return setError("날짜를 1개 이상 정하세요.");
    if (vote && !deadline) return setError("투표 마감 일시를 정하세요.");

    // 투표 OFF: 첫 날짜만 사용, 마감을 과거로 둬 즉시 확정.
    const useDates = vote ? allDates : [allDates[0]];
    const finalDeadline = vote
      ? new Date(deadline).toISOString()
      : new Date(Date.now() - 1000).toISOString();
    const desc2 = desc.trim() || null;

    setSaving(true);
    try {
      const res = await fetch("/api/meetings/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting_id: meeting.id,
          title: cleanTitle,
          description: desc2,
          mode,
          vote_deadline: finalDeadline,
          dates: useDates,
          // 확정됐던 모임은 재평가하도록 확정 해제 후 다시 처리한다.
          reopen: confirmed,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `수정 실패 (${res.status})`);
      }

      let updated: Meeting = {
        ...meeting,
        title: cleanTitle,
        description: desc2,
        mode,
        vote_deadline: finalDeadline,
      };

      if (vote) {
        // 투표 모임: 다시 투표받기 (확정이었으면 voting 으로)
        updated = { ...updated, status: "voting", confirmed_date: null };
      } else {
        // 단일 날짜: 즉시 확정 처리 (방 유지 또는 생성)
        const fres = await fetch("/api/meetings/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meeting_id: meeting.id }),
        });
        const fdata = await fres.json().catch(() => null);
        if (fres.ok && fdata?.room_id) {
          updated = {
            ...updated,
            status: "confirmed",
            confirmed_date: fdata.confirmed_date ?? useDates[0].d,
            room_id: fdata.room_id,
          };
        }
      }

      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "수정에 실패했어요.");
      setSaving(false);
    }
  }

  return (
    <Overlay onClose={() => !saving && onClose()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>✏️ 모임 수정</h3>
          <button
            className="xbtn"
            aria-label="닫기"
            onClick={onClose}
            disabled={saving}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="modal-body" aria-busy="true">
            {/* 실제 폼과 같은 높이를 미리 차지해 로딩 후 레이아웃 점프를 막는다 */}
            <span className="skeleton" style={{ height: 44 }} />
            <span className="skeleton" style={{ height: 44 }} />
            <span className="skeleton" style={{ height: 44 }} />
            <span className="skeleton" style={{ height: 60 }} />
          </div>
        ) : (
          <>
            <div className="modal-body">
              <div className="fld">
                <span className="lbl">제목</span>
                <input
                  className="field"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예) 3월 뜬구름 방"
                />
              </div>

              <div className="fld">
                <span className="lbl">설명 <span className="muted small">(선택)</span></span>
                <textarea
                  className="field"
                  rows={2}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="어떤 모임인지 간단히"
                />
              </div>

              <div className="fld">
                <span className="lbl">형태</span>
                <select
                  className="field"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as RoomMode)}
                >
                  <option value="offline">📍 오프라인</option>
                  <option value="online">💻 온라인</option>
                </select>
              </div>

              <label className="reopen-box">
                <input
                  type="checkbox"
                  checked={vote}
                  onChange={(e) => setVote(e.target.checked)}
                />
                <span>
                  <b>여러 날짜로 투표 받기</b>
                  <br />
                  끄면 날짜 하나로 바로 확정돼요.
                </span>
              </label>

              <div className="fld">
                <span className="lbl">
                  {vote ? (
                    <>후보 날짜 <span className="muted small">({dates.length}개)</span></>
                  ) : (
                    "날짜"
                  )}
                </span>
                {(vote ? dates : dates.slice(0, 1)).map((x, i) => (
                  <div key={i} className="date-row">
                    <input
                      className="field"
                      type="date"
                      value={x.d}
                      onChange={(e) => setDate(i, e.target.value)}
                    />
                    {vote && dates.length > 1 && (
                      <button
                        className="btn sm"
                        aria-label="날짜 삭제"
                        onClick={() => removeDate(i)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {vote && (
                  <button className="btn sm" onClick={addDate} style={{ justifySelf: "start" }}>
                    + 날짜 추가
                  </button>
                )}
              </div>

              {vote && (
                <div className="fld">
                  <span className="lbl">투표 마감 일시</span>
                  <input
                    className="field"
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
              )}

              {error && <span className="small err">{error}</span>}
            </div>

            <div className="modal-foot">
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
    </Overlay>
  );
}
