"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MAX_TOPICS_PER_ROOM, type RoomTopic, type Topic } from "@/lib/types";

const byPos = (a: RoomTopic, b: RoomTopic) => a.position - b.position;

// 주제 히어로: 지금 토론 중인 주제를 크게 보여주고, 완료/건너뛰기로 진행.
// 전체 목록·추가·N의 상자는 아코디언으로 접어둔다(점진적 공개).
// compact=true 면 스테이지 도구(공유/화이트보드)가 열린 상태이므로 축소된다.
export function RoomTopics({
  roomId,
  initialTopics,
  boxTopics,
  isLoggedIn,
  compact = false,
}: {
  roomId: number;
  initialTopics: RoomTopic[];
  boxTopics: Topic[];
  isLoggedIn: boolean;
  compact?: boolean;
}) {
  const supabase = createClient();

  const [items, setItems] = useState<RoomTopic[]>(
    [...initialTopics].sort(byPos)
  );
  const [box, setBox] = useState<Topic[]>(boxTopics);
  const [accOpen, setAccOpen] = useState(false);
  const [showBox, setShowBox] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [error, setError] = useState("");

  const usedTopicIds = new Set(items.map((i) => i.topic_id).filter(Boolean));
  const availableBox = box.filter((t) => !usedTopicIds.has(t.id));

  const doneCount = items.filter((i) => i.done).length;
  const curIndex = items.findIndex((i) => !i.done);
  const current = curIndex >= 0 ? items[curIndex] : null;

  async function setDone(rt: RoomTopic, next: boolean) {
    if (!isLoggedIn) return;
    setItems((prev) =>
      prev.map((i) => (i.id === rt.id ? { ...i, done: next } : i))
    );
    const { error } = await supabase
      .from("room_topics")
      .update({ done: next })
      .eq("id", rt.id);
    if (error) setError(`상태 변경 실패: ${error.message}`);
    if (rt.topic_id) {
      await supabase
        .from("topics")
        .update({ status: next ? "done" : "selected" })
        .eq("id", rt.topic_id);
    }
  }

  async function skip(rt: RoomTopic) {
    if (!isLoggedIn) return;
    const maxPos = items.reduce((m, i) => Math.max(m, i.position), 0);
    const newPos = maxPos + 1;
    setItems((prev) =>
      prev
        .map((i) => (i.id === rt.id ? { ...i, position: newPos } : i))
        .sort(byPos)
    );
    await supabase
      .from("room_topics")
      .update({ position: newPos })
      .eq("id", rt.id);
  }

  async function addFromBox(t: Topic) {
    if (!isLoggedIn) return setError("로그인이 필요합니다.");
    if (items.length >= MAX_TOPICS_PER_ROOM)
      return setError(`주제는 최대 ${MAX_TOPICS_PER_ROOM}개까지 담을 수 있어요.`);
    setError("");
    const position =
      items.reduce((m, i) => Math.max(m, i.position), -1) + 1;
    const { data, error } = await supabase
      .from("room_topics")
      .insert({
        room_id: roomId,
        topic_id: t.id,
        content: t.content,
        author: t.author,
        position,
        done: false,
      })
      .select("id, room_id, topic_id, content, author, position, done")
      .single();
    if (error || !data) return setError(`담기 실패: ${error?.message ?? ""}`);
    setItems((prev) => [...prev, data as RoomTopic].sort(byPos));
    setBox((prev) => prev.filter((b) => b.id !== t.id));
    await supabase.from("topics").update({ status: "selected" }).eq("id", t.id);
  }

  async function addSelfMade() {
    const content = newContent.trim();
    if (!content) return;
    if (!isLoggedIn) return setError("로그인이 필요합니다.");
    if (items.length >= MAX_TOPICS_PER_ROOM)
      return setError(`주제는 최대 ${MAX_TOPICS_PER_ROOM}개까지 담을 수 있어요.`);
    setError("");
    const position =
      items.reduce((m, i) => Math.max(m, i.position), -1) + 1;
    const { data, error } = await supabase
      .from("room_topics")
      .insert({
        room_id: roomId,
        topic_id: null,
        content,
        author: "방에서 추가",
        position,
        done: false,
      })
      .select("id, room_id, topic_id, content, author, position, done")
      .single();
    if (error || !data) return setError(`추가 실패: ${error?.message ?? ""}`);
    setItems((prev) => [...prev, data as RoomTopic].sort(byPos));
    setNewContent("");
  }

  async function remove(rt: RoomTopic) {
    if (!isLoggedIn) return;
    setItems((prev) => prev.filter((i) => i.id !== rt.id));
    await supabase.from("room_topics").delete().eq("id", rt.id);
    if (rt.topic_id) {
      await supabase
        .from("topics")
        .update({ status: "pending" })
        .eq("id", rt.topic_id);
      setBox((prev) =>
        prev.some((b) => b.id === rt.topic_id)
          ? prev
          : [
              {
                id: rt.topic_id!,
                author: rt.author,
                content: rt.content,
                source_date: null,
                status: "pending",
                created_at: new Date().toISOString(),
              },
              ...prev,
            ]
      );
    }
  }

  return (
    <div className={`topic-hero ${compact ? "compact" : ""}`}>
      <div className="row spread">
        {current ? (
          <span className="badge selected">
            🔵 지금 토론 중 · {curIndex + 1} / {items.length}
          </span>
        ) : (
          <span className="badge done">
            ✔ 완료 {doneCount} / {items.length || 0}
          </span>
        )}
        <div className="row" style={{ gap: 8 }}>
          {current && <span className="t-hero-author">✍️ {current.author}</span>}
          {current && isLoggedIn && (
            <button
              className="btn primary sm compact-next"
              onClick={() => setDone(current, true)}
            >
              완료·다음 ›
            </button>
          )}
        </div>
      </div>

      <div className="t-hero-title">
        {current ? current.content : items.length === 0 ? "아직 담긴 주제가 없어요" : "🎉 모든 주제를 마쳤어요"}
      </div>

      {current && isLoggedIn && (
        <div className="hero-actions">
          <button className="btn primary" onClick={() => setDone(current, true)}>
            ✓ 완료하고 다음 주제로
          </button>
          {items.filter((i) => !i.done).length > 1 && (
            <button className="btn" onClick={() => skip(current)}>
              건너뛰기 ›
            </button>
          )}
        </div>
      )}

      <div className="hero-divider" />

      <div className="acc-head" onClick={() => setAccOpen((v) => !v)}>
        <h4>📋 전체 주제 ({doneCount}/{items.length})</h4>
        <span className="small muted">{accOpen ? "접기 ▴" : "펼치기 ▾"}</span>
      </div>

      {accOpen && (
        <div className="acc-body">
          {items.map((rt, i) => (
            <div
              key={rt.id}
              className={`topic-li ${rt.done ? "done" : ""} ${
                rt.id === current?.id ? "cur" : ""
              }`}
            >
              <input
                className="checkbox"
                type="checkbox"
                checked={rt.done}
                disabled={!isLoggedIn}
                onChange={() => setDone(rt, !rt.done)}
                style={{ width: 18, height: 18 }}
              />
              <span className="content">
                {i + 1}. {rt.content}
                <span className="small muted"> · {rt.author}</span>
              </span>
              {isLoggedIn && (
                <button
                  className="small"
                  style={{
                    border: "none",
                    background: "none",
                    color: "var(--pink-deep)",
                    cursor: "pointer",
                    padding: 0,
                  }}
                  onClick={() => remove(rt)}
                >
                  빼기
                </button>
              )}
            </div>
          ))}

          {isLoggedIn && (
            <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <input
                className="field"
                style={{ flex: 1, minWidth: 160 }}
                placeholder="방에서 바로 주제 추가"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSelfMade()}
              />
              <button className="btn primary sm" onClick={addSelfMade}>
                추가
              </button>
              <button
                className="btn sm"
                style={{ whiteSpace: "nowrap" }}
                onClick={() => setShowBox((v) => !v)}
              >
                N의 상자
              </button>
            </div>
          )}

          {showBox && (
            <div className="card" style={{ marginTop: 8 }}>
              {availableBox.length === 0 ? (
                <p className="muted small" style={{ margin: 0 }}>
                  꺼낼 수 있는 주제가 없어요.
                </p>
              ) : (
                <div className="grid">
                  {availableBox.map((t) => (
                    <div key={t.id} className="row spread">
                      <span className="small">{t.content}</span>
                      <button className="btn sm" onClick={() => addFromBox(t)}>
                        + 담기
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="small" style={{ color: "var(--pink-deep)" }}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
